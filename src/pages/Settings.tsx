import React, { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { getGeminiApiKey, setGeminiApiKey } from "../services/geminiEvaluator";
import { getGroqApiKey, setGroqApiKey } from "../services/groqEvaluator";
import { createBackup, importBackup } from "../utils/backup";
export function Settings({
  onLogin,
  onDataChange,
  onSync,
  syncStatus,
}: {
  onLogin: () => void;
  onDataChange: () => void;
  onSync: () => Promise<void>;
  syncStatus: string;
}) {
  const { language, setLanguage } = useLanguage();
  const { user, isConfigured, signOut } = useAuth();
  const en = language === "en";
  const [gemini, setGemini] = useState(
    () => localStorage.getItem("tcf_gemini_api_key") || "",
  );
  const [groq, setGroq] = useState(
    () => localStorage.getItem("tcf_groq_api_key") || "",
  );
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);
  const save = () => {
    try {
      setGeminiApiKey(gemini);
      setGroqApiKey(groq);
      setError(false);
      setNotice(
        en
          ? "AI settings saved in this browser."
          : "Réglages IA sauvegardés dans ce navigateur.",
      );
    } catch {
      setError(true);
      setNotice(
        en
          ? "Settings could not be saved. Check browser storage."
          : "Réglages non enregistrés. Vérifiez le stockage du navigateur.",
      );
    }
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(createBackup(), null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `ecriture-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  const restore = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 15_000_000)
        throw new Error(
          en
            ? "The backup is too large (15 MB maximum)."
            : "Sauvegarde trop volumineuse (15 Mo maximum).",
        );
      const count = importBackup(JSON.parse(await file.text()));
      onDataChange();
      setError(false);
      setNotice(
        en
          ? `Backup imported. ${count} saved sessions available.`
          : `Sauvegarde importée. ${count} séances disponibles.`,
      );
    } catch (e) {
      setError(true);
      setNotice(e instanceof Error ? e.message : "Import failed.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <div className="page-enter settings-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {en ? "MAKE THIS SPACE YOURS" : "VOTRE ESPACE, À VOTRE MESURE"}
          </p>
          <h1>
            {en
              ? "A few things behind the scenes."
              : "Quelques réglages, tout simplement."}
          </h1>
          <p>
            {en
              ? "Connect feedback, choose your language, and keep a copy of your work."
              : "Configurez la correction, choisissez votre langue et gardez une copie de votre travail."}
          </p>
        </div>
      </div>
      {notice && (
        <div
          className={`notice ${error ? "warning" : "success"}`}
          role="status"
        >
          {error ? null : <Check size={18} />}
          <span>{notice}</span>
        </div>
      )}
      <section className="panel settings-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {en ? "WRITING FEEDBACK" : "CORRECTION DES RÉDACTIONS"}
            </span>
            <h2>{en ? "Your AI connections" : "Vos connexions IA"}</h2>
          </div>
          <KeyRound size={21} />
        </div>
        <p>
          {en
            ? "Gemini is the default reviewer. Groq is optional and runs only when you ask for a second opinion. Practising and reviewing saved corrections always work without an API key."
            : "Gemini est le correcteur par défaut. Groq est facultatif et s’exécute seulement si vous demandez un second avis. La rédaction et la révision de vos corrections enregistrées fonctionnent sans clé API."}
        </p>
        <div className="key-fields">
          <div>
            <div className="row between">
              <h3>Google Gemini</h3>
              <span
                className={`badge ${getGeminiApiKey() ? "sage" : "neutral"}`}
              >
                {getGeminiApiKey()
                  ? en
                    ? "Key configured"
                    : "Clé configurée"
                  : en
                    ? "Not configured"
                    : "Non configurée"}
              </span>
            </div>
            <p className="footnote">
              {import.meta.env.VITE_GEMINI_MODEL || "gemini-3.1-flash-lite"}
            </p>
            <label className="field-label">
              {en ? "Your Gemini API key" : "Votre clé API Gemini"}
              <input
                autoComplete="off"
                type={show ? "text" : "password"}
                value={gemini}
                onChange={(e) => setGemini(e.target.value)}
                placeholder={
                  import.meta.env.VITE_GEMINI_API_KEY
                    ? en
                      ? "Deployment key configured"
                      : "Clé du déploiement configurée"
                    : "AIza…"
                }
              />
            </label>
            <a
              className="text-button"
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
            >
              {en ? "Get a Gemini key" : "Obtenir une clé Gemini"}
              <ArrowRight size={13} />
            </a>
          </div>
          <div>
            <div className="row between">
              <h3>
                Groq <small>{en ? "optional" : "facultatif"}</small>
              </h3>
              <span className={`badge ${getGroqApiKey() ? "sage" : "neutral"}`}>
                {getGroqApiKey()
                  ? en
                    ? "Key configured"
                    : "Clé configurée"
                  : en
                    ? "Not configured"
                    : "Non configurée"}
              </span>
            </div>
            <p className="footnote">
              {import.meta.env.VITE_GROQ_MODEL || "openai/gpt-oss-120b"}
            </p>
            <label className="field-label">
              {en ? "Your Groq API key" : "Votre clé API Groq"}
              <input
                autoComplete="off"
                type={show ? "text" : "password"}
                value={groq}
                onChange={(e) => setGroq(e.target.value)}
                placeholder={
                  import.meta.env.VITE_GROQ_API_KEY
                    ? en
                      ? "Deployment key configured"
                      : "Clé du déploiement configurée"
                    : "gsk_…"
                }
              />
            </label>
            <a
              className="text-button"
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
            >
              {en ? "Get a Groq key" : "Obtenir une clé Groq"}
              <ArrowRight size={13} />
            </a>
          </div>
        </div>
        <div className="row between wrap">
          <button className="text-button" onClick={() => setShow(!show)}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}{" "}
            {en
              ? show
                ? "Hide keys"
                : "Show keys"
              : show
                ? "Masquer les clés"
                : "Afficher les clés"}
          </button>
          <button className="button primary" onClick={save}>
            {en ? "Save AI settings" : "Enregistrer les réglages IA"}
          </button>
        </div>
        <p className="footnote">
          {en
            ? "Keys you enter are stored in this browser. Your response and prompt are sent to the selected provider when you request a review. Keep this browser profile private."
            : "Les clés saisies sont conservées dans ce navigateur. Votre réponse et la consigne sont envoyées au fournisseur choisi quand vous demandez un bilan. Gardez ce profil de navigateur privé."}
        </p>
      </section>
      <section className="panel settings-section">
        <div className="section-head">
          <h2>{en ? "Your practice data" : "Vos données de pratique"}</h2>
          <ShieldCheck size={21} />
        </div>
        <p>
          {en
            ? "Your finished work and unfinished session are saved in this browser. Export regularly if you use local mode or plan to switch devices. Backups do not contain API keys."
            : "Vos rédactions et votre séance en cours sont enregistrées dans ce navigateur. Exportez-les régulièrement en mode local ou avant de changer d’appareil. Les sauvegardes ne contiennent pas de clés API."}
        </p>
        <div className="row wrap">
          <button className="button secondary" onClick={exportData}>
            <Download size={16} />
            {en ? "Export my writing" : "Exporter mes rédactions"}
          </button>
          <button
            className="button secondary"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} />
            {en ? "Import a backup" : "Importer une sauvegarde"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void restore(e.target.files?.[0])}
          />
        </div>
      </section>
      <section className="panel settings-section">
        <div className="section-head">
          <h2>{en ? "Language & account" : "Langue et compte"}</h2>
        </div>
        <label className="field-label">
          {en
            ? "Interface and new feedback language"
            : "Langue de l’interface et des nouveaux bilans"}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "fr")}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </label>
        <div className="account-settings">
          <strong>
            {user?.email || (en ? "Local workspace" : "Espace local")}
          </strong>
          <p>
            {user
              ? en
                ? "New writing is saved locally first. Use account sync to retrieve cloud submissions."
                : "Les nouveaux textes sont d’abord enregistrés localement. La synchronisation du compte récupère les rédactions du cloud."
              : en
                ? "An account is optional. You can practise and save your work on this device."
                : "Le compte est facultatif. Vous pouvez vous entraîner et conserver votre travail sur cet appareil."}
          </p>
          {user ? (
            <div className="row wrap">
              <button
                className="button secondary"
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true);
                  try {
                    await onSync();
                  } finally {
                    setSyncing(false);
                  }
                }}
              >
                {syncing
                  ? en
                    ? "Syncing…"
                    : "Synchronisation…"
                  : en
                    ? "Sync my account"
                    : "Synchroniser mon compte"}
              </button>
              <button className="text-button" onClick={() => void signOut()}>
                {en ? "Sign out" : "Se déconnecter"}
              </button>
            </div>
          ) : isConfigured ? (
            <button className="button secondary" onClick={onLogin}>
              {en ? "Sign in to my account" : "Me connecter à mon compte"}
              <ArrowRight size={15} />
            </button>
          ) : null}
          {syncStatus && (
            <p className="footnote" role="status">
              {syncStatus}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
