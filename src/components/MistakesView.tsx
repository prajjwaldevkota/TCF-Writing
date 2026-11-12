import React, { useState, useMemo } from 'react';
import { SavedMistake } from '../types/aiEvaluation';
import {
  CANONICAL_CATEGORIES,
  CanonicalCategory,
  CATEGORY_INFO,
  deleteStoredMistake,
  clearAllStoredMistakes
} from '../utils/mistakesStorage';
import { useLanguage } from '../context/LanguageContext';
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Filter,
  Search,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface MistakesViewProps {
  mistakes: SavedMistake[];
  onMistakesChange: (updated: SavedMistake[]) => void;
  onStartExam?: () => void;
  onGoToExams?: () => void;
}

export const MistakesView: React.FC<MistakesViewProps> = ({
  mistakes,
  onMistakesChange,
  onStartExam,
  onGoToExams
}) => {
  const { language, t } = useLanguage();

  // Filter dropdown state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Track which category dropdowns/accordions are expanded
  // By default, open all categories that have mistakes
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    CANONICAL_CATEGORIES.forEach((cat) => {
      initial[cat] = true;
    });
    return initial;
  });

  // Toggle single category dropdown
  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  // Expand all dropdowns
  const handleExpandAll = () => {
    const allOpen: Record<string, boolean> = {};
    CANONICAL_CATEGORIES.forEach((cat) => {
      allOpen[cat] = true;
    });
    setExpandedCategories(allOpen);
  };

  // Collapse all dropdowns
  const handleCollapseAll = () => {
    const allClosed: Record<string, boolean> = {};
    CANONICAL_CATEGORIES.forEach((cat) => {
      allClosed[cat] = false;
    });
    setExpandedCategories(allClosed);
  };

  // Delete a single mistake
  const handleDeleteMistake = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = deleteStoredMistake(id);
    onMistakesChange(updated);
  };

  // Clear all mistakes
  const handleClearAll = () => {
    const confirmed = window.confirm(
      language === 'en'
        ? 'Are you sure you want to clear all saved mistakes from your notebook?'
        : 'Voulez-vous vraiment effacer toutes les fautes enregistrées de votre carnet ?'
    );
    if (!confirmed) return;
    clearAllStoredMistakes();
    onMistakesChange([]);
  };

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CANONICAL_CATEGORIES.forEach((cat) => {
      counts[cat] = 0;
    });
    mistakes.forEach((m) => {
      const cat = m.category || 'Autres';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [mistakes]);

  // Filter mistakes according to dropdown and search
  const filteredMistakesByCategory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const map: Record<string, SavedMistake[]> = {};

    CANONICAL_CATEGORIES.forEach((cat) => {
      map[cat] = [];
    });

    mistakes.forEach((m) => {
      const cat = m.category || 'Autres';

      // Category filter check
      if (selectedCategory !== 'all' && selectedCategory !== cat) {
        return;
      }

      // Search query check
      if (q) {
        const matchesOriginal = m.original_text.toLowerCase().includes(q);
        const matchesCorrected = m.corrected_text.toLowerCase().includes(q);
        const matchesExplanation = m.explanation.toLowerCase().includes(q);
        const matchesExam = (m.exam_title || '').toLowerCase().includes(q);
        if (!matchesOriginal && !matchesCorrected && !matchesExplanation && !matchesExam) {
          return;
        }
      }

      if (!map[cat]) {
        map[cat] = [];
      }
      map[cat].push(m);
    });

    return map;
  }, [mistakes, selectedCategory, searchQuery]);

  const totalFilteredCount = useMemo(() => {
    return Object.values(filteredMistakesByCategory).reduce((acc, list) => acc + list.length, 0);
  }, [filteredMistakesByCategory]);

  const categoriesToDisplay = selectedCategory === 'all'
    ? CANONICAL_CATEGORIES
    : CANONICAL_CATEGORIES.filter((c) => c === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Top Banner / Explanation Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-purple-50 text-purple-700">
              <BookOpen className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              {language === 'en' ? 'My AI Mistakes Bank' : 'Mon Carnet de Fautes IA'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-200">
              {mistakes.length} {language === 'en' ? 'mistakes saved' : 'fautes enregistrées'}
            </span>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            {language === 'en'
              ? 'Every time you evaluate an exam with the AI Coach, detected mistakes are automatically classified into categories below (Spelling, Grammar, Conjugation, etc.) so you can review and master them.'
              : 'À chaque évaluation IA, vos fautes répertoriées sont automatiquement classées par catégorie ci-dessous (Orthographe, Grammaire, Conjugaison...) pour cibler vos révisions avant le test officiel.'}
          </p>
        </div>

        {mistakes.length > 0 && (
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors cursor-pointer flex items-center gap-1.5"
              title={language === 'en' ? 'Clear all saved mistakes' : 'Vider le carnet de fautes'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'Clear all' : 'Vider le carnet'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Control Bar: Category Dropdown Selector + Search + Accordion Toggles */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Dropdown Filter */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 shrink-0">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>{language === 'en' ? 'Category Filter:' : 'Filtrer par catégorie :'}</span>
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
            >
              <option value="all">
                {language === 'en' ? '🌐 All categories' : '🌐 Toutes les catégories'} ({mistakes.length})
              </option>
              {CANONICAL_CATEGORIES.map((cat) => {
                const info = CATEGORY_INFO[cat];
                const count = categoryCounts[cat] || 0;
                const label = language === 'en' ? info.en : info.fr;
                return (
                  <option key={cat} value={cat}>
                    {info.icon} {label} ({count})
                  </option>
                );
              })}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'en' ? 'Search word, error, rule...' : 'Rechercher mot, faute, règle...'}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Expand / Collapse All Toggles */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto border-t md:border-t-0 pt-2 md:pt-0">
          <button
            type="button"
            onClick={handleExpandAll}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            {language === 'en' ? 'Expand All ▾' : 'Tout déplier ▾'}
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            {language === 'en' ? 'Collapse All ▸' : 'Tout replier ▸'}
          </button>
        </div>
      </div>

      {/* Main Content: Category Dropdown Sections (Accordions) */}
      {mistakes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl shadow-inner">
            ✨
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              {language === 'en' ? 'No mistakes recorded yet' : 'Aucune faute enregistrée pour le moment'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'en'
                ? 'Complete an exam or practice session, click "Evaluate with AI (TCF Coach)", and all detected errors will be automatically collected here into Spelling, Grammar, Conjugation, and Vocabulary dropdowns.'
                : 'Effectuez un examen ou un entraînement, puis cliquez sur « Évaluer avec l\'IA (Coach TCF) » sur votre page de résultats. Vos erreurs seront automatiquement ajoutées ici par catégorie.'}
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {onStartExam && (
              <button
                type="button"
                onClick={onStartExam}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                {t('Commencer un examen')}
              </button>
            )}
            {onGoToExams && (
              <button
                type="button"
                onClick={onGoToExams}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'en' ? 'View My Past Submissions' : 'Consulter mes examens'}
              </button>
            )}
          </div>
        </div>
      ) : totalFilteredCount === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-xs">
          {language === 'en'
            ? 'No mistakes match the active filter or search term.'
            : 'Aucune faute ne correspond au filtre ou à la recherche active.'}
        </div>
      ) : (
        <div className="space-y-4">
          {categoriesToDisplay.map((catKey) => {
            const info = CATEGORY_INFO[catKey];
            const list = filteredMistakesByCategory[catKey] || [];
            const isExpanded = !!expandedCategories[catKey];
            const categoryLabel = language === 'en' ? info.en : info.fr;

            // If category has no mistakes under current filter/search, don't show an empty box
            if (list.length === 0) {
              return null;
            }

            return (
              <div
                key={catKey}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs transition-shadow hover:shadow-sm"
              >
                {/* Category Dropdown Header (Click to expand/collapse) */}
                <button
                  type="button"
                  onClick={() => toggleCategory(catKey)}
                  className={`w-full p-4 sm:p-4.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                    isExpanded ? 'bg-slate-50/80 border-b border-slate-200' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0" role="img" aria-label={categoryLabel}>
                      {info.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          {categoryLabel}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${info.badgeBg} ${info.badgeText} ${info.badgeBorder}`}
                        >
                          {list.length} {list.length === 1 ? (language === 'en' ? 'mistake' : 'faute') : (language === 'en' ? 'mistakes' : 'fautes')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                        {catKey === 'Orthographe / Accents' && (language === 'en' ? 'Accents, homophones, silent letters, spelling errors' : 'Accents, homophones, lettres muettes, fautes d’orthographe')}
                        {catKey === 'Grammaire' && (language === 'en' ? 'Agreements (gender/number), prepositions, subjunctive, pronouns' : 'Accords en genre et nombre, prépositions, subjonctif, pronoms')}
                        {catKey === 'Conjugaison / Temps' && (language === 'en' ? 'Tenses, verb endings, si clauses, conditional, past tenses' : 'Temps verbaux, terminaisons, concordance des temps, subjonctif')}
                        {catKey === 'Structure de phrase' && (language === 'en' ? 'Sentence flow, connectives, syntax, run-on sentences' : 'Syntaxe, connecteurs logiques, tournures, fluidité')}
                        {catKey === 'Vocabulaire' && (language === 'en' ? 'Lexical precision, repetitions, register, idioms' : 'Précision lexicale, répétitions, registre de langue, faux-amis')}
                        {catKey === 'Autres' && (language === 'en' ? 'General language and format corrections' : 'Corrections diverses et consignes')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                    <span className="hidden sm:inline text-slate-400">
                      {isExpanded ? (language === 'en' ? 'Close dropdown' : 'Fermer') : (language === 'en' ? 'Open dropdown' : 'Ouvrir')}
                    </span>
                    <span className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  </div>
                </button>

                {/* Dropdown Content: Mistake Items */}
                {isExpanded && (
                  <div className="divide-y divide-slate-100 p-2 sm:p-3 bg-white">
                    {list.map((m, idx) => (
                      <div
                        key={m.id || idx}
                        className="p-3 sm:p-3.5 hover:bg-slate-50/70 rounded-lg transition-colors space-y-2 group"
                      >
                        {/* Error Comparison Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 font-mono text-xs sm:text-sm">
                            <span className="line-through text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded font-medium">
                              {m.original_text || '—'}
                            </span>
                            <span className="text-slate-400 font-sans font-bold">→</span>
                            <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 font-bold px-2 py-0.5 rounded">
                              {m.corrected_text || '—'}
                            </span>
                          </div>

                          {/* Quick delete button */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteMistake(m.id, e)}
                            className="self-end sm:self-auto opacity-70 group-hover:opacity-100 px-2 py-1 rounded text-[11px] font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer flex items-center gap-1 border border-transparent hover:border-red-200"
                            title={language === 'en' ? 'Mark as mastered / remove' : 'Marquer comme maîtrisé / supprimer'}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{language === 'en' ? 'Mastered' : 'Maîtrisé'}</span>
                          </button>
                        </div>

                        {/* Explanation & Rule Box */}
                        {m.explanation && (
                          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5 leading-relaxed">
                            <span className="font-bold text-slate-800">💡 {language === 'en' ? 'Rule:' : 'Règle :'} </span>
                            {m.explanation}
                          </div>
                        )}

                        {/* Source Metadata Footer */}
                        <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-[11px] text-slate-500">
                          {m.task_name && (
                            <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              {m.task_name}
                            </span>
                          )}
                          {m.exam_title && (
                            <span>• {m.exam_title}</span>
                          )}
                          {m.date && (
                            <span className="text-slate-400">• {m.date}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
