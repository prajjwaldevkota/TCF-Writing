import { useWorkspace } from "../context/WorkspaceContext";
import { ErrorLogPanel } from "../components/ErrorLogPanel";
import React, { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  KeyRound,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { getGeminiModel } from "../utils/geminiSettings";

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
  const { createBackup, importBackup } = useWorkspace();
  const { language, setLanguage } = useLanguage();
  const { user, isConfigured, signOut, isAdmin } = useAuth();
  const en = language === "en";
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);
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
          <h1>{en ? "Workspace settings" : "Réglages de l’atelier"}</h1>
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
            ? "Writing feedback uses the app’s secure server connection. You do not need to enter or save an API key in this browser."
            : "La correction utilise la connexion sécurisée du serveur. Vous n’avez aucune clé API à saisir ou à enregistrer dans ce navigateur."}
        </p>
        <div className="gemini-model-setting">
          <strong>
            {en ? "Automatic Gemini model" : "Modèle Gemini automatique"}
          </strong>
          <p>{getGeminiModel()}</p>
          <p className="footnote">
            {en
              ? "Every task starts with Hydrogen by default. Flash-Lite fallback reviews provide feedback only. A deployment model override applies to all tasks. A model availability error, quota error or temporary unavailability triggers the next model. No manual selection is needed. The model used is shown on your review."
              : "Tous les bilans commencent par Hydrogen par défaut. Un bilan de secours Flash-Lite fournit des observations sans niveau. Un modèle configuré sur le serveur s’applique à toutes les tâches. Une erreur d’accès au modèle, de quota ou d’indisponibilité temporaire déclenche le modèle suivant. Aucun choix manuel n’est nécessaire. Le modèle utilisé figure sur votre bilan."}
          </p>
          <a
            className="text-button"
            href="https://ai.google.dev/gemini-api/docs/pricing"
            target="_blank"
            rel="noreferrer"
          >
            {en ? "Check free tiers" : "Consulter les quotas gratuits"}
            <ArrowRight size={13} />
          </a>
        </div>
        <p className="notice">
          {en
            ? "Quotas belong to Google projects, not API keys. A second key from the same project does not add free quota. The backup is tried at most once per model after a supported HTTP error; timeouts and invalid assessments are not retried automatically."
            : "Les quotas dépendent du projet Google, pas de la clé. Une seconde clé du même projet n’ajoute pas de quota gratuit. La clé de secours est essayée une seule fois par modèle après une erreur HTTP prise en charge ; les délais dépassés et les bilans invalides ne déclenchent pas de nouvel appel automatique."}
        </p>
      </section>
      {isAdmin && <ErrorLogPanel />}
      <section className="panel settings-section">
        <div className="section-head">
          <h2>{en ? "Your practice data" : "Vos données de pratique"}</h2>
          <ShieldCheck size={21} />
        </div>
        <p>
          {en
            ? "Backups include writing, the current draft and learning progress from this workspace. Importing a backup adds its contents here."
            : "Les sauvegardes incluent les rédactions, le brouillon et la progression de cet espace. Importer une sauvegarde ajoute son contenu ici."}
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
                ? "Your writing and learning progress sync with your account. Drafts stay on this device."
                : "Vos rédactions et votre progression sont synchronisées avec votre compte. Les brouillons restent sur cet appareil."
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
              <button
                className="text-button"
                onClick={() => {
                  try {
                    sessionStorage.removeItem("tcf_splash_dismissed");
                  } catch {}
                  void signOut();
                }}
              >
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
