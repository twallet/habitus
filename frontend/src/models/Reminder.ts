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
 * Reminder data interface.
 * @public
 */
export interface ReminderData {
  id: number;
  tracking_id: number;
  user_id: number;
  scheduled_time: string;
  answer?: string;
  notes?: string;
  status: ReminderStatus;
  created_at?: string;
  updated_at?: string;
}
