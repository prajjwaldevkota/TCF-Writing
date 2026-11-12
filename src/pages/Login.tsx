import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { DeviceRecommendationModal } from '../components/DeviceRecommendationModal';

interface LoginProps {
  onSuccess: () => void;
  onHomeClick?: () => void;
  onFeedbackClick?: () => void;
}

type AuthMode = 'login' | 'register' | 'forgot' | 'recovery';

export const Login: React.FC<LoginProps> = ({ onSuccess, onHomeClick, onFeedbackClick }) => {
  const { t, language } = useLanguage();
  const {
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    resendVerification,
    isConfigured,
    isPasswordRecovery,
    clearPasswordRecovery
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');

  // Form states
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);

  // Password visibility states
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [showResend, setShowResend] = useState<boolean>(false);
  const [emailAlreadyExists, setEmailAlreadyExists] = useState<boolean>(false);

  // Load remembered email on mount
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('tcf_remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {}
  }, []);

  // Ensure Neumorphism UI theme is immediately active on mount
  useEffect(() => {
    try {
      document.documentElement.classList.remove('theme-neumorphism', 'neu-theme');
      document.documentElement.classList.remove('dark');
    } catch {}
  }, []);

  // Enter password recovery mode if user arrives via password reset link
  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('recovery');
      setErrorMsg(null);
      setInfoMsg('Veuillez saisir votre nouveau mot de passe ci-dessous.');
    }
  }, [isPasswordRecovery]);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResend(false);
    setEmailAlreadyExists(false);
    setFullName('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResend(false);

    if (!email || !password) {
      setErrorMsg('Veuillez renseigner votre adresse e-mail et votre mot de passe.');
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await signIn(cleanEmail, password);

      if (res.error) {
        const msg = res.error.message.toLowerCase();
        if (msg.includes('email not confirmed') || msg.includes('not confirmed') || msg.includes('unconfirmed')) {
          setErrorMsg(
            "Votre adresse e-mail n'a pas encore été confirmée. Veuillez ouvrir votre messagerie et cliquer sur le lien de confirmation."
          );
          setShowResend(true);
        } else if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          setErrorMsg('Identifiants incorrects. Veuillez vérifier votre adresse e-mail et votre mot de passe.');
        } else {
          setErrorMsg(res.error.message);
        }
      } else {
        // Handle "Remember Me"
        try {
          if (rememberMe) {
            localStorage.setItem('tcf_remembered_email', cleanEmail);
          } else {
            localStorage.removeItem('tcf_remembered_email');
          }
        } catch {}
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResend(false);
    setEmailAlreadyExists(false);

    if (!fullName.trim() || !email || !password || !confirmPassword) {
      setErrorMsg(t('Veuillez renseigner tous les champs obligatoires.'));
      return;
    }

    if (password.length < 6) {
      setErrorMsg(t('Le mot de passe doit comporter au moins 6 caractères.'));
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg(t('Les mots de passe ne correspondent pas.'));
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await signUp(cleanEmail, password, fullName.trim());

      if (res.error) {
        if (res.alreadyExists) {
          setEmailAlreadyExists(true);
          setErrorMsg('Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter.');
        } else {
          setErrorMsg(res.error.message);
        }
      } else if (res.needsVerification) {
        setInfoMsg(
          `Un lien de confirmation a été envoyé à ${cleanEmail}. Veuillez ouvrir votre boîte de réception (et vérifier vos spams), cliquer sur le lien pour valider votre compte, puis vous connecter.`
        );
        setShowResend(true);
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        try {
          if (rememberMe) {
            localStorage.setItem('tcf_remembered_email', cleanEmail);
          }
        } catch {}
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email) {
      setErrorMsg('Veuillez saisir votre adresse e-mail.');
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await resetPassword(cleanEmail);
      if (res.error) {
        setErrorMsg(res.error.message);
      } else {
        setInfoMsg(
          `Si un compte est associé à l'adresse ${cleanEmail}, vous allez recevoir un e-mail avec un lien pour réinitialiser votre mot de passe.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!password || !confirmPassword) {
      setErrorMsg('Veuillez saisir et confirmer votre nouveau mot de passe.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);

    try {
      const res = await updatePassword(password);
      if (res.error) {
        setErrorMsg(res.error.message);
      } else {
        clearPasswordRecovery();
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la mise à jour.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email) {
      setErrorMsg('Veuillez saisir votre adresse email pour renvoyer le lien.');
      return;
    }
    setResending(true);
    setErrorMsg(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await resendVerification(cleanEmail);
      if (res.error) {
        setErrorMsg(res.error.message);
      } else {
        setInfoMsg(`Un nouveau lien de validation a été envoyé à ${cleanEmail}.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'envoi.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="studio-login min-h-screen">
      <Header
        onHomeClick={onHomeClick}
        subtitle={t('Accès obligatoire par authentification')}
      />

      <section className="studio-login-hero"><span className="studio-eyebrow">{language === 'en' ? 'YOUR WRITING STUDIO' : 'VOTRE ATELIER D’ÉCRITURE'}</span><h1>{language === 'en' ? <>Find your words.<br/>At your own pace.</> : <>Les bons mots.<br/>À votre rythme.</>}</h1><p>{language === 'en' ? 'A quiet space to prepare for the TCF, refine your writing, and watch your progress take shape.' : 'Un espace calme pour préparer le TCF, affiner vos rédactions et voir vos progrès prendre forme.'}</p><div className="studio-hero-lines"><span>01 <strong>{language === 'en' ? 'Choose a topic' : 'Choisir un sujet'}</strong></span><span>02 <strong>{language === 'en' ? 'Write with intention' : 'Écrire avec intention'}</strong></span><span>03 <strong>{language === 'en' ? 'Learn from every session' : 'Apprendre de chaque séance'}</strong></span></div><span className="studio-login-caption">{language === 'en' ? 'ONE SESSION AT A TIME.' : 'UNE SÉANCE À LA FOIS.'}</span></section>
      <div className="studio-login-form max-w-md mx-auto w-full px-6 py-8 flex-1 flex flex-col justify-center">
        <div className="bg-white border border-white/80 rounded-2xl p-6 sm:p-8 ">
          
          {/* Mode Selector Tabs (Login / Register) */}
          {mode !== 'forgot' && mode !== 'recovery' && (
            <div className="flex border border-white/60 rounded-xl p-1.5 bg-white mb-6 ">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-blue-700  border border-white/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{t('Se connecter')}</span>
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-blue-700  border border-white/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{t('Créer un compte')}</span>
              </button>
            </div>
          )}

          {/* Header Icon & Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white text-blue-600 font-bold text-2xl mb-3  border border-white/80">
              {mode === 'register' && <span>✍️</span>}
              {mode === 'login' && <span>🔒</span>}
              {mode === 'forgot' && <span>🔑</span>}
              {mode === 'recovery' && <span>🛡️</span>}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {mode === 'register' && <span>{t('Créer un compte')}</span>}
              {mode === 'login' && <span>{t('Connexion candidat')}</span>}
              {mode === 'forgot' && <span>{t('Mot de passe oublié')}</span>}
              {mode === 'recovery' && <span>{t('Nouveau mot de passe')}</span>}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {mode === 'register' && (
                <span>{t('Créez votre compte unique. Une vérification par e-mail est obligatoire avant votre premier accès.')}</span>
              )}
              {mode === 'login' && (
                <span>{t('Connectez-vous avec votre adresse e-mail vérifiée pour accéder au simulateur TCF.')}</span>
              )}
              {mode === 'forgot' && (
                <span>{t('Saisissez votre adresse e-mail pour recevoir les instructions de réinitialisation.')}</span>
              )}
              {mode === 'recovery' && (
                <span>{t('Choisissez un mot de passe sécurisé pour réactiver l’accès à votre compte.')}</span>
              )}
            </p>
          </div>

          {infoMsg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs p-3.5 rounded font-medium leading-relaxed">
              <span>📬 {t(infoMsg)}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded font-medium leading-relaxed">
              ⚠️ {t(errorMsg)}
              {emailAlreadyExists && (
                <div className="mt-2 pt-2 border-t border-red-200">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                  >
                    {t('→ Cliquer ici pour vous connecter avec ce compte')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  {t('Adresse e-mail')}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidat.tcf@exemple.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    {t('Mot de passe')}
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-blue-700 hover:text-blue-900 font-medium underline cursor-pointer"
                  >
                    {t('Mot de passe oublié ?')}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-xs text-slate-700 font-medium cursor-pointer">
                  {t('Se souvenir de moi sur cet appareil')}
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm  hover:bg-blue-700 active:scale-[0.98] transition-all mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? t('Connexion en cours...') : t('Se connecter')}
              </button>
            </form>
          )}

          {/* 2. REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  {t('Nom complet / Prénom')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('ex. Jean Dupont')}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  {t('Adresse e-mail')}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidat.tcf@exemple.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  {t('Mot de passe')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="block text-[11px] text-slate-500 mt-1">
                  {t('Minimum 6 caractères')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  {t('Confirmer le mot de passe')}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="remember-me-reg"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me-reg" className="ml-2 block text-xs text-slate-700 font-medium cursor-pointer">
                  {t('Se souvenir de moi sur cet appareil')}
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm  hover:bg-blue-700 active:scale-[0.98] transition-all mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? t('Création en cours...') : t('Créer mon compte')}
              </button>
            </form>
          )}

          {/* 3. FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  {t('Adresse e-mail')}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidat.tcf@exemple.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm  hover:bg-blue-700 active:scale-[0.98] transition-all mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? t('Envoi en cours...') : t('Envoyer les instructions')}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium underline cursor-pointer"
                >
                  {t('← Retour à la connexion')}
                </button>
              </div>
            </form>
          )}

          {/* 4. RECOVERY (SET NEW PASSWORD) FORM */}
          {mode === 'recovery' && (
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  {t('Nouveau mot de passe')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="block text-[11px] text-slate-500 mt-1">
                  {t('Minimum 6 caractères')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  {t('Confirmer le mot de passe')}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm  hover:bg-emerald-700 active:scale-[0.98] transition-all mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? t('Enregistrement du mot de passe...') : t('Enregistrer le nouveau mot de passe')}
              </button>
            </form>
          )}

          {/* Resend email confirmation */}
          {showResend && mode !== 'forgot' && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resending}
                className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer disabled:opacity-50"
              >
                {resending ? t('Envoi en cours...') : t("Renvoyer l'e-mail de confirmation")}
              </button>
            </div>
          )}

          {/* Switch between Login and Register */}
          {mode !== 'forgot' && mode !== 'recovery' && (
            <div className="mt-6 pt-4 border-t border-slate-300/60 text-center">
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                {mode === 'register' ? (
                  <span>{t('Déjà un compte ? Se connecter')}</span>
                ) : (
                  <span>{t("Pas encore de compte ? S'inscrire")}</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className="mt-6 bg-white border border-white/80 rounded-2xl p-4 text-center ">
          <p className="text-xs text-blue-900 font-medium">
            🔒 <strong>1 compte = 1 adresse e-mail unique :</strong> {t("Vos rédactions et vos statistiques d'examen sont protégées de manière sécurisée et confidentielle.")}
          </p>
        </div>
      </div>

      <Footer onFeedbackClick={onFeedbackClick} />

      {/* Device Recommendation Modal for Mobile & Tablet Users */}
      <DeviceRecommendationModal />
    </div>
  );
};
