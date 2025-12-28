# Lifecycle of Trackings and Reminders

This document explains the complete lifecycle of Trackings and Reminders in the Habitus application, including their states, transitions, relationships, and automatic behaviors.

---

## Tracking Lifecycle

### Tracking States

A Tracking can exist in one of three states:

- **Running**: The tracking is active and generating reminders
- **Paused**: The tracking is temporarily inactive
- **Archived**: The tracking is archived

### State Transitions

The following state transitions are allowed:

```
Running → Paused
Running → Archived
Paused → Running
Paused → Archived
Archived → Running
```

**Important Rules:**

- Cannot transition to the same state
- Deletion is a permanent operation that removes the tracking from the database

### Tracking Creation

When a tracking is created:

1. **Default State:**

   - New trackings are created with state `Running`

2. **Automatic Actions:**
   - Tracking times are created (1-5 times per tracking)
   - **For recurring trackings:** An initial reminder is automatically created with status `"Upcoming"` (the time is always in the future)
   - **For one-time trackings:** Only the earliest reminder is created initially with status `"Upcoming"`. Subsequent reminders are created sequentially as previous reminders go pending or are answered.

### Tracking Updates

When a tracking is updated:

1. **Updatable Fields:**

   - `question`
   - `type`
   - `notes`
   - `icon`
   - `times` (replaces all existing times)
   - `frequency` (unified frequency pattern - required field for all trackings)

2. **Automatic Actions on Update:**
   - **For recurring trackings:** If `times` or `frequency` changes AND tracking state is `"Running"`, existing `Upcoming` reminder is updated with the recalculated next time, or created if not existing.
   - **For one-time trackings:** If `frequency.date` or `times` change AND tracking state is `"Running"`, only existing `Upcoming` reminders are deleted (Pending and Answered reminders are preserved). Only the earliest reminder is created for the updated date. Subsequent reminders are created sequentially as previous reminders go pending or are answered.
   - **When converting between one-time and recurring:** Only `Upcoming` reminders are deleted (Pending and Answered reminders are preserved). If converting to one-time (`frequency.type === "one-time"`), only the earliest reminder is created initially. If converting to recurring, a new `Upcoming` reminder is created based on the frequency pattern.

### Tracking State Changes

#### Transitioning to Paused

When a tracking transitions to `Paused`:

- The `Upcoming` reminder is deleted
- `Pending` and `Answered` reminders are preserved
- No new reminders are generated while paused

#### Transitioning to Archived

When a tracking transitions to `Archived`:

- The `Upcoming` reminder is deleted
- All `Pending` reminders are deleted
- `Answered` reminders are preserved
- No new reminders are generated while archived

#### Transitioning to Running

When a tracking transitions to `Running` (from `Paused` or `Archived`):

- **For recurring trackings:** A new `Upcoming` reminder is automatically created, and its time is calculated based on current times and frequency pattern
- **For one-time trackings:** If the `frequency.date` is in the future, only the earliest reminder is created initially. Subsequent reminders are created sequentially as previous reminders go pending or are answered. If the date has passed, no reminders are created.

#### Deletion

When a tracking is deleted:

- All associated reminders and times are deleted
- The tracking record is permanently removed from the database
- This operation is irreversible

---

## Reminder Lifecycle

### Reminder Statuses

A Reminder can exist in one of three statuses:

- **Pending**: The reminder is due and waiting to be completed or dismissed
- **Answered**: The reminder has been completed or dismissed by the user
- **Upcoming**: The reminder is set for a future time

### Reminder Values

A Reminder has a value field that indicates the outcome when it is answered:

- **Completed**: The reminder was completed by the user
- **Dismissed**: The reminder was dismissed by the user

**Important Rules:**

- The value field defaults to `"Dismissed"` when a reminder is created
- The value is set when the reminder transitions from `Pending` to `Answered`
- Once set, the value cannot be changed

### Status Transitions

The following status transitions occur:

```
Upcoming → Pending
Pending → Answered
Pending → Upcoming
```

**Important Rules:**

- Only one `Upcoming` reminder exists per tracking at any time (for both recurring and one-time trackings)
- `Upcoming` → `Pending` transition happens automatically when `scheduled_time` passes
- When a reminder is completed or dismissed:
  - **For recurring trackings:** A new `Upcoming` reminder is automatically created
  - **For one-time trackings:** The next reminder is created if there are more schedule times on the same date. If it's the last reminder, the tracking is automatically archived.
