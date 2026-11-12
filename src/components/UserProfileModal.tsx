import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, userName, updateUserName } = useAuth();
  const { t } = useLanguage();

  const [name, setName] = useState<string>(userName || '');
  const [saving, setSaving] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(userName || '');
      setSuccess(false);
      setError(null);
    }
  }, [isOpen, userName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('Veuillez entrer votre nom.'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await updateUserName(trimmed);
      if (res?.error) {
        setError(res.error.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setError(err?.message || t('Erreur lors de la mise à jour.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-base">
              👤
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">
                {t('Mon Profil')}
              </h2>
              <p className="text-xs text-slate-500 font-normal">
                {t('Gérez vos informations personnelles')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer text-sm font-bold"
            title="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <span>✓</span>
              <span>{t('Profil enregistré avec succès !')}</span>
            </div>
          )}

          {/* Email (Read-Only) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>{t('Adresse e-mail')}</span>
              <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1 lowercase">
                <span>🔒</span> {t('non modifiable')}
              </span>
            </label>
            <div className="relative">
              <input
                type="email"
                value={user?.email || ''}
                readOnly
                disabled
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-mono cursor-not-allowed select-all"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {t('Adresse e-mail liée à votre compte.')}
            </p>
          </div>

          {/* Name (Editable) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('Nom complet / Prénom')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Entrez votre nom')}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
              autoFocus
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {t('Ce nom sera affiché pour vous accueillir sur votre tableau de bord (ex. "Bonjour [Nom]").')}
            </p>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {t('Annuler')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
                  <span>{t('Enregistrement...')}</span>
                </>
              ) : (
                <span>{t('Enregistrer')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
