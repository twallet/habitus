/**
 * Reminder status enumeration.
 * @public
 */
export enum ReminderStatus {
  PENDING = "Pending",
  ANSWERED = "Answered",
  UPCOMING = "Upcoming",
}

/**
 * Reminder value enumeration.
 * @public
 */
export enum ReminderValue {
  COMPLETED = "Completed",
  DISMISSED = "Dismissed",
}

/**
 * Reminder data interface.
 * @public
 */
export interface ReminderData {
  id: number;
  tracking_id: number;
  user_id: number;
  scheduled_time: string;
  notes?: string;
  status: ReminderStatus;
  value: ReminderValue;
  created_at?: string;
  updated_at?: string;
}
