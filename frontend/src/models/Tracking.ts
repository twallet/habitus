/**
 * Tracking type enumeration.
 * @public
 */
export enum TrackingType {
  TRUE_FALSE = "true_false",
  REGISTER = "register",
}

/**
 * Tracking data interface.
 * @public
 */
export interface TrackingData {
  id: number;
  user_id: number;
  question: string;
  type: TrackingType;
  start_tracking_date: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}
