import React, { useState, useEffect } from 'react';
import {
  getAdminSettings,
  saveAdminSettings,
  getTrackedUsers,
  toggleUserMonitored,
  addMonitoredUser,
  removeMonitoredUser,
  subscribeToProfilesChanges,
  ADMIN_EMAIL
} from '../services/adminService';
import { sendTestNotification } from '../services/notificationService';
import { getSupabaseAnonKey, setSupabaseAnonKey } from '../lib/supabase';
import { AdminNotificationSettings, TrackedUser } from '../types/admin';
import { useLanguage } from '../context/LanguageContext';

export const AdminPanel: React.FC = () => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<AdminNotificationSettings>(getAdminSettings());
  const [users, setUsers] = useState<TrackedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Supabase anon key local state
  const [anonKeyInput, setAnonKeyInput] = useState<string>(getSupabaseAnonKey());
  const [showAnonKeyInput, setShowAnonKeyInput] = useState<boolean>(!getSupabaseAnonKey());

  // Refresh user directory
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const tracked = await getTrackedUsers();
      setUsers(tracked);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshData();

    // Subscribe to new user registrations in Supabase public.profiles in real-time
    const unsubscribe = subscribeToProfilesChanges((newEmail) => {
      refreshData();
      setSaveSuccessMsg(`${t('Nouveau candidat détecté :')} ${newEmail}`);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSaveAnonKey = (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseAnonKey(anonKeyInput.trim());
    setShowAnonKeyInput(false);
    setSaveSuccessMsg(t('Clé Supabase enregistrée ! Synchronisation en cours...'));
    setTimeout(() => {
      refreshData();
    }, 400);
  };

  const handleToggleNotifications = (enabled: boolean) => {
    const updated = { ...settings, notificationsEnabled: enabled, notifyAllUsers: enabled };
    setSettings(updated);
    saveAdminSettings(updated);
    showSaveNotice();
  };

  const handleRecipientChange = (email: string) => {
    const updated = { ...settings, recipientEmail: email };
    setSettings(updated);
  };

  const handleSaveRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    saveAdminSettings(settings);
    showSaveNotice();
  };

  const showSaveNotice = () => {
    setSaveSuccessMsg(t('Paramètres enregistrés avec succès'));
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleToggleUser = (email: string, currentStatus: boolean) => {
    const updated = toggleUserMonitored(email, !currentStatus);
    setSettings(updated);
    setUsers((prev) =>
      prev.map((u) => (u.email === email ? { ...u, isMonitored: !currentStatus } : u))
    );
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserEmail.includes('@')) return;
    const clean = newUserEmail.trim().toLowerCase();
    const updated = addMonitoredUser(clean);
    setSettings(updated);
    setNewUserEmail('');
    refreshData();
    showSaveNotice();
  };

  const handleRemoveUser = (email: string) => {
    const updated = removeMonitoredUser(email);
    setSettings(updated);
    refreshData();
  };

  const handleSelectAll = () => {
    const currentUsers = users.map((u) => u.email);
    const updated: AdminNotificationSettings = {
      ...settings,
      notifyAllUsers: true,
      monitoredEmails: Array.from(new Set([...settings.monitoredEmails, ...currentUsers]))
    };
    setSettings(updated);
    saveAdminSettings(updated);
    refreshData();
    showSaveNotice();
  };

  const handleDeselectAll = () => {
    const updated: AdminNotificationSettings = {
      ...settings,
      notifyAllUsers: false,
      monitoredEmails: []
    };
    setSettings(updated);
    saveAdminSettings(updated);
    refreshData();
    showSaveNotice();
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await sendTestNotification(settings.recipientEmail || ADMIN_EMAIL);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || t("Erreur lors de l'envoi du test")
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const monitoredCount = users.filter((u) => u.isMonitored).length;

  return (
    <div className="space-y-6">
      {/* Admin Spotlight Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-xl p-6 sm:p-7 shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-md shrink-0">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{t("Panneau d'Administration")}</h1>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {t('Admin Profil')}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {t('Connecté en tant que')}{' '}
                <span className="font-semibold text-white">{ADMIN_EMAIL}</span> •{' '}
                {t('Gérez et sélectionnez les candidats dont vous voulez recevoir les notifications de devoirs.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={refreshData}
              disabled={isRefreshing}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              title="Synchroniser avec la table public.profiles de Supabase"
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
              <span>{isRefreshing ? '...' : 'Sync Supabase'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendTest}
              disabled={isSendingTest}
              className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSendingTest ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>{t('Envoi en cours...')}</span>
                </>
              ) : (
                <>
                  <span>✉️</span>
                  <span>{t('Envoyer un e-mail test')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {testResult && (
          <div
            className={`mt-4 p-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
              testResult.success
                ? 'bg-emerald-950/80 text-emerald-200 border-emerald-700/60'
                : 'bg-red-950/80 text-red-200 border-red-700/60'
            }`}
          >
            <span>{testResult.success ? '✓' : '⚠️'}</span>
            <span>{testResult.message}</span>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold">
            ✓ {saveSuccessMsg}
          </div>
        )}
      </div>

      {/* Supabase Connection Helper (if anon key not yet set in .env) */}
      {showAnonKeyInput && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                <span>🔑</span>
                <span>{t('Synchronisation Supabase (public.profiles)')}</span>
              </h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                {t('Pour récupérer directement les 6 utilisateurs de public.profiles sur localhost et détecter les nouveaux utilisateurs en direct, saisissez votre clé Supabase Anon :')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAnonKeyInput(false)}
              className="text-amber-700 hover:text-amber-900 text-xs font-bold"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSaveAnonKey} className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={anonKeyInput}
              onChange={(e) => setAnonKeyInput(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="flex-1 px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg focus:outline-hidden focus:border-amber-600 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0"
            >
              {t('Connecter & Charger les utilisateurs')}
            </button>
          </form>
        </div>
      )}

      {/* PRIMARY SECTION: USERS LIST & NOTIFICATION SELECTION */}
      <div className="bg-white border-2 border-blue-500/30 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>👥</span>
                <span>{t('Liste des Utilisateurs & Choix des Notifications')}</span>
              </h2>
              <span className="bg-blue-100 text-blue-800 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full">
                {monitoredCount} / {users.length} {t('actifs')}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {t('Activez les utilisateurs dont vous souhaitez recevoir les soumissions par e-mail')} (→ <strong className="text-slate-800">{settings.recipientEmail || ADMIN_EMAIL}</strong>).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-bold text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
            >
              {t('Tout activer')}
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-xs font-semibold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-300 transition-colors cursor-pointer"
            >
              {t('Tout désactiver')}
            </button>
          </div>
        </div>

        {/* Quick Add User Input & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <form onSubmit={handleAddUser} className="flex gap-2">
            <input
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder={t('Ajouter un e-mail (ex: xyz@gmail.com)...')}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 bg-white"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              {t('+ Ajouter')}
            </button>
          </form>

          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Filtrer la liste des utilisateurs...')}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 bg-white"
            />
          </div>
        </div>

        {/* Users List with enable/disable switches */}
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              {t('Aucun utilisateur trouvé')}.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isChecked = u.isMonitored;
              const initialLetter = u.email.charAt(0).toUpperCase();

              return (
                <div
                  key={u.email}
                  className={`p-3.5 sm:px-4 flex items-center justify-between gap-3 transition-colors ${
                    isChecked ? 'bg-blue-50/30 hover:bg-blue-50/60' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  {/* Left: User Identity Info (No checkbox) */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border ${
                        isChecked
                          ? 'bg-blue-600 text-white border-blue-500 shadow-2xs'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {initialLetter}
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {u.email}
                      </div>
                      <div className="text-[11px] mt-0.5">
                        {isChecked ? (
                          <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>{t('Notifications activées')}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            <span>{t('Notifications désactivées')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Enable/Disable Switch & Remove Button */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isChecked}
                      onClick={() => handleToggleUser(u.email, isChecked)}
                      className="group flex items-center gap-2.5 cursor-pointer focus:outline-hidden"
                      title={
                        isChecked
                          ? t('Désactiver les alertes pour cet utilisateur')
                          : t('Activer les alertes pour cet utilisateur')
                      }
                    >
                      <span
                        className={`text-xs font-bold transition-colors select-none ${
                          isChecked ? 'text-emerald-700 font-extrabold' : 'text-slate-400'
                        }`}
                      >
                        {isChecked ? t('Activé') : t('Désactivé')}
                      </span>

                      {/* Sliding Toggle Switch Track */}
                      <div
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          isChecked ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
                            isChecked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveUser(u.email)}
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 text-xs transition-colors cursor-pointer ml-1"
                      title={t('Retirer de la liste')}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SECONDARY SECTION: GLOBAL RECEIVER & SWITCH SETTINGS */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <span>⚙️</span>
          <span>{t('Paramètres de Réception')}</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Master Switch */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-sm font-bold text-slate-900 block">
                  {t('Interrupteur général des alertes')}
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("Activer ou suspendre tous les envois d'e-mails.")}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.notificationsEnabled}
                onClick={() => handleToggleNotifications(!settings.notificationsEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  settings.notificationsEnabled ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
                    settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] font-semibold text-slate-600">
              {t('Statut :')}{' '}
              {settings.notificationsEnabled ? (
                <span className="text-emerald-600 font-bold">{t('Actif • Alertes autorisées')}</span>
              ) : (
                <span className="text-slate-500 font-medium">{t('Suspendu (aucune notification envoyée)')}</span>
              )}
            </div>
          </div>

          {/* Target Notification Recipient Email */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <form onSubmit={handleSaveRecipient}>
              <label className="text-sm font-bold text-slate-900 block mb-1">
                {t('Boîte de réception administrateur')}
              </label>
              <p className="text-xs text-slate-500 mb-2">
                {t('Adresse où vous recevrez les alertes de devoirs.')}
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={settings.recipientEmail}
                  onChange={(e) => handleRecipientChange(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  {t('Sauvegarder')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
