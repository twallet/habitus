import { UserData } from "../models/User";
import { TrackingData, TrackingState, Frequency } from "../models/Tracking";
import { ReminderData, ReminderStatus } from "../models/Reminder";

export interface OutletContextType {
  user: UserData;
  // Trackings
  trackings: TrackingData[];
  trackingsLoading: boolean;
  createTracking: (
    question: string,
    details: string | undefined,
    icon: string | undefined,
    schedules: Array<{ hour: number; minutes: number }>,
    frequency: Frequency
  ) => Promise<TrackingData>;
  updateTracking: (
    trackingId: number,
    frequency: Frequency,
    question?: string,
    details?: string,
    icon?: string,
    schedules?: Array<{ hour: number; minutes: number }>
  ) => Promise<TrackingData>;
  updateTrackingState: (
    trackingId: number,
    state: TrackingState
  ) => Promise<TrackingData>;
  deleteTracking: (trackingId: number) => Promise<void>;

  // Reminders
  reminders: ReminderData[];
  remindersLoading: boolean;
  updateReminder: (
    reminderId: number,
    notes?: string,
    status?: ReminderStatus
  ) => Promise<ReminderData>;
  completeReminder: (reminderId: number) => Promise<ReminderData>;
  dismissReminder: (reminderId: number) => Promise<ReminderData>;
  snoozeReminder: (
    reminderId: number,
    minutes: number
  ) => Promise<ReminderData>;

  // UI Actions from MainLayout
  setShowTrackingForm: (show: boolean) => void;
  setEditingTracking: (tracking: TrackingData | null) => void;
}
