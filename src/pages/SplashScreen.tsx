import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Eye,
  EyeOff,
  Feather,
  Loader2,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

interface SplashScreenProps {
  onSuccess: () => void;
  onContinueGuest: () => void;
}

type AuthTab = "login" | "register" | "forgot" | "recovery";

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onSuccess,
  onContinueGuest,
}) => {
  const { language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const en = language === "en";
  const {
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    resendVerification,
    isPasswordRecovery,
    clearPasswordRecovery,
  } = useAuth();

  const [tab, setTab] = useState<AuthTab>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tcf_remembered_email");
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (isPasswordRecovery) {
      setTab("recovery");
      setErrorMsg(null);
      setInfoMsg(
        en
          ? "Choose a new password below to restore access to your account."
          : "Choisissez votre nouveau mot de passe ci-dessous pour réactiver votre accès.",
      );
    }
  }, [isPasswordRecovery, en]);

  const switchTab = (next: AuthTab) => {
    setTab(next);
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResend(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResend(false);

    if (!email || !password) {
      setErrorMsg(
        en
          ? "Enter your email address and password."
          : "Saisissez votre adresse e-mail et votre mot de passe.",
      );
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await signIn(cleanEmail, password);
      if (res.error) {
        const msg = res.error.message.toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
          setErrorMsg(
            en
              ? "Your email has not been confirmed yet. Open the activation link sent to your inbox."
              : "Votre adresse e-mail n’a pas encore été confirmée. Cliquez sur le lien reçu dans votre messagerie.",
          );
          setShowResend(true);
        } else if (
          msg.includes("invalid login credentials") ||
          msg.includes("invalid credentials")
        ) {
          setErrorMsg(
            en
              ? "Incorrect email or password."
              : "Adresse e-mail ou mot de passe incorrect.",
          );
        } else {
          setErrorMsg(res.error.message);
        }
      } else {
        try {
          if (rememberMe) localStorage.setItem("tcf_remembered_email", cleanEmail);
          else localStorage.removeItem("tcf_remembered_email");
        } catch {}
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          (en ? "Unable to sign in right now." : "Connexion impossible pour le moment."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResend(false);

    if (!fullName.trim() || !email || !password || !confirmPassword) {
      setErrorMsg(
        en
          ? "Complete all required fields."
          : "Renseignez tous les champs demandés.",
      );
      return;
    }

    if (password.length < 6) {
      setErrorMsg(
        en
          ? "Use at least 6 characters for your password."
          : "Votre mot de passe doit contenir au moins 6 caractères.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg(
        en
          ? "Passwords do not match."
          : "Les deux mots de passe ne correspondent pas.",
      );
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await signUp(cleanEmail, password, fullName.trim());
      if (res.error) {
        if (res.alreadyExists) {
          setErrorMsg(
            en
              ? "An account already exists for this email. Sign in below."
              : "Un compte existe déjà pour cette adresse. Connectez-vous ci-dessous.",
          );
          setTab("login");
        } else {
          setErrorMsg(res.error.message);
        }
      } else if (res.needsVerification) {
        setInfoMsg(
          en
            ? `Confirmation link sent to ${cleanEmail}. Verify your email before signing in.`
            : `Lien de validation envoyé à ${cleanEmail}. Confirmez votre adresse avant de vous connecter.`,
        );
        setShowResend(true);
        setTab("login");
        setPassword("");
        setConfirmPassword("");
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          (en ? "Account creation failed." : "La création du compte a échoué."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email) {
      setErrorMsg(
        en
          ? "Enter your email address first."
          : "Saisissez d’abord votre adresse e-mail.",
      );
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(email.trim().toLowerCase());
      if (res.error) {
        setErrorMsg(res.error.message);
      } else {
        setInfoMsg(
          en
            ? "If an account matches this email, a reset link is on its way."
            : "Si un compte correspond à cette adresse, un lien de réinitialisation vient d’être envoyé.",
        );
      }
    } catch (err: any) {
      setErrorMsg(
        err.message || (en ? "Request failed." : "La demande n’a pas abouti."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!password || !confirmPassword) {
      setErrorMsg(
        en
          ? "Enter and confirm your new password."
          : "Saisissez et confirmez votre nouveau mot de passe.",
      );
      return;
    }

    if (password.length < 6) {
      setErrorMsg(
        en
          ? "Use at least 6 characters for your new password."
          : "Le nouveau mot de passe doit contenir au moins 6 caractères.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg(
        en
          ? "Passwords do not match."
          : "Les deux mots de passe ne correspondent pas.",
      );
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
      setErrorMsg(
        err.message ||
          (en ? "Password update failed." : "La mise à jour du mot de passe a échoué."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="splash-shell">
      {/* Left Column: Studio Identity & Authentic Exam Specimen */}
      <section className="splash-showcase">
        <div className="splash-showcase-top">
          <div className="splash-brand">
            <span className="splash-brand-icon" aria-hidden="true">
              <Feather size={22} />
            </span>
            <div>
              <strong>écriture</strong>
              <span>L’atelier TCF Canada</span>
            </div>
          </div>
          <span className="splash-goal-pill">Objectif NCLC 7+</span>
        </div>

        <div className="splash-hero-copy">
          <p className="splash-kicker">
            {en
              ? "Expression écrite · Exam simulation & evidence-based review"
              : "Expression écrite · Simulation officielle et bilan étayé"}
          </p>
          <h1>
            {en
              ? "Practise TCF Canada writing in a quiet, realistic studio."
              : "Préparez l’écrit du TCF Canada dans le calme d’un vrai atelier."}
          </h1>
          <p className="splash-lead">
            {en
              ? "Work through real exam combinations under the 60-minute timer, then review quoted evidence, official length checks, and targeted rewrites."
              : "Travaillez sur des combinaisons réelles chronométrées sur 60 minutes, puis relisez vos phrases avec citations vérifiées, contrôle des longueurs et pistes de réécriture."}
          </p>
        </div>

        {/* Centerpiece: Official 3-Task Exam Sheet Specimen */}
        <div className="splash-specimen" aria-label={en ? "Exam format overview" : "Aperçu du format de l’épreuve"}>
          <div className="splash-specimen-head">
            <span>{en ? "Official 3-task structure" : "Structure officielle en 3 tâches"}</span>
            <span>
              <Clock3 size={13} aria-hidden="true" />
              60 min
            </span>
          </div>
          <ul className="splash-task-list">
            <li>
              <span className="splash-task-num">1</span>
              <div>
                <strong>{en ? "Message & practical details" : "Message et renseignements"}</strong>
                <small>{en ? "Clear purpose, adapted tone" : "Destinataire clair, registre adapté"}</small>
              </div>
              <span className="splash-word-pill">60–120 {en ? "words" : "mots"}</span>
            </li>
            <li>
              <span className="splash-task-num">2</span>
              <div>
                <strong>{en ? "Experience & personal view" : "Récit d’expérience et avis"}</strong>
                <small>{en ? "Structured account, concrete impressions" : "Narration structurée, impressions précises"}</small>
              </div>
              <span className="splash-word-pill">120–150 {en ? "words" : "mots"}</span>
            </li>
            <li>
              <span className="splash-task-num">3</span>
              <div>
                <strong>{en ? "Synthesis & reasoned argument" : "Synthèse et prise de position"}</strong>
                <small>{en ? "Two source texts compared in your words" : "Deux documents confrontés avec vos mots"}</small>
              </div>
              <span className="splash-word-pill">120–180 {en ? "words" : "mots"}</span>
            </li>
          </ul>
          <div className="splash-specimen-foot">
            <Check size={14} aria-hidden="true" />
            <span>
              {en
                ? "Spell-check locked in mock mode · French accent bar included · CEFR / NCLC feedback"
                : "Correcteur désactivé en examen blanc · Barre d’accents intégrée · Bilan CECRL / NCLC"}
            </span>
          </div>
        </div>

        <footer className="splash-showcase-foot">
          <span>
            <ShieldCheck size={14} aria-hidden="true" />
            {en
              ? "Drafts autosaved locally · Cloud sync with free account"
              : "Brouillons sauvegardés localement · Synchronisation cloud avec compte"}
          </span>
        </footer>
      </section>

      {/* Right Column: Controls & Authentication Sheet */}
      <main className="splash-auth-pane">
        <header className="splash-auth-topbar">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-pressed={theme === "dark"}
            aria-label={
              theme === "dark"
                ? en
                  ? "Switch to light mode"
                  : "Activer le mode clair"
                : en
                  ? "Switch to dark mode"
                  : "Activer le mode sombre"
            }
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span>
              {theme === "dark"
                ? en
                  ? "Light"
                  : "Clair"
                : en
                  ? "Dark"
                  : "Sombre"}
            </span>
          </button>

          <div
            className="language-switch"
            aria-label={en ? "Interface language" : "Langue de l’interface"}
          >
            {(["fr", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLanguage(l)}
                aria-pressed={language === l}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        <div className="splash-auth-card-wrap">
          <div className="splash-auth-card panel">
            <div className="splash-auth-header">
              <h2>
                {tab === "register"
                  ? en
                    ? "Create your account"
                    : "Créer votre compte"
                  : tab === "forgot"
                    ? en
                      ? "Reset your password"
                      : "Réinitialiser le mot de passe"
                    : tab === "recovery"
                      ? en
                        ? "Set a new password"
                        : "Choisir un nouveau mot de passe"
                      : en
                        ? "Sign in to your workspace"
                        : "Accéder à votre espace"}
              </h2>
              <p>
                {tab === "register"
                  ? en
                    ? "Unlock AI pedagogical reviews, NCLC estimates, and cloud backup across devices."
                    : "Débloquez les bilans pédagogiques IA, l’estimation NCLC et la synchronisation de vos séances."
                  : tab === "forgot"
                    ? en
                      ? "Enter your email address to receive a password reset link."
                      : "Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation."
                    : tab === "recovery"
                      ? en
                        ? "Enter a new password of at least 6 characters."
                        : "Saisissez un nouveau mot de passe d’au moins 6 caractères."
                      : en
                        ? "Sign in to generate AI reviews and sync your saved writing."
                        : "Connectez-vous pour obtenir vos bilans IA et synchroniser vos rédactions."}
              </p>
            </div>

            {tab !== "forgot" && tab !== "recovery" && (
              <div className="segmented splash-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "login"}
                  aria-pressed={tab === "login"}
                  onClick={() => switchTab("login")}
                >
                  {en ? "Sign in" : "Connexion"}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "register"}
                  aria-pressed={tab === "register"}
                  onClick={() => switchTab("register")}
                >
                  {en ? "Create account" : "Créer un compte"}
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="notice warning splash-feedback" role="alert">
                <div>
                  <p>{errorMsg}</p>
                  {showResend && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={async () => {
                        if (!email) return;
                        await resendVerification(email.trim().toLowerCase());
                        setInfoMsg(
                          en
                            ? "Confirmation email sent again."
                            : "E-mail de confirmation renvoyé.",
                        );
                      }}
                    >
                      {en
                        ? "Resend confirmation email"
                        : "Renvoyer l’e-mail de confirmation"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {infoMsg && (
              <div className="notice success splash-feedback" role="status">
                <Check size={17} />
                <p>{infoMsg}</p>
              </div>
            )}

            {tab === "login" && (
              <form onSubmit={handleLogin} className="splash-form">
                <label className="splash-field">
                  <span>{en ? "Email address" : "Adresse e-mail"}</span>
                  <div className="splash-input-wrap">
                    <Mail size={16} aria-hidden="true" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </label>

                <div className="splash-field">
                  <div className="row between">
                    <label htmlFor="splash-login-password">
                      {en ? "Password" : "Mot de passe"}
                    </label>
                    <button
                      type="button"
                      className="splash-inline-link"
                      onClick={() => switchTab("forgot")}
                    >
                      {en ? "Forgot password?" : "Mot de passe oublié ?"}
                    </button>
                  </div>
                  <div className="splash-input-wrap">
                    <Lock size={16} aria-hidden="true" />
                    <input
                      id="splash-login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="splash-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword
                          ? en
                            ? "Hide password"
                            : "Masquer le mot de passe"
                          : en
                            ? "Show password"
                            : "Afficher le mot de passe"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>
                    {en ? "Remember my email on this device" : "Mémoriser mon adresse sur cet appareil"}
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="button primary full-width"
                >
                  {loading && <Loader2 size={16} className="spin" />}
                  <span>{en ? "Sign in" : "Se connecter"}</span>
                </button>
              </form>
            )}

            {tab === "register" && (
              <form onSubmit={handleRegister} className="splash-form">
                <label className="splash-field">
                  <span>{en ? "Full name" : "Nom complet"}</span>
                  <div className="splash-input-wrap">
                    <UserIcon size={16} aria-hidden="true" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={en ? "Camille Tremblay" : "Camille Tremblay"}
                      autoComplete="name"
                      required
                    />
                  </div>
                </label>

                <label className="splash-field">
                  <span>{en ? "Email address" : "Adresse e-mail"}</span>
                  <div className="splash-input-wrap">
                    <Mail size={16} aria-hidden="true" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </label>

                <label className="splash-field">
                  <span>
                    {en
                      ? "Password (6 characters minimum)"
                      : "Mot de passe (6 caractères minimum)"}
                  </span>
                  <div className="splash-input-wrap">
                    <Lock size={16} aria-hidden="true" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="splash-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword
                          ? en
                            ? "Hide password"
                            : "Masquer le mot de passe"
                          : en
                            ? "Show password"
                            : "Afficher le mot de passe"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <label className="splash-field">
                  <span>{en ? "Confirm password" : "Confirmer le mot de passe"}</span>
                  <div className="splash-input-wrap">
                    <Lock size={16} aria-hidden="true" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="button primary full-width"
                >
                  {loading && <Loader2 size={16} className="spin" />}
                  <span>{en ? "Create account" : "Créer mon compte"}</span>
                </button>
              </form>
            )}

            {tab === "forgot" && (
              <form onSubmit={handleForgot} className="splash-form">
                <label className="splash-field">
                  <span>{en ? "Email address" : "Adresse e-mail"}</span>
                  <div className="splash-input-wrap">
                    <Mail size={16} aria-hidden="true" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="button primary full-width"
                >
                  {loading && <Loader2 size={16} className="spin" />}
                  <span>{en ? "Send reset link" : "Envoyer le lien"}</span>
                </button>

                <button
                  type="button"
                  className="button secondary full-width"
                  onClick={() => switchTab("login")}
                >
                  {en ? "Back to sign in" : "Retour à la connexion"}
                </button>
              </form>
            )}

            {tab === "recovery" && (
              <form onSubmit={handleRecovery} className="splash-form">
                <label className="splash-field">
                  <span>{en ? "New password" : "Nouveau mot de passe"}</span>
                  <div className="splash-input-wrap">
                    <Lock size={16} aria-hidden="true" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="splash-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword
                          ? en
                            ? "Hide password"
                            : "Masquer le mot de passe"
                          : en
                            ? "Show password"
                            : "Afficher le mot de passe"
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <label className="splash-field">
                  <span>{en ? "Confirm new password" : "Confirmer le nouveau mot de passe"}</span>
                  <div className="splash-input-wrap">
                    <Lock size={16} aria-hidden="true" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="button primary full-width"
                >
                  {loading && <Loader2 size={16} className="spin" />}
                  <span>{en ? "Save new password" : "Enregistrer le mot de passe"}</span>
                </button>
              </form>
            )}

            {tab !== "recovery" && (
              <div className="splash-guest-block">
                <div className="splash-divider">
                  <span>{en ? "or practise without signing in" : "ou pratiquer sans compte"}</span>
                </div>

                <button
                  type="button"
                  onClick={onContinueGuest}
                  className="button secondary full-width"
                >
                  <span>
                    {en ? "Continue in guest mode" : "Continuer en mode invité"}
                  </span>
                  <ArrowRight size={16} />
                </button>

                <p className="splash-guest-note">
                  <Lock size={12} aria-hidden="true" />
                  <span>
                    {en
                      ? "All writing topics & mock timer included · Free account required for AI review"
                      : "Sujets et examen blanc inclus · Compte gratuit requis pour le bilan IA"}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
