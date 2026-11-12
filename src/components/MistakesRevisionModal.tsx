import React, { useMemo } from 'react';
import { SavedMistake } from '../types/aiEvaluation';
import { CATEGORY_INFO, CanonicalCategory, normalizeCategory } from '../utils/mistakesStorage';
import { useLanguage } from '../context/LanguageContext';
import { BookOpen, Sparkles, ArrowRight, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MistakesRevisionModalProps {
  isOpen: boolean;
  mistakes: SavedMistake[];
  trainingModeLabel?: string;
  combinationLabel?: string;
  onConfirmStart: () => void;
  onGoToMistakes: () => void;
  onCancel: () => void;
}

export const MistakesRevisionModal: React.FC<MistakesRevisionModalProps> = ({
  isOpen,
  mistakes = [],
  trainingModeLabel,
  combinationLabel,
  onConfirmStart,
  onGoToMistakes,
  onCancel
}) => {
  const { language, t } = useLanguage();

  const safeMistakes = Array.isArray(mistakes) ? mistakes : [];
  const totalMistakes = safeMistakes.length;

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    safeMistakes.forEach((m) => {
      if (!m) return;
      const cat = normalizeCategory(m.category);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [safeMistakes]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label={t('Fermer')}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Icon and Title */}
        <div className="flex items-start gap-3.5 pr-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 via-purple-500/15 to-blue-500/15 border border-purple-200/70 flex items-center justify-center shrink-0 text-2xl shadow-xs">
            💡
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200 mb-1">
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>{language === 'en' ? 'Revision Reminder' : 'Rappel Révision TCF'}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {language === 'en'
                ? 'Did you revise your past mistakes?'
                : 'Avez-vous révisé vos erreurs passées ?'}
            </h3>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-3.5 text-sm text-slate-600 leading-relaxed">
          <p>
            {language === 'en' ? (
              <>
                You have <strong className="text-slate-900 font-bold">{totalMistakes} mistake{totalMistakes > 1 ? 's' : ''}</strong> saved in your <strong className="text-purple-700 font-bold">Mistakes</strong> tab. Reviewing them before starting this new writing task will help you avoid repeating the same errors.
              </>
            ) : (
              <>
                Vous avez <strong className="text-slate-900 font-bold">{totalMistakes} faute{totalMistakes > 1 ? 's' : ''}</strong> enregistrée{totalMistakes > 1 ? 's' : ''} dans votre onglet <strong className="text-purple-700 font-bold">Mes Fautes</strong>. Les réviser avant cette nouvelle rédaction vous évitera de reproduire les mêmes erreurs.
              </>
            )}
          </p>

          {/* Category Breakdown Badges */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {language === 'en' ? 'Your mistakes by category :' : 'Vos erreurs enregistrées par catégorie :'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(categoryCounts).map(([cat, count]) => {
                const info = (CATEGORY_INFO && CATEGORY_INFO[cat as CanonicalCategory]) || {
                  icon: '📌',
                  fr: cat || 'Divers',
                  en: cat || 'Other',
                  badgeBg: 'bg-slate-100',
                  badgeText: 'text-slate-800',
                  badgeBorder: 'border-slate-300'
                };
                return (
                  <span
                    key={cat}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${info.badgeBg || 'bg-slate-100'} ${info.badgeText || 'text-slate-800'} ${info.badgeBorder || 'border-slate-300'}`}
                  >
                    <span>{info.icon || '📌'}</span>
                    <span>{language === 'en' ? (info.en || cat) : (info.fr || cat)}</span>
                    <span className="font-extrabold px-1.5 py-0.2 rounded-full bg-white/70 text-[11px]">
                      {count}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons: YES / NO */}
        <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-slate-100">
          {/* Button 1: NO -> Go to mistakes tab */}
          <button
            type="button"
            onClick={onGoToMistakes}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <BookOpen className="w-4 h-4 text-purple-700" />
            <span>
              {language === 'en' ? 'No, go to mistakes tab' : 'Non, réviser mes fautes'}
            </span>
          </button>

          {/* Button 2: YES -> Start practice */}
          <button
            type="button"
            onClick={onConfirmStart}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            <CheckCircle2 className="w-4 h-4 text-blue-200" />
            <span>
              {language === 'en' ? 'Yes, start practice' : "Oui, commencer l'entraînement"}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
