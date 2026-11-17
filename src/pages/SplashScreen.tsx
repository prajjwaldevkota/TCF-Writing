import React, { useState, useEffect } from "react";
import {
  Clock,
  Sparkles,
  BookOpen,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  User as UserIcon,
  ShieldCheck,
  Globe2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

interface SplashScreenProps {
  onSuccess: () => void;
  onContinueGuest: () => void;
}

type AuthTab = "login" | "register" | "forgot";

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onSuccess,
  onContinueGuest,
}) => {
  const { language, setLanguage } = useLanguage();
  const en = language === "en";
  const {
    signIn,
    signUp,
    resetPassword,
    resendVerification,
    isConfigured,
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

  // Load remembered email
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tcf_remembered_email");
      if (saved) {
        setEmail(saved);
      }
    } catch {}
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResend(false);

    if (!email || !password) {
      setErrorMsg(
        en
          ? "Please provide your email and password."
          : "Veuillez renseigner votre adresse e-mail et votre mot de passe.",
      );
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await signIn(cleanEmail, password);
      if (res.error) {
        const msg = res.error.message.toLowerCase();
        if (
          msg.includes("email not confirmed") ||
          msg.includes("not confirmed")
        ) {
          setErrorMsg(
            en
              ? "Your email has not been confirmed yet. Please check your inbox for the activation link."
              : "Votre adresse e-mail n'a pas encore été confirmée. Veuillez vérifier votre boîte de réception.",
          );
          setShowResend(true);
        } else if (
          msg.includes("invalid login credentials") ||
          msg.includes("invalid credentials")
        ) {
          setErrorMsg(
            en
              ? "Incorrect credentials. Please check your email and password."
              : "Identifiants incorrects. Veuillez vérifier votre adresse e-mail et votre mot de passe.",
          );
        } else {
          setErrorMsg(res.error.message);
        }
      } else {
        if (rememberMe) {
          localStorage.setItem("tcf_remembered_email", cleanEmail);
        } else {
          localStorage.removeItem("tcf_remembered_email");
        }
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || (en ? "An unexpected error occurred." : "Une erreur inattendue est survenue."));
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
          ? "Please fill in all required fields."
          : "Veuillez renseigner tous les champs obligatoires.",
      );
      return;
    }

    if (password.length < 6) {
      setErrorMsg(
        en
          ? "Password must be at least 6 characters."
          : "Le mot de passe doit comporter au moins 6 caractères.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg(
        en
          ? "Passwords do not match."
          : "Les mots de passe ne correspondent pas.",
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
              ? "An account with this email already exists. Please sign in."
              : "Un compte existe déjà avec cette adresse. Veuillez vous connecter.",
          );
          setTab("login");
        } else {
          setErrorMsg(res.error.message);
        }
      } else if (res.needsVerification) {
        setInfoMsg(
          en
            ? `A confirmation link was sent to ${cleanEmail}. Please check your inbox and confirm your email before signing in.`
            : `Un lien de confirmation a été envoyé à ${cleanEmail}. Cliquez sur le lien pour valider votre compte.`,
        );
        setShowResend(true);
        setTab("login");
        setPassword("");
        setConfirmPassword("");
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || (en ? "Registration failed." : "L'inscription a échoué."));
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
          ? "Please enter your email address."
          : "Veuillez saisir votre adresse e-mail.",
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
            ? "A password reset link has been sent to your email address."
            : "Un lien de réinitialisation vous a été envoyé par e-mail.",
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || (en ? "Request failed." : "La demande a échoué."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <span className="text-2xl" role="img" aria-label="Canada">
            🍁
          </span>
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              TCF Canada
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Writing Lab
              </span>
            </h1>
          </div>
        </div>

        <button
          onClick={() => setLanguage(en ? "fr" : "en")}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/60 transition-colors"
        >
          <Globe2 size={14} />
          <span>{en ? "Français" : "English"}</span>
        </button>
      </header>

      {/* Main Hero & Auth Split */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 sm:py-12 grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left Column: Hero & Value Proposition */}
        <section className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold">
            <span>🎯</span>
            <span>
              {en
                ? "Target NCLC 7+ (B2/C1) for Canadian Express Entry"
                : "Objectif NCLC 7+ (B2/C1) pour l'Entrée Express"}
            </span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.15]">
            {en ? (
              <>
                Master TCF Canada Writing in{" "}
                <span className="text-blue-400">real exam conditions</span>.
              </>
            ) : (
              <>
                Maîtrisez l'Expression Écrite du TCF dans les{" "}
                <span className="text-blue-400">conditions réelles</span>.
              </>
            )}
          </h2>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
            {en
              ? "The dedicated preparation environment for Canadian immigration: official 60-minute simulation, daily synced past topics, and deep pedagogical feedback powered by AI."
              : "La plateforme d'entraînement dédiée à l'immigration canadienne : simulation officielle 60 minutes, sujets d'examen synchronisés quotidiennement et bilans pédagogiques basés sur le CECRL."}
          </p>

          {/* Key Feature Pillars */}
          <div className="grid sm:grid-cols-3 gap-4 pt-4">
            <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Clock size={18} />
              </div>
              <h3 className="font-bold text-sm text-white">
                {en ? "60-Min Mock Exam" : "Examen Blanc 60 min"}
              </h3>
              <p className="text-xs text-slate-400 leading-normal">
                {en
                  ? "All 3 tasks chained with real test center constraints (spell-check locked)."
                  : "Les 3 tâches enchaînées en conditions réelles avec gestion libre du temps."}
              </p>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <h3 className="font-bold text-sm text-white">
                {en ? "Pedagogical AI" : "Bilan Pédagogique IA"}
              </h3>
              <p className="text-xs text-slate-400 leading-normal">
                {en
                  ? "Evidence-based CEFR analysis, word-count penalty checks, and Level-Up toolbox."
                  : "Citations vérifiées, contrôle des pénalités de longueur et boîte à outils B2/C1."}
              </p>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <BookOpen size={18} />
              </div>
              <h3 className="font-bold text-sm text-white">
                {en ? "Daily Topic Sync" : "Sujets Actualisés"}
              </h3>
              <p className="text-xs text-slate-400 leading-normal">
                {en
                  ? "Daily automated GitHub sync of real exam questions categorized by themes."
                  : "Banque authentique de sujets récents classés par thématiques d'examen."}
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: Auth Card */}
        <section className="lg:col-span-5">
          <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl">
            {/* Tab Switcher */}
            <div className="flex rounded-xl bg-slate-900/80 p-1 mb-6 border border-slate-700/50">
              <button
                type="button"
                onClick={() => {
                  setTab("login");
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  tab === "login"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {en ? "Sign In" : "Connexion"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("register");
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  tab === "register"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {en ? "Create Account" : "Créer un compte"}
              </button>
            </div>

            {/* Error or Info Feedback */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                {errorMsg}
                {showResend && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) return;
                      await resendVerification(email.trim().toLowerCase());
                      setInfoMsg(
                        en
                          ? "Confirmation email resent."
                          : "E-mail de confirmation renvoyé.",
                      );
                    }}
                    className="block mt-2 underline font-semibold text-red-200"
                  >
                    {en
                      ? "Resend confirmation email"
                      : "Renvoyer l'e-mail de confirmation"}
                  </button>
                )}
              </div>
            )}
            {infoMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed">
                {infoMsg}
              </div>
            )}

            {/* Login Form */}
            {tab === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {en ? "Email Address" : "Adresse e-mail"}
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      required
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      {en ? "Password" : "Mot de passe"}
                    </label>
                    <button
                      type="button"
                      onClick={() => setTab("forgot")}
                      className="text-[11px] text-blue-400 hover:underline"
                    >
                      {en ? "Forgot password?" : "Mot de passe oublié ?"}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                  />
                  <label htmlFor="remember" className="text-xs text-slate-400">
                    {en ? "Remember me on this browser" : "Se souvenir de moi"}
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md mt-2"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  <span>{en ? "Sign In" : "Se connecter"}</span>
                </button>
              </form>
            )}

            {/* Registration Form */}
            {tab === "register" && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {en ? "Full Name" : "Nom complet"}
                  </label>
                  <div className="relative">
                    <UserIcon
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Marie Curie"
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {en ? "Email Address" : "Adresse e-mail"}
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {en ? "Password (min. 6 characters)" : "Mot de passe (min. 6 car.)"}
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-10 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {en ? "Confirm Password" : "Confirmer le mot de passe"}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md mt-1"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  <span>{en ? "Create My Account" : "Créer mon compte"}</span>
                </button>
              </form>
            )}

            {/* Forgot Password */}
            {tab === "forgot" && (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-xs text-slate-400">
                  {en
                    ? "Enter your email address and we will send you a reset link."
                    : "Saisissez votre e-mail pour recevoir un lien de réinitialisation."}
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {en ? "Email Address" : "Adresse e-mail"}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    required
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-900/80 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  <span>{en ? "Send Reset Link" : "Envoyer le lien"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className="w-full text-center text-xs text-slate-400 hover:text-white pt-1"
                >
                  {en ? "Back to Sign In" : "Retour à la connexion"}
                </button>
              </form>
            )}

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800 px-3 text-slate-500 font-bold">
                  {en ? "or" : "ou"}
                </span>
              </div>
            </div>

            {/* Guest Action */}
            <button
              type="button"
              onClick={onContinueGuest}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-slate-600/70 text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <span>{en ? "Continue as Guest" : "Continuer en mode invité"}</span>
              <ArrowRight size={15} />
            </button>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              {en
                ? "Free practice mode · Account required to unlock AI evaluation"
                : "Mode pratique libre · Compte requis pour débloquer l'évaluation IA"}
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-slate-800/80 max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <p>
          © {new Date().getFullYear()} TCF Canada Writing Simulator · All rights
          reserved.
        </p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500" />
            {en ? "Safe Local Storage" : "Stockage local sécurisé"}
          </span>
          <span>·</span>
          <span>CEFR / NCLC Benchmark</span>
        </div>
      </footer>
    </div>
  );
};
