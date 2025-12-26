// User Types
export const MAX_USER_NAME_LENGTH = 30;

export interface UserData {
  id: number;
  name: string;
  email: string;
  profile_picture_url?: string;
  telegram_chat_id?: string;
  notification_channels?: string[];
  last_access?: string;
  created_at?: string;
}

// Tracking Types
export const MAX_TRACKING_QUESTION_LENGTH = 100;
export const MAX_SCHEDULES_PER_TRACKING = 5;

export enum TrackingState {
  RUNNING = "Running",
  PAUSED = "Paused",
  ARCHIVED = "Archived",
}

/**
 * Unified frequency type for tracking reminder schedules.
 * Represents all possible frequency patterns including one-time events.
 * @public
 */
export type Frequency =
  | { type: "daily" }
  | { type: "weekly"; days: number[] } // 0-6, where 0=Sunday
  | {
      type: "monthly";
      kind: "day_number" | "last_day" | "weekday_ordinal";
      day_numbers?: number[]; // 1-31
      weekday?: number; // 0-6, where 0=Sunday
      ordinal?: number; // 1-5 (first, second, third, fourth, fifth)
    }
  | {
      type: "yearly";
      kind: "date" | "weekday_ordinal";
      month?: number; // 1-12
      day?: number; // 1-31
      weekday?: number; // 0-6, where 0=Sunday
      ordinal?: number; // 1-5 (first, second, third, fourth, fifth)
    }
  | { type: "one-time"; date: string }; // YYYY-MM-DD format

export interface TrackingScheduleData {
  id: number;
  tracking_id: number;
  hour: number;
  minutes: number;
  created_at?: string;
  updated_at?: string;
}

export interface TrackingData {
  id: number;
  user_id: number;
  question: string;
  notes?: string;
  icon?: string;
  frequency: Frequency;
  state?: TrackingState;
  schedules?: TrackingScheduleData[];
  created_at?: string;
  updated_at?: string;
}

// Reminder Types
export enum ReminderStatus {
  PENDING = "Pending",
  ANSWERED = "Answered",
  UPCOMING = "Upcoming",
}

export enum ReminderValue {
  COMPLETED = "Completed",
  DISMISSED = "Dismissed",
}

export interface ReminderData {
  id: number;
  tracking_id: number;
  user_id: number;
  scheduled_time: string;
  notes?: string;
  status: ReminderStatus;
  value?: ReminderValue;
  created_at?: string;
  updated_at?: string;
}
