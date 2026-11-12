import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

interface CharacterPanelProps {
  onInsertCharacter: (char: string) => void;
}

export const CharacterPanel: React.FC<CharacterPanelProps> = ({ onInsertCharacter }) => {
  const { t } = useLanguage();
  const [isUppercase, setIsUppercase] = useState(false);

  const baseCharRows = [
    ['é', 'è', 'ê', 'ë', 'à'],
    ['â', 'î', 'ô', 'ù', 'û'],
    ['ç', 'œ', 'æ', '.', ','],
    [':', "'"]
  ];

  return (
    <div className="bg-white border border-slate-300 rounded p-3 text-sm">
      <div className="flex items-center justify-between mb-2 border-b border-slate-200 pb-1">
        <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wide">
          {t('Tableau de caractère')}
        </h3>
        {isUppercase && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
            {t('Majuscules')}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {baseCharRows.map((row, rIdx) => {
          const isLastRow = rIdx === baseCharRows.length - 1;
          return (
            <div key={rIdx} className="flex gap-1.5 justify-start">
              {row.map((char) => {
                const displayChar = isUppercase ? char.toLocaleUpperCase('fr-FR') : char;
                return (
                  <button
                    key={char}
                    type="button"
                    onMouseDown={(e) => {
                      // Prevent default focus shift away from textarea
                      e.preventDefault();
                      onInsertCharacter(displayChar);
                    }}
                    className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium hover:bg-slate-200 hover:border-slate-400 active:bg-blue-100 transition-colors text-base shadow-none select-none"
                    title={`${t('Insérer')} ${displayChar}`}
                  >
                    {displayChar}
                  </button>
                );
              })}

              {isLastRow && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent default focus shift away from textarea
                    e.preventDefault();
                    setIsUppercase((prev) => !prev);
                  }}
                  className={`flex-1 h-8 flex items-center justify-center gap-1.5 px-2 rounded font-semibold text-xs transition-all border select-none ${
                    isUppercase
                      ? 'bg-blue-600 border-blue-700 text-white shadow-inner hover:bg-blue-700 active:bg-blue-800'
                      : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 hover:border-slate-400 active:bg-slate-300'
                  }`}
                  title={
                    isUppercase
                      ? t('Passer en minuscules')
                      : t('Passer en majuscules (ex: É, À)')
                  }
                  aria-pressed={isUppercase}
                >
                  <span className="text-sm font-bold leading-none">⇧</span>
                  <span>{isUppercase ? t('MAJ (Actif)') : t('Majuscules')}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
