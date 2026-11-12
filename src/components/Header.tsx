import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ADMIN_EMAIL, isOwnerEmail } from '../services/adminService';

interface HeaderProps {
  onHomeClick?: () => void;
  onDashboardClick?: () => void;
  onFeedbackClick?: () => void;
  onProfileClick?: () => void;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
  userEmail?: string | null;
  subtitle?: string;
  combinationTitle?: string;
  forceFrench?: boolean;
  hideLanguageToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onHomeClick,
  onDashboardClick,
  onFeedbackClick,
  onProfileClick,
  onLoginClick,
  onLogoutClick,
  userEmail,
  subtitle,
  combinationTitle,
  forceFrench = false,
  hideLanguageToggle = false
}) => {
  const { language, setLanguage, t } = useLanguage();

  const tr = (keyOrText: string): string => {
    if (forceFrench) {
      if (keyOrText === 'header.home') return 'Examens';
      if (keyOrText === 'header.title') return 'TCF Canada Expression Écrite';
      if (keyOrText === 'header.dashboard') return 'Tableau de bord';
      if (keyOrText === 'header.profile') return 'Profil';
      if (keyOrText === 'header.logout') return 'Déconnexion';
      if (keyOrText === 'header.login') return 'Se connecter';
      return keyOrText;
    }
    return t(keyOrText);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-300 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs shrink-0 select-none">
      <div className="flex items-center gap-3">
        {onHomeClick && (
          <button
            type="button"
            onClick={onHomeClick}
            className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
          >
            <span>←</span>
            <span>{tr('header.home')}</span>
          </button>
        )}
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <img src="./brand-mark.svg" alt="TCF Canada" className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0 drop-shadow-2xs select-none" />
            Écriture
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 font-normal">{tr(subtitle)}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {combinationTitle && (
          <div className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-300 px-3 py-1 rounded hidden sm:block">
            {tr(combinationTitle)}
          </div>
        )}

        {/* Language Switcher Toggle - hidden during exam with 60min timer */}
        {!hideLanguageToggle && !forceFrench && (
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLanguage('fr')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                language === 'fr'
                  ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Passer en français"
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Switch to English"
            >
              EN
            </button>
          </div>
        )}

        {/* Feedback Link */}
        {onFeedbackClick && (
          <button
            type="button"
            onClick={onFeedbackClick}
            className="text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded transition-colors cursor-pointer hidden sm:inline-flex items-center gap-1"
            title={t('Envoyer un feedback ou des remerciements')}
          >
            <span>💬</span>
            <span>{t('Feedback')}</span>
          </button>
        )}

        {/* Auth status buttons */}
        {userEmail ? (
          <div className="flex items-center gap-2">
            {onProfileClick && (
              <button
                type="button"
                onClick={onProfileClick}
                className="text-xs font-semibold text-slate-700 hover:text-blue-700 bg-white border border-slate-300 hover:bg-slate-50 px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title={t('Mon Profil')}
              >
                <span>👤</span>
                <span className="hidden sm:inline">{tr('header.profile')}</span>
              </button>
            )}
            {onDashboardClick && (
              <button
                type="button"
                onClick={onDashboardClick}
                className={`text-xs font-bold px-3 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isOwnerEmail(userEmail)
                    ? 'text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 font-extrabold'
                    : 'text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                {isOwnerEmail(userEmail) && <span>👑</span>}
                <span>{isOwnerEmail(userEmail) ? 'Administration' : tr('header.dashboard')}</span>
              </button>
            )}
            {onLogoutClick && (
              <button
                type="button"
                onClick={onLogoutClick}
                className="text-xs font-medium text-slate-600 border border-slate-300 px-2.5 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {tr('header.logout')}
              </button>
            )}
          </div>
        ) : (
          onLoginClick && (
            <button
              type="button"
              onClick={onLoginClick}
              className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded hover:bg-blue-100 transition-colors cursor-pointer"
            >
              {tr('header.login')}
            </button>
          )
        )}
      </div>
    </header>
  );
};
