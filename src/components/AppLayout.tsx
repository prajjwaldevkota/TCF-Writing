import React, { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  BarChart3,
  Feather,
  Home,
  Library,
  Menu,
  NotebookPen,
  Settings2,
  X,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
export type AppView =
  | "home"
  | "library"
  | "templates"
  | "simulator"
  | "results"
  | "dashboard"
  | "notebook"
  | "settings"
  | "login";
export const AppLayout: React.FC<{
  view: AppView;
  onNavigate: (view: AppView) => void;
  children: React.ReactNode;
  name: string;
  hasDraft: boolean;
}> = ({ view, onNavigate, children, name, hasDraft }) => {
  const { language, setLanguage } = useLanguage();
  const en = language === "en";
  const [mobile, setMobile] = useState(false);
  const go = (next: AppView) => {
    onNavigate(next);
    setMobile(false);
  };
  const links = [
    { view: "home", icon: Home, label: en ? "Today" : "Aujourd’hui" },
    {
      view: "library",
      icon: Library,
      label: en ? "Practice library" : "S’entraîner",
    },
    {
      view: "templates",
      icon: BookOpen,
      label: en ? "Writing templates" : "Les modèles",
    },
    {
      view: "dashboard",
      icon: BarChart3,
      label: en ? "My progress" : "Ma progression",
    },
    {
      view: "notebook",
      icon: NotebookPen,
      label: en ? "My corrections" : "Mes corrections",
    },
  ] as const;
  const current =
    links.find((l) => l.view === view)?.label ||
    (view === "simulator"
      ? en
        ? "Writing workspace"
        : "Atelier de rédaction"
      : view === "results"
        ? en
          ? "Your review"
          : "Votre bilan"
        : en
          ? "Settings"
          : "Réglages");
  return (
    <div className="lab-shell">
      <a href="#main-content" className="skip-link">
        {en ? "Skip to content" : "Aller au contenu"}
      </a>
      {mobile && (
        <button
          className="lab-scrim"
          aria-label={en ? "Close menu" : "Fermer le menu"}
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`lab-sidebar ${mobile ? "open" : ""}`}>
        <button className="lab-brand" onClick={() => go("home")}>
          <span className="lab-brand-icon">
            <Feather size={24} />
          </span>
          <span>
            écriture<span>L’ATELIER TCF CANADA</span>
          </span>
        </button>
        <button
          className="lab-close-menu icon-button"
          onClick={() => setMobile(false)}
          aria-label={en ? "Close navigation" : "Fermer la navigation"}
        >
          <X size={20} />
        </button>
        <p className="nav-caption">{en ? "YOUR PRACTICE" : "VOTRE PRATIQUE"}</p>
        <nav aria-label={en ? "Main navigation" : "Navigation principale"}>
          {links.map(({ view: next, icon: Icon, label }) => (
            <button
              key={next}
              className={`lab-nav ${view === next || (view === "simulator" && next === "library") ? "active" : ""}`}
              onClick={() => go(next)}
              aria-current={view === next ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {next === "library" && hasDraft && (
                <i aria-label={en ? "Draft saved" : "Brouillon sauvegardé"} />
              )}
            </button>
          ))}
        </nav>
        <div className="goal-note">
          <span className="eyebrow">
            {en ? "YOUR NORTH STAR" : "VOTRE OBJECTIF"}
          </span>
          <div>
            NCLC <em>7</em>
            <ArrowUpRight size={23} />
          </div>
          <p>
            {en
              ? "Clear ideas. Precise French. One practice at a time."
              : "Des idées claires. Un français précis. Une séance à la fois."}
          </p>
          <span className="goal-note-rule" />
        </div>
        <div className="lab-sidebar-bottom">
          <button
            className={`lab-nav ${view === "settings" ? "active" : ""}`}
            onClick={() => go("settings")}
          >
            <Settings2 size={19} />
            <span>{en ? "Settings & AI" : "Réglages et IA"}</span>
          </button>
          <div className="lab-person">
            <span className="lab-avatar">{name.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{name}</strong>
              <small>
                {en ? "Personal writing space" : "Votre espace de rédaction"}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="lab-body">
        <header className="lab-topbar">
          <div className="row">
            <button
              className="lab-menu icon-button"
              aria-label={en ? "Open navigation" : "Ouvrir la navigation"}
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              {en ? "My workspace" : "Mon espace"}
              <span>/</span>
              <strong>{current}</strong>
            </span>
          </div>
          <div className="row">
            <span className="top-goal">
              <span /> Objectif NCLC 7
            </span>
            <div
              className="language-switch"
              aria-label={en ? "Interface language" : "Langue de l’interface"}
            >
              {(["fr", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  aria-pressed={language === l}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>
        <main
          id="main-content"
          className={`lab-main ${view === "simulator" ? "lab-main-editor" : ""}`}
          tabIndex={-1}
        >
          {children}
        </main>
        <footer className="lab-footer">
          <span>
            Écriture ·{" "}
            {en
              ? "A little French, every day."
              : "Un peu de français, chaque jour."}
          </span>
          <span>
            {en
              ? "Practice estimates. Official results come from the TCF."
              : "Estimations de pratique. Seul le TCF délivre un résultat officiel."}
          </span>
        </footer>
      </div>
    </div>
  );
};
