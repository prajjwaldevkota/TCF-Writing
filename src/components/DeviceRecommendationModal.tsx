import React, { useState, useEffect } from 'react';
import { Laptop, X, Smartphone, Check } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const STORAGE_KEY_PERMANENT = 'tcf_dismiss_device_hint_permanent';
const STORAGE_KEY_SESSION = 'tcf_dismiss_device_hint_session';

export const DeviceRecommendationModal: React.FC = () => {
  const { language, t } = useLanguage();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);

  useEffect(() => {
    try {
      // Check if already permanently dismissed or dismissed this session
      const permanentDismiss = localStorage.getItem(STORAGE_KEY_PERMANENT);
      const sessionDismiss = sessionStorage.getItem(STORAGE_KEY_SESSION);

      if (permanentDismiss === 'true' || sessionDismiss === 'true') {
        return;
      }

      // Check if current screen or device is mobile/tablet (viewport width < 1024px)
      const isMobileOrTablet =
        typeof window !== 'undefined' &&
        (window.innerWidth < 1024 ||
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

      if (isMobileOrTablet) {
        // Small delay to allow the main interface to load smoothly
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDismiss = () => {
    try {
      if (dontShowAgain) {
        localStorage.setItem(STORAGE_KEY_PERMANENT, 'true');
      }
      sessionStorage.setItem(STORAGE_KEY_SESSION, 'true');
    } catch {}
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl relative transform transition-transform duration-200 scale-100"
        style={{
          boxShadow: '10px 10px 30px #cbd5e1, -10px -10px 30px #ffffff'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label={t('Fermer')}
        >
          <X size={18} />
        </button>

        {/* Header Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-md shrink-0">
            <Laptop size={24} />
          </div>
          <div>
            <span className="inline-block text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 mb-1">
              {language === 'en' ? 'Optimal Experience' : 'Conseil d\'affichage'}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {language === 'en'
                ? 'Use a Computer or Laptop'
                : 'Utilisez un ordinateur pour une meilleure expérience'}
            </h3>
          </div>
        </div>

        {/* Body content */}
        <div className="space-y-3 text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
          <p>
            {language === 'en'
              ? 'We noticed you are on a mobile device or tablet. For the best interface experience and realistic French typing practice (with physical keyboard and official TCF exam layout), we strongly recommend using a desktop computer or laptop.'
              : 'Nous avons détecté que vous êtes sur mobile ou tablette. Pour une meilleure interface et un entraînement au clavier physique conforme aux conditions réelles de l\'examen TCF Canada, nous vous recommandons d\'utiliser un ordinateur portable ou de bureau.'}
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 text-xs text-slate-700">
            <Smartphone size={18} className="text-slate-400 shrink-0" />
            <span>
              {language === 'en'
                ? 'You can still continue practicing on this device, but certain exam layouts are best viewed on larger screens.'
                : 'Vous pouvez tout de même vous entraîner sur cet appareil, mais l\'ergonomie est optimale sur grand écran.'}
            </span>
          </div>
        </div>

        {/* Checkbox Don't show again */}
        <label className="flex items-center gap-2.5 text-xs text-slate-500 mb-5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span>
            {language === 'en' ? "Don't show this message again" : 'Ne plus afficher ce message'}
          </span>
        </label>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
          >
            <Check size={16} />
            <span>
              {language === 'en' ? 'Continue on this device' : 'Continuer sur cet appareil'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
