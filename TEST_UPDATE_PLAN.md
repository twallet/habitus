# Test Update Plan for Frequency Refactor

## Summary
All tests using `DaysPattern`, `DaysPatternType.INTERVAL`, and `oneTimeDate` need to be updated to use the unified `Frequency` type.

## Files Requiring Updates

### Backend Tests
1. **backend/src/models/__tests__/Tracking.test.ts**
   - Replace `validateDays` tests with `validateFrequency` tests
   - Remove INTERVAL pattern tests (no longer exists)
   - Update all DaysPattern references to Frequency
   - Add one-time frequency tests
   - Update database schema test setup (days → frequency, NOT NULL)

2. **backend/src/services/__tests__/trackingService.test.ts**
   - Update all tracking creation/update tests to use frequency instead of days/oneTimeDate
   - Remove INTERVAL pattern tests
   - Update one-time tracking tests to use frequency type

3. **backend/src/services/__tests__/reminderService.test.ts**
   - Update calculateNextReminderTime tests to use Frequency instead of DaysPattern
   - Remove INTERVAL pattern tests

4. **backend/src/routes/__tests__/trackings.test.ts**
   - Update API route tests to use frequency in request bodies
   - Remove days and oneTimeDate parameters

### Frontend Tests
1. **frontend/src/components/__tests__/TrackingForm.test.tsx**
   - Update to use Frequency instead of DaysPattern
   - Remove oneTimeDate handling tests

2. **frontend/src/components/__tests__/EditTrackingModal.test.tsx**
   - Update to use Frequency instead of DaysPattern/oneTimeDate

3. **frontend/src/components/__tests__/TrackingsList.test.tsx**
   - Update formatFrequency tests for new Frequency structure
   - Remove INTERVAL pattern tests

4. **frontend/src/config/__tests__/api.test.ts**
   - Update createTracking/updateTracking API tests

5. **frontend/src/hooks/__tests__/useTrackings.test.ts**
   - Update hook tests to use Frequency

## Key Changes Needed

### Frequency Structure
- `{ type: "daily" }`
- `{ type: "weekly", days: number[] }`
- `{ type: "monthly", kind: "day_number", day_numbers: number[] }`
- `{ type: "monthly", kind: "last_day" }`
- `{ type: "monthly", kind: "weekday_ordinal", weekday: number, ordinal: number }`
- `{ type: "yearly", kind: "date", month: number, day: number }`
- `{ type: "one-time", date: string }` (YYYY-MM-DD format)

### Removed
- `DaysPatternType.INTERVAL` pattern
- `oneTimeDate` as separate field
- `days` field (replaced with `frequency`)

### Required
- `frequency` field is now REQUIRED (not optional)

