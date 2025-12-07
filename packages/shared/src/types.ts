
// User Types
export const MAX_USER_NAME_LENGTH = 30;

export interface UserData {
  id: number;
  name: string;
  email: string;
  profile_picture_url?: string;
  last_access?: string;
  created_at?: string;
}

// Tracking Types
export const MAX_TRACKING_QUESTION_LENGTH = 100;
export const MAX_SCHEDULES_PER_TRACKING = 5;

export enum DaysPatternType {
  INTERVAL = "interval",
  DAY_OF_WEEK = "day_of_week",
  DAY_OF_MONTH = "day_of_month",
  DAY_OF_YEAR = "day_of_year",
}

export enum TrackingState {
  RUNNING = "Running",
  PAUSED = "Paused",
  ARCHIVED = "Archived",
  DELETED = "Deleted",
}

export interface DaysPattern {
  pattern_type: DaysPatternType;
  // For INTERVAL pattern
  interval_value?: number;
  interval_unit?: "days" | "weeks" | "months" | "years";
  // For DAY_OF_WEEK pattern
  days?: number[]; // 0-6, where 0=Sunday
  // For DAY_OF_MONTH pattern
  type?: "day_number" | "last_day" | "weekday_ordinal" | "date";
  day_numbers?: number[]; // 1-31
  weekday?: number; // 0-6, where 0=Sunday
  ordinal?: number; // 1-5 (first, second, third, fourth, fifth)
  // For DAY_OF_YEAR pattern
  month?: number; // 1-12
  day?: number; // 1-31
}

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
  days?: DaysPattern;
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
