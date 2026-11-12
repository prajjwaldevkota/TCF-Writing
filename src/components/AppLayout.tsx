import React, { useState } from 'react';
import { BookOpen, BarChart3, NotebookPen, Settings2, LogOut, ArrowUpRight, PenLine, X, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserProfileModal } from './UserProfileModal';

export type AppView = 'home' | 'dashboard' | 'simulator' | 'results' | 'feedback';
interface AppLayoutProps {
 currentView: AppView; title?: string; subtitle?: string; combinationTitle?: string;
 onNavigateHome: () => void; onNavigateDashboard: () => void; onNavigateMistakes?: () => void;
 mistakesCount?: number; isMistakesTabActive?: boolean; onNavigateFeedback: () => void;
 onStartNewExam?: () => void; onSignOut: () => void; submissionsCount?: number; children: React.ReactNode;
}
export const AppLayout: React.FC<AppLayoutProps> = (props) => {
 const { user, userName } = useAuth();
 const { language, setLanguage } = useLanguage();
 const [profile, setProfile] = useState(false);
 const [mobile, setMobile] = useState(false);
 const en = language === 'en';
 const name = userName || user?.email?.split('@')[0] || 'Étudiant';
 const go = (action: () => void) => {
  if (props.currentView === 'simulator' && !window.confirm(en ? 'Leave this session? Unsaved writing may be lost.' : 'Quitter la session ? Votre rédaction non enregistrée pourrait être perdue.')) return;
  setMobile(false); action();
 };
 const links = [
  {label: en ? 'Overview' : 'Vue d’ensemble', icon: BarChart3, active: props.currentView === 'dashboard' && !props.isMistakesTabActive, action: props.onNavigateDashboard, count: props.submissionsCount},
  {label: en ? 'Practice library' : 'Bibliothèque', icon: BookOpen, active: props.currentView === 'home' || props.currentView === 'simulator', action: props.onNavigateHome},
  {label: en ? 'Learning notebook' : 'Carnet de progrès', icon: NotebookPen, active: !!props.isMistakesTabActive, action: props.onNavigateMistakes || props.onNavigateDashboard, count: props.mistakesCount},
 ];
 const title = props.title || (props.currentView === 'home' ? (en ? 'Your next practice starts here.' : 'Votre prochaine étape commence ici.') : props.currentView === 'dashboard' ? (en ? 'A little progress, every day.' : 'Un peu de progrès, chaque jour.') : props.currentView === 'simulator' ? (en ? 'Make room for your words.' : 'Place à vos mots.') : props.currentView === 'results' ? (en ? 'Reflect. Refine. Repeat.' : 'Relire. Affiner. Progresser.') : (en ? 'Your private workspace' : 'Votre espace personnel'));
 return <div className="studio-shell">
  {mobile && <button className="studio-scrim" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
  <aside className={`studio-sidebar ${mobile ? 'is-open' : ''}`}>
   <button className="studio-brand" onClick={()=>go(props.onNavigateHome)}><span className="studio-mark"><PenLine size={22}/></span><span>Écriture<span className="studio-brand-sub">TCF PRACTICE STUDIO</span></span></button>
   <button className="studio-mobile-close" aria-label="Close navigation" onClick={()=>setMobile(false)}><X size={20}/></button>
   <p className="studio-nav-label">{en ? 'YOUR WORKSPACE' : 'VOTRE ESPACE'}</p>
   <nav className="studio-navigation" aria-label={en ? 'Main navigation' : 'Navigation principale'}>{links.map(({label,icon:Icon,active,action,count})=><button key={label} onClick={()=>go(action)} className={`studio-nav-item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}><Icon size={19}/><span>{label}</span>{count !== undefined && <small>{count}</small>}</button>)}</nav>
   <div className="studio-tip"><span className="studio-eyebrow">{en ? 'A MOMENT FOR FRENCH' : 'UN MOMENT POUR LE FRANÇAIS'}</span><p>{en ? 'Small sessions. Lasting confidence.' : 'De petites séances. Une confiance durable.'}</p><button onClick={()=>go(props.onNavigateHome)}>{en ? 'Start writing' : 'Commencer à écrire'}<ArrowUpRight size={17}/></button></div>
   <div className="studio-account"><button onClick={()=>setProfile(true)} className="studio-profile"><span className="studio-avatar">{name.charAt(0).toUpperCase()}</span><span><strong>{name}</strong><small>{en ? 'Personal workspace' : 'Espace personnel'}</small></span><Settings2 size={16}/></button><button className="studio-signout" onClick={()=>go(props.onSignOut)}><LogOut size={16}/>{en ? 'Sign out' : 'Déconnexion'}</button></div>
  </aside>
  <div className="studio-body">
   <header className="studio-topbar"><div className="flex items-center gap-3"><button className="studio-mobile-toggle" onClick={()=>setMobile(true)} aria-label="Open navigation"><Menu size={21}/></button><span className="studio-breadcrumb">{en ? 'Workspace' : 'Espace personnel'}<span>/</span>{en ? (props.currentView === 'home' ? 'Practice' : props.currentView) : ({home:'Entraînement',dashboard:'Progression',simulator:'Rédaction',results:'Bilan',feedback:'Notes'}[props.currentView])}</span></div><div className="studio-languages" aria-label="Language">{(['fr','en'] as const).map(l=><button key={l} aria-pressed={language===l} onClick={()=>setLanguage(l)} className={language===l?'is-active':''}>{l.toUpperCase()}</button>)}</div></header>
   <div className="studio-page-heading"><div><p className="studio-eyebrow">EXPRESSION ÉCRITE · TCF CANADA</p><h1>{title}</h1>{props.combinationTitle && <p>{props.combinationTitle}</p>}{props.subtitle && <p>{props.subtitle}</p>}</div>{props.currentView !== 'home' && props.currentView !== 'simulator' && <button className="studio-primary" onClick={()=>go(props.onStartNewExam || props.onNavigateHome)}><PenLine size={17}/>{en?'New session':'Nouvelle séance'}</button>}</div>
   <main className="studio-main">{props.children}</main>
  </div>
  {profile && <UserProfileModal isOpen={profile} onClose={()=>setProfile(false)}/>}
 </div>;
};
