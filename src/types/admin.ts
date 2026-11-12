export interface AdminNotificationSettings {
  notificationsEnabled: boolean;
  recipientEmail: string;
  monitoredEmails: string[];
  sendOnPracticeMode: boolean;
  formSubmitEndpoint?: string;
  notifyAllUsers?: boolean;
}

export interface NotificationLog {
  id: string;
  timestamp: string;
  userEmail: string;
  tasks: string[];
  taskSummary: string;
  subject: string;
  status: 'sent' | 'failed' | 'simulated';
  recipient: string;
  examDetails?: {
    year: string;
    month: string;
    combination: number;
    timeUsedSeconds: number;
    wordCounts: { task1: number; task2: number; task3: number };
  };
  errorMessage?: string;
}

export interface TrackedUser {
  email: string;
  isMonitored: boolean;
  firstSeenAt?: string;
  lastActiveAt?: string;
  submissionsCount?: number;
}
