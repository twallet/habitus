# Lifecycle of Trackings and Reminders

This document explains the complete lifecycle of Trackings and Reminders in the Habitus application, including their states, transitions, relationships, and automatic behaviors.

## Table of Contents

1. [Tracking Lifecycle](#tracking-lifecycle)
2. [Reminder Lifecycle](#reminder-lifecycle)
3. [Relationship Between Trackings and Reminders](#relationship-between-trackings-and-reminders)
4. [Times and Days Patterns](#times-and-days-patterns)
5. [Automatic Behaviors](#automatic-behaviors)

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

1. **Required Fields:**

   - `user_id`: The owner of the tracking
   - `question`: The tracking question (max 100 characters)
   - `type`: Either `"true_false"` or `"register"`
   - `times`: Array of 1-5 times (hour, minutes)

2. **Optional Fields:**

   - `notes`: Rich text notes
   - `icon`: Emoji icon (max 20 characters)
   - `days`: Days pattern for reminder frequency

3. **Default State:**

   - New trackings are created with state `"Running"`

4. **Automatic Actions:**
   - Tracking times are created (1-5 times per tracking)
   - An initial reminder is automatically created with status `"Upcoming"` (the time is always in the future)

### Tracking Updates

When a tracking is updated:

1. **Updatable Fields:**

   - `question`
   - `type`
   - `notes`
   - `icon`
   - `times` (replaces all existing times)
   - `days` (days pattern)

2. **Automatic Actions on Update:**
   - If `times` or `days` pattern changes AND tracking state is `"Running"`, existing `Upcoming` reminder is updated with the recalculated next time, or created if not existing.

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

- A new `Upcoming` reminder is automatically created, and its time is calculated based on current times and days pattern

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

- Only one `Upcoming` reminder exists per tracking at any time
- `Upcoming` → `Pending` transition happens automatically when `scheduled_time` passes
- When a reminder is completed or dismissed, a new `Upcoming` reminder is automatically created
- Only `Pending` reminders can be snoozed (not `Answered` reminders)
- The value field defaults to `"Dismissed"` when reminders are created

### Available Actions by Status

**Pending Reminders:**

- Complete the reminder (changes status to `Answered`, sets value to `Completed`, creates new upcoming reminder)
- Dismiss the reminder (changes status to `Answered`, sets value to `Dismissed`, creates new upcoming reminder)
- Snooze the reminder (changes status to `Upcoming` with new time)

**Upcoming Reminders:**

- No actions available to the user

**Answered Reminders:**

- No actions available (historical data, cannot be modified)

### Reminder Creation

Reminders can be created in two ways:

#### 1. Automatic Creation

Reminders are automatically created:

- **When a tracking is created** (if tracking has times and days pattern)
- **When a tracking transitions to Running** (from Paused or Archived)
- **When a reminder is answered** (creates next reminder)
- **When tracking times or days pattern are updated** (if tracking is Running)

### Reminder Updates

When a reminder is updated, the following fields can be changed:

- `notes`: Optional notes (can be edited inline in the reminders table)
- `status`: Automatically changed when performing actions (complete, dismiss, snooze)
- `value`: Automatically set when completing (`Completed`) or dismissing (`Dismissed`) a reminder
- `scheduled_time`: Automatically updated when snoozing

**When a reminder is completed** (status changes to `"Answered"`, value set to `"Completed"`):

- A new `Upcoming` reminder is automatically created for the tracking

**When a reminder is dismissed** (status changes to `"Answered"`, value set to `"Dismissed"`):

- A new `Upcoming` reminder is automatically created for the tracking

### Reminder Snoozing

When a `Pending` reminder is snoozed, the existing `Upcoming` reminder time is updated (current time + snooze minutes)

### Reminder Dismiss

When a reminder is dismissed by the user:

1. The reminder's status changes to `"Answered"` and value is set to `"Dismissed"`
2. A new `Upcoming` reminder is automatically created for the tracking
3. The `Upcoming` reminder time is calculated, with the dismissed reminder's `scheduled_time` excluded from next reminder calculation

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
3. Have a days pattern defined

---

## Times and Days Patterns

### Tracking Times

- Each tracking can have 1-5 times
- Each time defines a time of day (hour: 0-23, minutes: 0-59)
- Times must be unique (no duplicate times)
- Times are stored in the `tracking_schedules` table

### Days Patterns

Days patterns define when reminders should occur. Four pattern types are supported:

#### 1. Interval Pattern

Reminders occur at regular intervals:

```typescript
{
  pattern_type: "interval",
  interval_value: number,  // e.g., 2
  interval_unit: "days" | "weeks" | "months" | "years"
}
```

Example: Every 2 days, every 3 weeks

#### 2. Day of Week Pattern

Reminders occur on specific days of the week:

```typescript
{
  pattern_type: "day_of_week",
  days: number[]  // 0-6, where 0=Sunday, 6=Saturday
}
```

Example: Monday, Wednesday, Friday (days: [1, 3, 5])

#### 3. Day of Month Pattern

Reminders occur on specific days of the month:

```typescript
{
  pattern_type: "day_of_month",
  type: "day_number" | "last_day" | "weekday_ordinal",
  // For day_number:
  day_numbers?: number[],  // 1-31
  // For weekday_ordinal:
  weekday?: number,  // 0-6
  ordinal?: number   // 1-5 (first, second, third, fourth, fifth)
}
```

Examples:

- 1st and 15th of each month
- Last day of each month
- First Monday of each month

#### 4. Day of Year Pattern

Reminders occur on specific days of the year:

```typescript
{
  pattern_type: "day_of_year",
  type: "date" | "weekday_ordinal",
  // For date:
  month?: number,  // 1-12
  day?: number,    // 1-31
  // For weekday_ordinal:
  weekday?: number,  // 0-6
  ordinal?: number   // 1-5
}
```

Examples:

- January 1st (New Year's Day)
- First Monday of the year

### Next Reminder Calculation

When calculating the next reminder time:

1. For each time, the system finds the next occurrence that matches the days pattern
2. The earliest of all candidate times is selected
3. The selected time must be in the future
4. If an `excludeTime` is provided (e.g., when skipping a reminder), that time is excluded from consideration

---

## Automatic Behaviors

### Automatic Reminder Creation

Reminders are automatically created when:

- A tracking is created (if it has times and days pattern)
- A tracking transitions to `Running` (from `Paused` or `Archived`)
- A reminder is answered
- A reminder is skipped
- Tracking times or days pattern are updated (if tracking is `Running`)

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

### Key Principles

1. Trackings must be `Running` to generate reminders
2. New reminders are automatically created when needed
3. `Answered` reminders are preserved even when tracking is archived
4. Only one `Upcoming` reminder per tracking at any time
5. Orphaned and expired reminders are automatically handled
6. Deleted trackings are permanently removed from the database
