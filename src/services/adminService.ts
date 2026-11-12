import { AdminNotificationSettings, NotificationLog, TrackedUser } from '../types/admin';
import { getSupabase, getSupabaseAnonKey } from '../lib/supabase';

export const ADMIN_EMAIL = '';
export const FORMSUBMIT_TOKEN = '';
export const SETTINGS_STORAGE_KEY = 'tcf_admin_notification_settings';
export const LOGS_STORAGE_KEY = 'tcf_admin_notification_logs';
export const KNOWN_USERS_STORAGE_KEY = 'tcf_known_users_list';

export const OWNER_EMAILS = [ADMIN_EMAIL];

/** Administrator roles are supplied by authenticated server metadata. */
export function isOwnerEmail(_email?: string | null): boolean {
  return false;
}

export function normalizeUserEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

// Seeded users from Supabase database (public.profiles)
export const SUPABASE_USERS_SEED: string[] = [];

export const DEFAULT_ADMIN_SETTINGS: AdminNotificationSettings = {
  notificationsEnabled: false,
  notifyAllUsers: true,
  recipientEmail: ADMIN_EMAIL,
  monitoredEmails: [],
  sendOnPracticeMode: true,
  formSubmitEndpoint: `https://formsubmit.co/ajax/${ADMIN_EMAIL}`
};

/**
 * Loads admin notification settings from localStorage with safe defaults
 */
export function getAdminSettings(): AdminNotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ADMIN_SETTINGS };
    const parsed = JSON.parse(raw);
    const recipient =
      !parsed.recipientEmail || parsed.recipientEmail === ''
        ? ADMIN_EMAIL
        : parsed.recipientEmail;

    return {
      ...DEFAULT_ADMIN_SETTINGS,
      ...parsed,
      recipientEmail: recipient,
      notifyAllUsers: parsed.notifyAllUsers !== undefined ? Boolean(parsed.notifyAllUsers) : true,
      formSubmitEndpoint: `https://formsubmit.co/ajax/${recipient}`,
      monitoredEmails: Array.isArray(parsed.monitoredEmails)
        ? parsed.monitoredEmails.map((e: string) => e.toLowerCase().trim())
        : DEFAULT_ADMIN_SETTINGS.monitoredEmails
    };
  } catch (err) {
    console.warn('Error reading admin settings from storage:', err);
    return { ...DEFAULT_ADMIN_SETTINGS };
  }
}

/**
 * Saves admin notification settings
 */
export function saveAdminSettings(settings: AdminNotificationSettings): void {
  try {
    const cleanRecipient = (settings.recipientEmail || ADMIN_EMAIL).trim().toLowerCase();
    const normalized: AdminNotificationSettings = {
      ...settings,
      recipientEmail: cleanRecipient,
      notifyAllUsers: settings.notifyAllUsers !== undefined ? Boolean(settings.notifyAllUsers) : true,
      formSubmitEndpoint: `https://formsubmit.co/ajax/${cleanRecipient}`,
      monitoredEmails: Array.from(
        new Set(settings.monitoredEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))
      )
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  } catch (err) {
    console.error('Error saving admin settings to storage:', err);
  }
}

/**
 * Loads notification history logs
 */