- Only `Pending` reminders can be snoozed (not `Answered` reminders)
- The value field defaults to `"Dismissed"` when reminders are created

### Available Actions by Status

**Pending Reminders:**

- Complete the reminder (changes status to `Answered`, sets value to `Completed`, creates new upcoming reminder if available)
- Dismiss the reminder (changes status to `Answered`, sets value to `Dismissed`, creates new upcoming reminder if available)
- Snooze the reminder (changes status to `Upcoming` with new time)

**Upcoming Reminders:**

- No actions available to the user

**Answered Reminders:**

- No actions available (historical data, cannot be modified)

### Reminder Creation

Reminders can be created in two ways:

#### 1. Automatic Creation

Reminders are automatically created:

- **When a tracking is created:**
  - **Recurring trackings:** If tracking has times and a recurring frequency type (`daily`, `weekly`, `monthly`, or `yearly`), an initial `Upcoming` reminder is created
  - **One-time trackings:** If tracking has times and `frequency.type === "one-time"` with a valid `date`, only the earliest reminder is created initially. Subsequent reminders are created sequentially.
- **When a tracking transitions to Running** (from Paused or Archived):
  - **Recurring trackings:** A new `Upcoming` reminder is created based on times and frequency pattern
  - **One-time trackings:** If `frequency.date` is in the future, only the earliest reminder is created initially. Subsequent reminders are created sequentially.
- **When a reminder is answered** (creates next reminder if available - for recurring trackings always, for one-time trackings if more schedule times exist on the same date)
- **When a reminder goes from Upcoming to Pending** (for one-time trackings, creates the next reminder if more schedule times exist on the same date)
- **When tracking times or frequency are updated** (if tracking is Running and recurring)
- **When one-time frequency date or times are updated** (if tracking is Running and one-time, all reminders are deleted and only the earliest is recreated)

### Reminder Updates

When a reminder is updated, the following fields can be changed:

- `notes`: Optional notes (can be edited inline in the reminders table)
- `status`: Automatically changed when performing actions (complete, dismiss, snooze)
- `value`: Automatically set when completing (`Completed`) or dismissing (`Dismissed`) a reminder
- `scheduled_time`: Automatically updated when snoozing

**When a reminder is completed** (status changes to `"Answered"`, value set to `"Completed"`):

- **For recurring trackings:** A new `Upcoming` reminder is automatically created for the tracking
- **For one-time trackings:** The next reminder is created if there are more schedule times on the same date. If it's the last reminder, the tracking is automatically archived.

**When a reminder is dismissed** (status changes to `"Answered"`, value set to `"Dismissed"`):

- **For recurring trackings:** A new `Upcoming` reminder is automatically created for the tracking
- **For one-time trackings:** The next reminder is created if there are more schedule times on the same date. If it's the last reminder, the tracking is automatically archived.

### Reminder Snoozing

When a `Pending` reminder is snoozed, the existing `Upcoming` reminder time is updated (current time + snooze minutes)

### Reminder Dismiss

When a reminder is dismissed by the user:

1. The reminder's status changes to `"Answered"` and value is set to `"Dismissed"`
2. **For recurring trackings:** A new `Upcoming` reminder is automatically created for the tracking
3. **For recurring trackings:** The `Upcoming` reminder time is calculated, with the dismissed reminder's `scheduled_time` excluded from next reminder calculation
4. **For one-time trackings:** The next reminder is created if there are more schedule times on the same date. If it's the last reminder, the tracking is automatically archived.

### Reminder Deletion

Reminders are only deleted in the following scenarios:

1. **When a tracking is deleted:** All reminders associated with the tracking are deleted
2. **When a tracking is archived:** All `Pending` and `Upcoming` reminders are deleted
3. **When a tracking is paused:** Its `Upcoming` reminder is deleted
4. **Orphaned reminders:** Reminders whose tracking no longer exists are automatically deleted when detected

### Automatic Status Updates

- When reminders are fetched, any `Upcoming` reminders with past `scheduled_time` are automatically updated to `"Pending"`
- Orphaned reminders (whose tracking no longer exists) are automatically detected and deleted

---

## Relationship Between Trackings and Reminders

### One-to-Many Relationship

- One Tracking can have many Reminders
- Each Reminder belongs to exactly one Tracking
- Reminders are deleted when their tracking is deleted

### Reminder Constraints