export function getNotificationLogs(): NotificationLog[] {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Appends a new notification log entry (keeps last 100 entries)
 */
export function addNotificationLog(log: Omit<NotificationLog, 'id' | 'timestamp'>): NotificationLog {
  const newEntry: NotificationLog = {
    ...log,
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString()
  };

  try {
    const current = getNotificationLogs();
    const updated = [newEntry, ...current].slice(0, 100);
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to store notification log:', err);
  }

  return newEntry;
}

/**
 * Clears all notification logs
 */
export function clearNotificationLogs(): void {
  try {
    localStorage.removeItem(LOGS_STORAGE_KEY);
  } catch {}
}

/**
 * Records a user email in the known users registry
 */
export function recordUserEmail(email: string): void {
  if (!email || !email.includes('@')) return;
  const normalized = email.trim().toLowerCase();
  try {
    const currentUsers = getStoredKnownUsers();
    if (!currentUsers.includes(normalized)) {
      const updated = [...currentUsers, normalized];
      localStorage.setItem(KNOWN_USERS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
}

function getStoredKnownUsers(): string[] {
  try {
    const raw = localStorage.getItem(KNOWN_USERS_STORAGE_KEY);
    const defaults = [...SUPABASE_USERS_SEED];
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : defaults;
    SUPABASE_USERS_SEED.forEach((seed) => {
      if (!list.includes(seed)) list.push(seed);
    });
    return list;
  } catch {
    return [...SUPABASE_USERS_SEED];
  }
}

/**
 * Fetches all tracked users, querying Supabase profiles and submissions
 */
export async function getTrackedUsers(): Promise<TrackedUser[]> {
  const settings = getAdminSettings();
  const monitoredSet = new Set(settings.monitoredEmails.map((e) => e.toLowerCase()));
  const allEmails = new Set<string>(getStoredKnownUsers());

  // Always include database seeded users
  SUPABASE_USERS_SEED.forEach((e) => allEmails.add(e.toLowerCase()));

  // Pull emails from local submissions if any
  try {
    const storedSubs = localStorage.getItem('tcf_stored_submissions');
    if (storedSubs) {
      const subs = JSON.parse(storedSubs);
      if (Array.isArray(subs)) {
        subs.forEach((s: any) => {
          if (s.userEmail) allEmails.add(s.userEmail.toLowerCase());
        });
      }
    }
  } catch {}

  // Query Supabase database profiles if client is available
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client.from('profiles').select('email');
      if (!error && data && Array.isArray(data)) {
        data.forEach((p: { email?: string }) => {
          if (p.email) {
            const clean = p.email.trim().toLowerCase();
            allEmails.add(clean);
            recordUserEmail(clean);
          }
        });
      }
    } catch (e) {
      console.warn('Supabase query error:', e);
    }
  }

  // Ensure monitored users are in the list
  settings.monitoredEmails.forEach((e) => allEmails.add(e.toLowerCase()));

  // Convert to TrackedUser list
  const users: TrackedUser[] = Array.from(allEmails)
    .filter((e) => e && e.includes('@') && !isOwnerEmail(e))
    .sort()
    .map((email) => ({
      email,
      isMonitored: monitoredSet.has(email)
    }));

  return users;
}

/**
 * Listens for new users added to public.profiles in real-time
 */
export function subscribeToProfilesChanges(onNewUser: (email: string) => void): () => void {
  const client = getSupabase();
  if (!client) return () => {};

  try {
    const channel = client
      .channel('public:profiles_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        (payload: any) => {
          const newEmail = payload.new?.email;
          if (newEmail && typeof newEmail === 'string') {
            const clean = newEmail.trim().toLowerCase();
            recordUserEmail(clean);
            onNewUser(clean);
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Could not subscribe to profiles changes:', err);
    return () => {};
  }
}

/**
 * Toggles monitored status for a specific user
 */
export function toggleUserMonitored(email: string, monitored: boolean): AdminNotificationSettings {
  const settings = getAdminSettings();
  const normalized = email.trim().toLowerCase();
  const currentSet = new Set(settings.monitoredEmails.map((e) => e.toLowerCase()));

  if (monitored) {
    currentSet.add(normalized);
  } else {
    currentSet.delete(normalized);
  }

  const updated: AdminNotificationSettings = {
    ...settings,
    monitoredEmails: Array.from(currentSet)
  };

  saveAdminSettings(updated);
  recordUserEmail(normalized);
  return updated;
}

/**
 * Adds an arbitrary email address to monitored users
 */
export function addMonitoredUser(email: string): AdminNotificationSettings {
  return toggleUserMonitored(email, true);
}

/**
 * Removes an email address from monitored users
 */
export function removeMonitoredUser(email: string): AdminNotificationSettings {
  return toggleUserMonitored(email, false);
}