- **Multiple `Pending`/`Answered` reminders:** A tracking can have multiple `Pending` reminders (if not answered) and multiple `Answered` reminders (historical data)

### Reminder Generation Rules

Reminders are only generated for trackings that:

1. Have state `"Running"`
2. Have at least one time defined
3. Have a `frequency` defined (required field)

**For recurring trackings:** The frequency type must be one of: `daily`, `weekly`, `monthly`, or `yearly`

**For one-time trackings:** The frequency type must be `one-time` with a `date` field (YYYY-MM-DD format, must be today or in the future)

---

## Times and Frequency

### Tracking Times

- Each tracking can have 1-5 times
- Each time defines a time of day (hour: 0-23, minutes: 0-59)
- Times must be unique (no duplicate times)
- Times are stored in the `tracking_schedules` table

### Frequency Types

Trackings use a unified `frequency` field (required) that defines when reminders should occur. The frequency can be either **recurring** or **one-time**:

- **Recurring trackings:** Use frequency types `daily`, `weekly`, `monthly`, or `yearly` to define when reminders should occur repeatedly
- **One-time trackings:** Use frequency type `one-time` with a `date` field to create reminders that occur only once

### Frequency Patterns

The `frequency` field is a discriminated union type. The following frequency types are supported:

#### 1. Daily Frequency

Reminders occur every day:

```typescript
{
  type: "daily";
}
```

Example: Reminders every day at the specified times

#### 2. Weekly Frequency

Reminders occur on specific days of the week:

```typescript
{
  type: "weekly",
  days: number[]  // 0-6, where 0=Sunday, 6=Saturday
}
```

Example: Monday, Wednesday, Friday (`{ type: "weekly", days: [1, 3, 5] }`)

#### 3. Monthly Frequency

Reminders occur on specific days of the month:

```typescript
{
  type: "monthly",
  kind: "day_number" | "last_day" | "weekday_ordinal",
  // For day_number:
  day_numbers?: number[],  // 1-31
  // For last_day:
  // (no additional fields)
  // For weekday_ordinal:
  weekday?: number,  // 0-6, where 0=Sunday
  ordinal?: number   // 1-5 (first, second, third, fourth, fifth)
}
```

Examples:

- 1st and 15th of each month: `{ type: "monthly", kind: "day_number", day_numbers: [1, 15] }`
- Last day of each month: `{ type: "monthly", kind: "last_day" }`
- First Monday of each month: `{ type: "monthly", kind: "weekday_ordinal", weekday: 1, ordinal: 1 }`

#### 4. Yearly Frequency

Reminders occur on specific days of the year:

```typescript
{
  type: "yearly",
  kind: "date" | "weekday_ordinal",
  // For date:
  month?: number,  // 1-12
  day?: number,    // 1-31
  // For weekday_ordinal:
  weekday?: number,  // 0-6, where 0=Sunday
  ordinal?: number   // 1-5 (first, second, third, fourth, fifth)
}
```

Examples:

- January 1st (New Year's Day): `{ type: "yearly", kind: "date", month: 1, day: 1 }`
- First Monday of the year: `{ type: "yearly", kind: "weekday_ordinal", weekday: 1, ordinal: 1 }`

#### 5. One-Time Frequency

One-time trackings create reminders that occur only once on a specific date:

```typescript
{
  type: "one-time",
  date: string  // YYYY-MM-DD format (must be today or in the future)
}
```

**Characteristics:**

- **`date`:** Required date in YYYY-MM-DD format (must be today or in the future)
- **Reminder creation:** Only the earliest reminder is created initially. Subsequent reminders are created sequentially as previous reminders go pending or are answered.
- **Sequential creation:** When a reminder goes from `Upcoming` to `Pending` or is answered, the next reminder (if available) is automatically created
- **Automatic archiving:** When the last reminder is answered, the tracking is automatically archived

**Example:**

- Frequency: `{ type: "one-time", date: "2024-12-25" }`
- Times: `09:00`, `18:00`
- Result: Initially, only the 09:00 reminder is created. When it goes pending or is answered, the 18:00 reminder is created. When the 18:00 reminder is answered, the tracking is automatically archived.

**Conversion:**

- One-time trackings can be converted to recurring by changing `frequency.type` to `daily`, `weekly`, `monthly`, or `yearly` (with appropriate fields)
- Recurring trackings can be converted to one-time by changing `frequency.type` to `one-time` with a `date` field
- When converting, all existing reminders are deleted and new ones are created based on the new frequency type

### Next Reminder Calculation

**For recurring trackings:**

When calculating the next reminder time:

1. For each time, the system finds the next occurrence that matches the frequency pattern
2. The earliest of all candidate times is selected
3. The selected time must be in the future
4. If an `excludeTime` is provided (e.g., when skipping a reminder), that time is excluded from consideration

**For one-time trackings:**

When calculating the next reminder time:

1. The system finds all schedule times for the tracking on the specified date
2. It checks which times already have reminders (any status)
3. It selects the earliest unused schedule time that is after the current time (or excludeTime if provided)
4. Returns `null` if all schedule times have been used

---

## Automatic Behaviors

### Automatic Reminder Creation

Reminders are automatically created when:

- **A tracking is created:**
  - Recurring: If it has times and a recurring frequency type (`daily`, `weekly`, `monthly`, or `yearly`)
  - One-time: If it has times and `frequency.type === "one-time"` with a valid `date` (only earliest reminder created initially)
- **A tracking transitions to `Running`** (from `Paused` or `Archived`):
  - Recurring: Creates `Upcoming` reminder based on times and frequency pattern
  - One-time: Creates only the earliest reminder if `frequency.date` is in the future
- **A reminder is answered** (creates next reminder if available - always for recurring, only if more times exist for one-time)
- **A reminder goes from Upcoming to Pending** (for one-time trackings, creates next reminder if more schedule times exist)
- **A reminder is skipped** (recurring trackings only)
- **Tracking times or frequency are updated** (if tracking is `Running` and recurring)
- **One-time frequency date or times are updated** (if tracking is `Running` and one-time - all reminders are deleted and only earliest is recreated)

### Automatic Reminder Cleanup

- **Tracking Paused:** The `Upcoming` reminder is deleted; `Pending` and `Answered` reminders are preserved
- **Tracking Archived:** The `Upcoming` reminder and all `Pending` reminders are deleted; `Answered` reminders are preserved
- **Tracking Deleted:** All reminders are deleted
- **Orphaned Reminders:** Automatically detected and deleted when reminders are fetched

---

## Summary

### Tracking Lifecycle Summary

```
Creation → Running (default state)
    ↓
Running → Paused (stops reminders)
    ↓
Paused → Running (resumes reminders)
    ↓
Running → Archived (preserves history)
    ↓
Archived → Running (reactivates)
    ↓
Any state → [Deletion] (permanent removal from database)
```

### Reminder Lifecycle Summary

**Recurring Trackings:**

```
Creation → Upcoming (always in the future, value: Dismissed)
    ↓
Upcoming → Pending (automatic when time passes)
    ↓
Pending → Answered (Complete: value=Completed, or Dismiss: value=Dismissed)
    ↓
Answered → [New Upcoming created automatically]
    ↓
Pending → Upcoming (snoozed, time updated)
```

**One-Time Trackings:**

```
Creation → Upcoming (earliest time on specified date, value: Dismissed)
    ↓
Upcoming → Pending (automatic when time passes)
    ↓
[Next reminder created if more schedule times exist]
    ↓
Pending → Answered (Complete: value=Completed, or Dismiss: value=Dismissed)
    ↓
[Next reminder created if more schedule times exist, otherwise tracking archived]
    ↓
[If last reminder: Tracking → Archived automatically]
```

### Key Principles

1. Trackings must be `Running` to generate reminders
2. New reminders are automatically created when needed (for recurring trackings always, for one-time trackings sequentially)
3. One-time trackings create reminders sequentially: only the next reminder is created when the current one goes pending or is answered
4. When the last reminder of a one-time tracking is answered, the tracking is automatically archived
5. Only one `Upcoming` reminder per tracking at any time (for both recurring and one-time trackings)
6. `Answered` reminders are preserved even when tracking is archived
7. Orphaned and expired reminders are automatically handled
8. Deleted trackings are permanently removed from the database
9. Trackings can be converted between recurring and one-time types

### Automatic Archiving for One-Time Trackings

When a one-time tracking's last reminder is answered (completed or dismissed), the tracking is automatically transitioned to `Archived` state. This provides a clean completion state for one-time trackings without requiring manual archiving.

**Behavior:**

- The system checks if there are more schedule times available after a reminder is answered
- If no more reminders can be created (all schedule times have been used), the tracking is automatically archived
- This only applies to one-time trackings
- The archiving happens automatically and preserves all `Answered` reminders for historical reference
