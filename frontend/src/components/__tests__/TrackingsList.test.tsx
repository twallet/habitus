// @vitest-environment jsdom
import { vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingsList } from "../TrackingsList";
import { TrackingData, TrackingState } from "../../models/Tracking";
import { ReminderData, ReminderStatus, ReminderValue } from "../../models/Reminder";
import * as useTrackingsModule from "../../hooks/useTrackings";
import * as useRemindersModule from "../../hooks/useReminders";

// Mock the useTrackings hook
vi.mock("../../hooks/useTrackings", () => ({
    useTrackings: vi.fn(),
}));

// Mock the useReminders hook
vi.mock("../../hooks/useReminders", () => ({
    useReminders: vi.fn(),
}));

describe("TrackingsList", () => {
    const mockOnEdit = vi.fn();
    const mockDeleteTracking = vi.fn().mockResolvedValue(undefined);
    const mockUpdateTrackingState = vi.fn().mockResolvedValue(undefined);
    const mockCreateTracking = vi.fn().mockResolvedValue({
        id: 1,
        user_id: 1,
        question: "Test question",
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock implementation
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [],
            isLoading: false,
            updateTrackingState: mockUpdateTrackingState,
            deleteTracking: mockDeleteTracking,
            createTracking: mockCreateTracking,
        });
        // Default mock for useReminders - no reminders by default
        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders: [],
            refreshReminders: vi.fn().mockResolvedValue(undefined),
        });
    });

    it("should render empty state when no trackings", () => {
        render(
            <TrackingsList
                trackings={[]}
                onEdit={mockOnEdit}
            />
        );

        expect(
            screen.getByText(/no trackings\./i)
        ).toBeInTheDocument();
    });

    it("should render loading state", () => {
        render(
            <TrackingsList
                trackings={[]}
                onEdit={mockOnEdit}
                isLoading={true}
            />
        );

        expect(screen.getByText(/loading trackings/i)).toBeInTheDocument();
    });

    it("should render list of trackings", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise today?",
                frequency: { type: "daily" },
            },
            {
                id: 2,
                user_id: 1,
                question: "Did I meditate?",
                frequency: { type: "daily" },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const exerciseElements = screen.getAllByText("Did I exercise today?");
        expect(exerciseElements.length).toBeGreaterThan(0);
        const meditateElements = screen.getAllByText("Did I meditate?");
        expect(meditateElements.length).toBeGreaterThan(0);
    });

    it("should call onEdit when tracking name is clicked", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const trackingNameButton = screen.getByRole("button", { name: /edit tracking: did i exercise\?/i });
        fireEvent.click(trackingNameButton);

        expect(mockOnEdit).toHaveBeenCalledWith(trackings[0]);
        expect(mockOnEdit).toHaveBeenCalledTimes(1);
    });


    it("should display icon with question when icon is present", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                icon: "💪",
                frequency: { type: "daily" },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const iconElements2 = screen.getAllByText("💪");
        expect(iconElements2.length).toBeGreaterThan(0);
        const trackingElements = screen.getAllByText("Did I exercise?");
        expect(trackingElements.length).toBeGreaterThan(0);
        const trackingCell = trackingElements[0].closest(".cell-tracking");
        expect(trackingCell?.textContent).toContain("💪");
        expect(trackingCell?.textContent).toContain("Did I exercise?");
    });

    it("should display only question when icon is absent", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const trackingElements = screen.getAllByText("Did I exercise?");
        expect(trackingElements.length).toBeGreaterThan(0);
        const trackingCell = trackingElements[0].closest(".cell-tracking");
        expect(trackingCell?.textContent).toBe("Did I exercise?");
        expect(trackingCell?.textContent).not.toContain("💪");
    });

    it("should display single schedule time", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
                schedules: [
                    { id: 1, tracking_id: 1, hour: 9, minutes: 0 },
                ],
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const timeElements = screen.getAllByText("09:00");
        expect(timeElements.length).toBeGreaterThan(0);
    });

    it("should display first time with count for multiple schedules", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
                schedules: [
                    { id: 1, tracking_id: 1, hour: 9, minutes: 0 },
                    { id: 2, tracking_id: 1, hour: 14, minutes: 30 },
                    { id: 3, tracking_id: 1, hour: 20, minutes: 0 },
                ],
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const timeElements2 = screen.getAllByText(/09:00 \+2/);
        expect(timeElements2.length).toBeGreaterThan(0);
    });

    it("should display tooltip with all times", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
                schedules: [
                    { id: 1, tracking_id: 1, hour: 9, minutes: 0 },
                    { id: 2, tracking_id: 1, hour: 14, minutes: 30 },
                ],
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const timeElements3 = screen.getAllByText(/09:00 \+1/);
        expect(timeElements3.length).toBeGreaterThan(0);
        const timesCell = timeElements3[0];
        expect(timesCell).toHaveAttribute("title", "09:00, 14:30");
    });

    it("should truncate long questions", () => {
        const longQuestion = "A".repeat(60);
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: longQuestion,
                frequency: { type: "daily" },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const trackingCell = screen.getByTitle(`${longQuestion}. Click to edit`);
        expect(trackingCell.textContent).toBe(longQuestion.substring(0, 50) + "...");
    });

    it("should truncate long questions with icon", () => {
        const longQuestion = "A".repeat(60);
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: longQuestion,
                icon: "💪",
                frequency: { type: "daily" },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const trackingButton = screen.getByTitle(`${longQuestion}. Click to edit`);
        const trackingCell = trackingButton.closest(".cell-tracking");
        expect(trackingCell).toBeTruthy();
        expect(trackingCell?.textContent).toContain("💪");
        expect(trackingButton.textContent).toContain(longQuestion.substring(0, 50) + "...");
    });

    it("should display full question in tooltip even when truncated", () => {
        const longQuestion = "A".repeat(60);
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: longQuestion,
                frequency: { type: "daily" },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const questionCell = screen.getByTitle(`${longQuestion}. Click to edit`);
        expect(questionCell).toHaveAttribute("title", `${longQuestion}. Click to edit`);
    });

    it("should display frequency for daily pattern", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const dailyElements = screen.getAllByText("Daily");
        expect(dailyElements.length).toBeGreaterThan(0);
    });

    it("should display frequency for weekly pattern", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: {
                    type: "weekly",
                    days: [1, 3, 5], // Monday, Wednesday, Friday
                },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // Check for Weekly badge
        const weeklyBadges = screen.getAllByText("Weekly");
        expect(weeklyBadges.length).toBeGreaterThan(0);
        // Check for weekdays as comma-separated text (appears in both table and card view)
        const weekdayTexts = screen.getAllByText("Mon, Wed, Fri");
        expect(weekdayTexts.length).toBeGreaterThan(0);
    });

    it("should display frequency for monthly pattern", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: {
                    type: "monthly",
                    kind: "day_number",
                    day_numbers: [1, 15],
                },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // The FrequencyDisplay component shows abbreviated text: "Days 1, 15"
        // Check for both the badge and detail separately (appears in both table and card view)
        const monthlyBadges = screen.getAllByText("Monthly");
        expect(monthlyBadges.length).toBeGreaterThan(0);
        const dayTexts = screen.getAllByText("Days 1, 15");
        expect(dayTexts.length).toBeGreaterThan(0);
    });

    it("should display frequency for yearly pattern", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: {
                    type: "yearly",
                    kind: "date",
                    month: 1,
                    day: 1,
                },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // The FrequencyDisplay component shows abbreviated text: "Jan 1"
        // Check for both the badge and detail separately (appears in both table and card view)
        const yearlyBadges = screen.getAllByText("Yearly");
        expect(yearlyBadges.length).toBeGreaterThan(0);
        const dateTexts = screen.getAllByText("Jan 1");
        expect(dateTexts.length).toBeGreaterThan(0);
    });

    it("should display default frequency when days pattern is missing", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const dailyElementsDefault = screen.getAllByText("Daily");
        expect(dailyElementsDefault.length).toBeGreaterThan(0);
    });

    it("should display next reminder time in tooltip", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: {
                    type: "weekly",
                    days: [1, 3, 5],
                },
            },
        ];

        // Mock useReminders to return no reminders (default behavior)
        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders: [],
            refreshReminders: vi.fn().mockResolvedValue(undefined),
        });

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // Check for Weekly badge and weekdays as comma-separated text (appears in both table and card view)
        const weeklyBadges = screen.getAllByText("Weekly");
        expect(weeklyBadges.length).toBeGreaterThan(0);
        const weekdayTexts = screen.getAllByText("Mon, Wed, Fri");
        expect(weekdayTexts.length).toBeGreaterThan(0);
        // Check that frequency cell has title attribute
        const frequencyCell = weeklyBadges[0].closest(".cell-frequency");
        expect(frequencyCell).toHaveAttribute("title");
    });

    it("should display table headers", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const trackingHeaders = screen.getAllByText("Tracking");
        expect(trackingHeaders.length).toBeGreaterThan(0);
        const timesHeaders = screen.getAllByText("Times");
        expect(timesHeaders.length).toBeGreaterThan(0);
        const frequencyHeaders = screen.getAllByText("Frequency");
        expect(frequencyHeaders.length).toBeGreaterThan(0);
        const notesHeaders = screen.getAllByText("Notes");
        expect(notesHeaders.length).toBeGreaterThan(0);
        const nextReminderHeaders = screen.getAllByText("Next reminder");
        expect(nextReminderHeaders.length).toBeGreaterThan(0);
        const statusHeaders = screen.getAllByText("Status");
        expect(statusHeaders.length).toBeGreaterThan(0);
    });

    it("should call onCreate when create button is clicked in empty state", async () => {
        const user = userEvent.setup();
        const mockOnCreate = vi.fn();

        render(
            <TrackingsList
                trackings={[]}
                onEdit={mockOnEdit}
                onCreate={mockOnCreate}
            />
        );

        const createButton = screen.getByRole("button", { name: /create a new tracking/i });
        await user.click(createButton);

        expect(mockOnCreate).toHaveBeenCalledTimes(1);
    });

    it("should display empty state message without button when onCreate is not provided", () => {
        render(
            <TrackingsList
                trackings={[]}
                onEdit={mockOnEdit}
            />
        );

        expect(screen.getByText(/no trackings\./i)).toBeInTheDocument();
        expect(screen.getByText(/create a new tracking to get started!/i)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /create a new tracking/i })).not.toBeInTheDocument();
    });

    it("should handle trackings with all fields populated", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise today?",
                icon: "🏋️",
                notes: "<p>Exercise notes</p>",
                schedules: [
                    { id: 1, tracking_id: 1, hour: 9, minutes: 0 },
                    { id: 2, tracking_id: 1, hour: 18, minutes: 30 },
                ],
                frequency: {
                    type: "weekly",
                    days: [1, 3, 5],
                },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const iconElements = screen.getAllByText("🏋️");
        expect(iconElements.length).toBeGreaterThan(0);
        const exerciseElements = screen.getAllByText("Did I exercise today?");
        expect(exerciseElements.length).toBeGreaterThan(0);
        const trackingCell = exerciseElements[0].closest(".cell-tracking");
        expect(trackingCell?.textContent).toContain("🏋️");
        expect(trackingCell?.textContent).toContain("Did I exercise today?");
        const timeElements4 = screen.getAllByText(/09:00 \+1/);
        expect(timeElements4.length).toBeGreaterThan(0);
        // Check for Weekly badge and weekdays as comma-separated text (appears in both table and card view)
        const weeklyBadges = screen.getAllByText("Weekly");
        expect(weeklyBadges.length).toBeGreaterThan(0);
        const weekdayTexts = screen.getAllByText("Mon, Wed, Fri");
        expect(weekdayTexts.length).toBeGreaterThan(0);
        // Check that notes icon is displayed
        const notesIcons = screen.getAllByText("📝");
        expect(notesIcons.length).toBeGreaterThan(0);
        // Check the first one (from table layout) has the correct attributes
        const notesIcon = notesIcons[0];
        expect(notesIcon).toHaveAttribute("title", "<p>Exercise notes</p>");
    });

    it("should display notes icon with tooltip when notes are present", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
                notes: "Some exercise notes",
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const notesIcons = screen.getAllByText("📝");
        expect(notesIcons.length).toBeGreaterThan(0);
        // Check the first one (from table layout) has the correct attributes
        const notesIcon = notesIcons[0];
        expect(notesIcon).toHaveAttribute("title", "Some exercise notes");
        expect(notesIcon).toHaveAttribute("aria-label", "Notes: Some exercise notes");
    });

    it("should display dash when notes are empty or undefined", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
            },
            {
                id: 2,
                user_id: 1,
                question: "Did I meditate?",
                frequency: { type: "daily" },
                notes: "",
            },
            {
                id: 3,
                user_id: 1,
                question: "Did I read?",
                frequency: { type: "daily" },
                notes: "   ", // Only whitespace
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // Should display dash for all three (undefined, empty string, whitespace only)
        const emptyNotes = screen.getAllByText("—");
        expect(emptyNotes.length).toBeGreaterThanOrEqual(3);
        // Should not display notes icon
        expect(screen.queryByText("📝")).not.toBeInTheDocument();
    });

    it("should handle trackings with no schedules", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const trackingElements = screen.getAllByText("Did I exercise?");
        const trackingRow = trackingElements[0].closest("tr");
        expect(trackingRow).toBeTruthy();
        const timesCell = trackingRow?.querySelector(".cell-times");
        expect(timesCell?.textContent).toBe("");
        expect(timesCell).toHaveAttribute("title", "No times");
    });

    it("should format daily frequency correctly", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" }, // INTERVAL patterns are no longer supported, use daily
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const dailyElements = screen.getAllByText("Daily");
        expect(dailyElements.length).toBeGreaterThan(0);
    });

    it("should format last day of month pattern", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: {
                    type: "monthly",
                    kind: "last_day",
                },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // The FrequencyDisplay component shows abbreviated text: "Last day"
        // Check for both the badge and detail separately (appears in both table and card view)
        const monthlyBadges = screen.getAllByText("Monthly");
        expect(monthlyBadges.length).toBeGreaterThan(0);
        const lastDayTexts = screen.getAllByText("Last day");
        expect(lastDayTexts.length).toBeGreaterThan(0);
    });

    it("should format weekday ordinal pattern", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: {
                    type: "monthly",
                    kind: "weekday_ordinal",
                    weekday: 1, // Monday
                    ordinal: 2, // Second
                },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // The FrequencyDisplay component shows "2nd Mon" (abbreviated)
        // Check for both the badge and detail separately (appears in both table and card view)
        const monthlyBadges = screen.getAllByText("Monthly");
        expect(monthlyBadges.length).toBeGreaterThan(0);
        const ordinalTexts = screen.getAllByText("2nd Mon");
        expect(ordinalTexts.length).toBeGreaterThan(0);
    });

    it("should format all days of week as Daily", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: {
                    type: "weekly",
                    days: [0, 1, 2, 3, 4, 5, 6], // All days
                },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const dailyElements3 = screen.getAllByText("Daily");
        expect(dailyElements3.length).toBeGreaterThan(0);
    });


    it("should show delete confirmation modal when delete button is clicked for archived tracking", async () => {
        const user = userEvent.setup();
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
                state: TrackingState.ARCHIVED,
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // Find the delete action button
        const deleteButton = screen.getByRole("button", { name: /delete/i });
        await user.click(deleteButton);

        // Modal should appear
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /delete tracking/i })).toBeInTheDocument();
        });
        expect(screen.getByText(/are you sure you want to delete the tracking/i)).toBeInTheDocument();
        expect(screen.getByText(/"Did I exercise\?"/)).toBeInTheDocument();
    });

    it("should not show delete confirmation modal for non-delete state changes", async () => {
        const user = userEvent.setup();
        const mockOnStateChange = vi.fn().mockResolvedValue(undefined);
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
                state: TrackingState.PAUSED,
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
                onStateChange={mockOnStateChange}
            />
        );

        // Find the resume action button
        const resumeButton = screen.getByRole("button", { name: /resume/i });
        await user.click(resumeButton);

        // Modal should NOT appear, state change should happen immediately
        expect(screen.queryByRole("heading", { name: /delete tracking/i })).not.toBeInTheDocument();
        await waitFor(() => {
            expect(mockOnStateChange).toHaveBeenCalledWith(1, TrackingState.RUNNING);
        });
    });

    it("should call deleteTracking when delete is confirmed", async () => {
        const user = userEvent.setup();
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
                state: TrackingState.ARCHIVED,
            },
        ];

        // Mock useTrackings to return the trackings and deleteTracking function
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [],
            isLoading: false,
            updateTrackingState: mockUpdateTrackingState,
            deleteTracking: mockDeleteTracking,
        });

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // Find the delete action button
        const deleteButton = screen.getByRole("button", { name: /delete/i });
        await user.click(deleteButton);

        // Wait for modal to appear
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /delete tracking/i })).toBeInTheDocument();
        });

        // Type DELETE to confirm
        const confirmationInput = screen.getByPlaceholderText("DELETE");
        await user.type(confirmationInput, "DELETE");

        // Click delete button in modal
        const confirmDeleteButton = screen.getByRole("button", { name: /delete tracking/i });
        await user.click(confirmDeleteButton);

        // deleteTracking should be called with the tracking ID
        await waitFor(() => {
            expect(mockDeleteTracking).toHaveBeenCalledWith(1);
        });
    });

    it("should close modal when cancel is clicked", async () => {
        const user = userEvent.setup();
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
                state: TrackingState.ARCHIVED,
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // Find the delete action button
        const deleteButton = screen.getByRole("button", { name: /delete/i });
        await user.click(deleteButton);

        // Wait for modal to appear
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /delete tracking/i })).toBeInTheDocument();
        });

        // Click cancel button
        const cancelButton = screen.getByRole("button", { name: /cancel/i });
        await user.click(cancelButton);

        // Modal should disappear
        await waitFor(() => {
            expect(screen.queryByRole("heading", { name: /delete tracking/i })).not.toBeInTheDocument();
        });
    });

    it("should display all trackings", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                frequency: { type: "daily" },
                state: TrackingState.RUNNING,
            },
            {
                id: 2,
                user_id: 1,
                question: "Did I meditate?",
                state: TrackingState.PAUSED,
                frequency: { type: "daily" },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // Both trackings should be visible
        const exerciseElements = screen.getAllByText("Did I exercise?");
        expect(exerciseElements.length).toBeGreaterThan(0);
        const meditateElements = screen.getAllByText("Did I meditate?");
        expect(meditateElements.length).toBeGreaterThan(0);
    });

    it("should call onCreateTracking callback with createTracking function", () => {
        const mockOnCreateTracking = vi.fn();

        render(
            <TrackingsList
                onEdit={mockOnEdit}
                onCreateTracking={mockOnCreateTracking}
            />
        );

        // The callback should be called with the createTracking function from the hook
        expect(mockOnCreateTracking).toHaveBeenCalledWith(mockCreateTracking);
    });

    it("should not call onCreateTracking if prop is not provided", () => {
        const mockOnCreateTracking = vi.fn();

        render(
            <TrackingsList
                onEdit={mockOnEdit}
            />
        );

        // The callback should not be called if prop is not provided
        expect(mockOnCreateTracking).not.toHaveBeenCalled();
    });

    describe("Filtering", () => {
        it("should not show filter button when there are no trackings", () => {
            render(
                <TrackingsList
                    trackings={[]}
                    onEdit={mockOnEdit}
                />
            );

            expect(screen.queryByRole("button", { name: /show filters/i })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: /hide filters/i })).not.toBeInTheDocument();
        });

        it("should show filter panel when toggle button is clicked", async () => {
            const user = userEvent.setup();
            const trackings: TrackingData[] = [
                {
                    id: 1,
                    user_id: 1,
                    question: "Test question",
                    state: TrackingState.RUNNING,
                    frequency: { type: "daily" },
                },
            ];

            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const showFiltersButton = screen.getByRole("button", { name: /show filters/i });
            expect(screen.queryByLabelText("Filter by tracking")).not.toBeInTheDocument();

            await user.click(showFiltersButton);

            expect(screen.getByLabelText("Filter by tracking")).toBeInTheDocument();
        });

        it("should hide filter panel when toggle button is clicked again", async () => {
            const user = userEvent.setup();
            const trackings: TrackingData[] = [
                {
                    id: 1,
                    user_id: 1,
                    question: "Test question",
                    state: TrackingState.RUNNING,
                    frequency: { type: "daily" },
                },
            ];

            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const showFiltersButton = screen.getByRole("button", { name: /show filters/i });
            await user.click(showFiltersButton);
            expect(screen.getByLabelText("Filter by tracking")).toBeInTheDocument();

            await user.click(showFiltersButton);

            expect(screen.queryByLabelText("Filter by tracking")).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: /show filters/i })).toBeInTheDocument();
        });

        it("should reset all filters when reset button is clicked", async () => {
            const user = userEvent.setup();
            const trackings: TrackingData[] = [
                {
                    id: 1,
                    user_id: 1,
                    question: "Test question",
                    state: TrackingState.RUNNING,
                    frequency: { type: "daily" },
                },
            ];

            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const showFiltersButton = screen.getByRole("button", { name: /show filters/i });
            await user.click(showFiltersButton);

            const filterInput = screen.getByLabelText("Filter by tracking");
            await user.type(filterInput, "test");
            expect(filterInput).toHaveValue("test");

            const resetButton = screen.getByRole("button", { name: /reset all filters/i });
            await user.click(resetButton);

            expect(filterInput).toHaveValue("");
        });

        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise today?",
                state: TrackingState.RUNNING,
                frequency: { type: "daily" },
                schedules: [{ id: 1, tracking_id: 1, hour: 8, minutes: 0 }],
            },
            {
                id: 2,
                user_id: 1,
                question: "Did I meditate?",
                state: TrackingState.PAUSED,
                frequency: { type: "weekly", days: [1, 3, 5] },
                schedules: [{ id: 2, tracking_id: 2, hour: 9, minutes: 30 }],
            },
            {
                id: 3,
                user_id: 1,
                question: "Did I read a book?",
                state: TrackingState.ARCHIVED,
                frequency: { type: "daily" },
                schedules: [{ id: 3, tracking_id: 3, hour: 20, minutes: 0 }],
            },
        ];

        it("should filter by tracking question text", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const showFiltersButton = screen.getByRole("button", { name: /show filters/i });
            await user.click(showFiltersButton);

            const filterInput = screen.getByLabelText("Filter by tracking");
            await user.type(filterInput, "exercise");

            const exerciseElements = screen.getAllByText("Did I exercise today?");
            expect(exerciseElements.length).toBeGreaterThan(0);
            expect(screen.queryByText("Did I meditate?")).not.toBeInTheDocument();
            expect(screen.queryByText("Did I read a book?")).not.toBeInTheDocument();
        });

        it("should filter by times", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const showFiltersButton = screen.getByRole("button", { name: /show filters/i });
            await user.click(showFiltersButton);

            const timesInput = screen.getByLabelText("Filter by times");
            await user.type(timesInput, "08:00");

            const exerciseElements = screen.getAllByText("Did I exercise today?");
            expect(exerciseElements.length).toBeGreaterThan(0);
            expect(screen.queryByText("Did I meditate?")).not.toBeInTheDocument();
            expect(screen.queryByText("Did I read a book?")).not.toBeInTheDocument();
        });

        it("should filter by frequency", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const showFiltersButton = screen.getByRole("button", { name: /show filters/i });
            await user.click(showFiltersButton);

            const frequencyInput = screen.getByLabelText("Filter by frequency");
            await user.type(frequencyInput, "Mon");

            const meditateElements = screen.getAllByText("Did I meditate?");
            expect(meditateElements.length).toBeGreaterThan(0);
            expect(screen.queryByText("Did I exercise today?")).not.toBeInTheDocument();
            expect(screen.queryByText("Did I read a book?")).not.toBeInTheDocument();
        });

        it("should filter by status using checkboxes", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const showFiltersButton = screen.getByRole("button", { name: /show filters/i });
            await user.click(showFiltersButton);

            const runningCheckbox = screen.getByLabelText("Filter by status: Running");
            await user.click(runningCheckbox);

            const exerciseElementsStatus = screen.getAllByText("Did I exercise today?");
            expect(exerciseElementsStatus.length).toBeGreaterThan(0);
            expect(screen.queryByText("Did I meditate?")).not.toBeInTheDocument();
            expect(screen.queryByText("Did I read a book?")).not.toBeInTheDocument();
        });

        it("should show empty message when no trackings match filters", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const showFiltersButton = screen.getByRole("button", { name: /show filters/i });
            await user.click(showFiltersButton);

            const filterInput = screen.getByLabelText("Filter by tracking");
            await user.type(filterInput, "nonexistent");

            expect(screen.getByText(/no trackings match the current filters/i)).toBeInTheDocument();
        });

        it("should apply multiple filters simultaneously", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const showFiltersButton = screen.getByRole("button", { name: /show filters/i });
            await user.click(showFiltersButton);

            const trackingInput = screen.getByLabelText("Filter by tracking");
            await user.type(trackingInput, "exercise");

            const runningCheckbox = screen.getByLabelText("Filter by status: Running");
            await user.click(runningCheckbox);

            const exerciseElements1 = screen.getAllByText("Did I exercise today?");
            expect(exerciseElements1.length).toBeGreaterThan(0);
            expect(screen.queryByText("Did I meditate?")).not.toBeInTheDocument();
            expect(screen.queryByText("Did I read a book?")).not.toBeInTheDocument();
        });

        it("should be case-insensitive when filtering by text", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const showFiltersButton = screen.getByRole("button", { name: /show filters/i });
            await user.click(showFiltersButton);

            const filterInput = screen.getByLabelText("Filter by tracking");
            await user.type(filterInput, "EXERCISE");

            const exerciseElements = screen.getAllByText("Did I exercise today?");
            expect(exerciseElements.length).toBeGreaterThan(0);
        });
    });

    describe("Sorting", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Zebra question",
                state: TrackingState.ARCHIVED,
                frequency: { type: "daily" },
                schedules: [{ id: 1, tracking_id: 1, hour: 10, minutes: 0 }],
            },
            {
                id: 2,
                user_id: 1,
                question: "Apple question",
                state: TrackingState.RUNNING,
                frequency: { type: "daily" },
                schedules: [{ id: 2, tracking_id: 2, hour: 8, minutes: 0 }],
            },
            {
                id: 3,
                user_id: 1,
                question: "Banana question",
                state: TrackingState.PAUSED,
                frequency: { type: "daily" },
                schedules: [{ id: 3, tracking_id: 3, hour: 9, minutes: 30 }],
            },
        ];

        it("should sort by tracking question ascending", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const trackingHeader = screen.getByLabelText("Sort by tracking");
            await user.click(trackingHeader);

            const rows = screen.getAllByRole("row");
            // Skip header row
            const dataRows = rows.slice(1);
            expect(dataRows[0]).toHaveTextContent("Apple question");
            expect(dataRows[1]).toHaveTextContent("Banana question");
            expect(dataRows[2]).toHaveTextContent("Zebra question");
        });

        it("should sort by tracking question descending", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const trackingHeader = screen.getByLabelText("Sort by tracking");
            await user.click(trackingHeader); // First click: asc
            await user.click(trackingHeader); // Second click: desc

            const rows = screen.getAllByRole("row");
            const dataRows = rows.slice(1);
            expect(dataRows[0]).toHaveTextContent("Zebra question");
            expect(dataRows[1]).toHaveTextContent("Banana question");
            expect(dataRows[2]).toHaveTextContent("Apple question");
        });

        it("should sort by times", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const timesHeader = screen.getByLabelText("Sort by times");
            await user.click(timesHeader);

            const rows = screen.getAllByRole("row");
            const dataRows = rows.slice(1);
            // 8:00, 9:30, 10:00
            expect(dataRows[0]).toHaveTextContent("Apple question");
            expect(dataRows[1]).toHaveTextContent("Banana question");
            expect(dataRows[2]).toHaveTextContent("Zebra question");
        });

        it("should sort by status", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const statusHeader = screen.getByLabelText("Sort by status");
            await user.click(statusHeader);

            const rows = screen.getAllByRole("row");
            const dataRows = rows.slice(1);
            // ARCHIVED, PAUSED, RUNNING alphabetically
            expect(dataRows[0]).toHaveTextContent("Zebra question");
            expect(dataRows[1]).toHaveTextContent("Banana question");
            expect(dataRows[2]).toHaveTextContent("Apple question");
        });

        it("should remove sort when clicking same column three times", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const trackingHeader = screen.getByLabelText("Sort by tracking");
            await user.click(trackingHeader); // asc
            await user.click(trackingHeader); // desc
            await user.click(trackingHeader); // none

            // Should show original order (by ID)
            const rows = screen.getAllByRole("row");
            const dataRows = rows.slice(1);
            expect(dataRows[0]).toHaveTextContent("Zebra question");
            expect(dataRows[1]).toHaveTextContent("Apple question");
            expect(dataRows[2]).toHaveTextContent("Banana question");
        });

        it("should show sort indicator when sorted", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const trackingHeader = screen.getByLabelText("Sort by tracking");
            await user.click(trackingHeader);

            const upArrowElements = screen.getAllByText("↑");
            expect(upArrowElements.length).toBeGreaterThan(0);
        });

        it("should change sort indicator direction", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const trackingHeader = screen.getByLabelText("Sort by tracking");
            await user.click(trackingHeader);
            const upArrowElements2 = screen.getAllByText("↑");
            expect(upArrowElements2.length).toBeGreaterThan(0);

            await user.click(trackingHeader);
            const downArrowElements = screen.getAllByText("↓");
            expect(downArrowElements.length).toBeGreaterThan(0);
        });
    });

    describe("Filtering and Sorting Combined", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Alpha exercise",
                state: TrackingState.RUNNING,
                frequency: { type: "daily" },
            },
            {
                id: 2,
                user_id: 1,
                question: "Beta exercise",
                state: TrackingState.RUNNING,
                frequency: { type: "daily" },
            },
            {
                id: 3,
                user_id: 1,
                question: "Gamma meditation",
                state: TrackingState.RUNNING,
                frequency: { type: "daily" },
            },
        ];

        it("should apply filters and then sort", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const showFiltersButton = screen.getByRole("button", { name: /show filters/i });
            await user.click(showFiltersButton);

            // Filter by "exercise"
            const filterInput = screen.getByLabelText("Filter by tracking");
            await user.type(filterInput, "exercise");

            // Sort by tracking
            const trackingHeader = screen.getByLabelText("Sort by tracking");
            await user.click(trackingHeader);

            const rows = screen.getAllByRole("row");
            const dataRows = rows.slice(1);
            expect(dataRows).toHaveLength(2);
            expect(dataRows[0]).toHaveTextContent("Alpha exercise");
            expect(dataRows[1]).toHaveTextContent("Beta exercise");
        });
    });

    describe("Next Reminder value updates", () => {
        const mockRefreshReminders = vi.fn().mockResolvedValue(undefined);
        const futureTime = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
        const laterFutureTime = new Date(Date.now() + 172800000).toISOString(); // Day after tomorrow
        const pastTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

        beforeEach(() => {
            mockRefreshReminders.mockClear();
        });

        describe("Reminder actions that update Next Reminder", () => {
            it("should update Next Reminder when a reminder is answered (status changes to ANSWERED)", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                // Initially, there's a PENDING reminder
                const initialReminders: ReminderData[] = [
                    {
                        id: 1,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: futureTime,
                        status: ReminderStatus.PENDING,
                        value: null
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: initialReminders,
                    refreshReminders: mockRefreshReminders,
                });

                const { rerender } = render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Should show the next reminder time (check that it's not the empty "—" symbol)
                const trackingElements = screen.getAllByText("Did I exercise?");
                const trackingRow = trackingElements[0].closest("tr");
                expect(trackingRow).toBeTruthy();
                const nextReminderCell = trackingRow?.querySelector(".cell-next-reminder");
                expect(nextReminderCell).toBeInTheDocument();
                expect(nextReminderCell).not.toHaveTextContent("—");

                // After answering, the reminder status changes to ANSWERED
                const updatedReminders: ReminderData[] = [
                    {
                        id: 1,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: futureTime,
                        status: ReminderStatus.ANSWERED,
                        value: ReminderValue.COMPLETED
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: updatedReminders,
                    refreshReminders: mockRefreshReminders,
                });

                rerender(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Next Reminder should now be empty (no PENDING or UPCOMING reminders)
                const trackingElementsAfter = screen.getAllByText("Did I exercise?");
                const trackingRowAfter = trackingElementsAfter[0].closest("tr");
                expect(trackingRowAfter).toBeTruthy();
                const emptyReminderCell = trackingRowAfter?.querySelector(".cell-next-reminder");
                expect(emptyReminderCell).toHaveTextContent("—");
            });

            it("should update Next Reminder when a reminder is snoozed (creates/updates UPCOMING reminder)", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                // Initially, there's a PENDING reminder
                const initialReminders: ReminderData[] = [
                    {
                        id: 1,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: pastTime,
                        status: ReminderStatus.PENDING,
                        value: null
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: initialReminders,
                    refreshReminders: mockRefreshReminders,
                });

                const { rerender } = render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // After snoozing, an UPCOMING reminder is created with new time
                const snoozedReminders: ReminderData[] = [
                    {
                        id: 1,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: pastTime,
                        status: ReminderStatus.PENDING,
                        value: null
                    },
                    {
                        id: 2,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: laterFutureTime,
                        status: ReminderStatus.UPCOMING,
                        value: null
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: snoozedReminders,
                    refreshReminders: mockRefreshReminders,
                });

                rerender(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Next Reminder should show the snoozed time (UPCOMING reminder) - check that it's not empty
                const trackingElements = screen.getAllByText("Did I exercise?");
                const trackingRow = trackingElements[0].closest("tr");
                expect(trackingRow).toBeTruthy();
                const nextReminderCell = trackingRow?.querySelector(".cell-next-reminder");
                expect(nextReminderCell).toBeInTheDocument();
                expect(nextReminderCell).not.toHaveTextContent("—");
            });

            it("should update Next Reminder when a reminder is deleted (creates next reminder)", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                // Initially, there's a PENDING reminder
                const initialReminders: ReminderData[] = [
                    {
                        id: 1,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: futureTime,
                        status: ReminderStatus.PENDING,
                        value: null
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: initialReminders,
                    refreshReminders: mockRefreshReminders,
                });

                const { rerender } = render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // After deleting, a new UPCOMING reminder is created
                const updatedReminders: ReminderData[] = [
                    {
                        id: 2,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: laterFutureTime,
                        status: ReminderStatus.UPCOMING,
                        value: null
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: updatedReminders,
                    refreshReminders: mockRefreshReminders,
                });

                rerender(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Next Reminder should show the new reminder time - check that it's not empty
                const trackingElements = screen.getAllByText("Did I exercise?");
                const trackingRow = trackingElements[0].closest("tr");
                expect(trackingRow).toBeTruthy();
                const nextReminderCell = trackingRow?.querySelector(".cell-next-reminder");
                expect(nextReminderCell).toBeInTheDocument();
                expect(nextReminderCell).not.toHaveTextContent("—");
            });
        });

        describe("Tracking creation/editing that updates Next Reminder", () => {
            it("should refresh reminders when a new tracking is created", () => {
                const initialTrackings: TrackingData[] = [];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: [],
                    refreshReminders: mockRefreshReminders,
                });

                const { rerender } = render(
                    <TrackingsList
                        trackings={initialTrackings}
                        onEdit={mockOnEdit}
                    />
                );

                // New tracking is created
                const newTrackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                rerender(
                    <TrackingsList
                        trackings={newTrackings}
                        onEdit={mockOnEdit}
                    />
                );

                // refreshReminders should be called when new tracking is detected
                expect(mockRefreshReminders).toHaveBeenCalled();
            });

            it("should refresh reminders when tracking schedules are edited", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                        schedules: [{ id: 1, tracking_id: 1, hour: 9, minutes: 0 }],
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: [],
                    refreshReminders: mockRefreshReminders,
                });

                const { rerender } = render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Schedules are updated
                const updatedTrackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                        schedules: [{ id: 1, tracking_id: 1, hour: 10, minutes: 30 }],
                        updated_at: new Date().toISOString(),
                    },
                ];

                rerender(
                    <TrackingsList
                        trackings={updatedTrackings}
                        onEdit={mockOnEdit}
                    />
                );

                // refreshReminders should be called when schedules change
                expect(mockRefreshReminders).toHaveBeenCalled();
            });

            it("should refresh reminders when tracking days pattern is edited", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: {
                            type: "weekly",
                            days: [1, 3, 5],
                        },
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: [],
                    refreshReminders: mockRefreshReminders,
                });

                const { rerender } = render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Days pattern is updated
                const updatedTrackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: {
                            type: "weekly",
                            days: [2, 4, 6],
                        },
                        updated_at: new Date().toISOString(),
                    },
                ];

                rerender(
                    <TrackingsList
                        trackings={updatedTrackings}
                        onEdit={mockOnEdit}
                    />
                );

                // refreshReminders should be called when frequency changes
                expect(mockRefreshReminders).toHaveBeenCalled();
            });

            it("should update Next Reminder display when reminders are refreshed after tracking edit", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                // After editing tracking, new reminder is created
                const updatedReminders: ReminderData[] = [
                    {
                        id: 1,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: futureTime,
                        status: ReminderStatus.UPCOMING,
                        value: null
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: updatedReminders,
                    refreshReminders: mockRefreshReminders,
                });

                render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Next Reminder should display the new reminder time - check that it's not empty
                const trackingElements = screen.getAllByText("Did I exercise?");
                const trackingRow = trackingElements[0].closest("tr");
                expect(trackingRow).toBeTruthy();
                const nextReminderCell = trackingRow?.querySelector(".cell-next-reminder");
                expect(nextReminderCell).toBeInTheDocument();
                expect(nextReminderCell).not.toHaveTextContent("—");
            });
        });

        describe("Tracking state changes that update Next Reminder", () => {
            it("should refresh reminders when tracking state changes to Running", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.PAUSED,
                        frequency: { type: "daily" },
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: [],
                    refreshReminders: mockRefreshReminders,
                });

                const { rerender } = render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // State changes to Running
                const updatedTrackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                rerender(
                    <TrackingsList
                        trackings={updatedTrackings}
                        onEdit={mockOnEdit}
                    />
                );

                // refreshReminders should be called when state changes
                expect(mockRefreshReminders).toHaveBeenCalled();
            });

            it("should refresh reminders when tracking state changes to Paused", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: [],
                    refreshReminders: mockRefreshReminders,
                });

                const { rerender } = render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // State changes to Paused
                const updatedTrackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.PAUSED,
                        frequency: { type: "daily" },
                    },
                ];

                rerender(
                    <TrackingsList
                        trackings={updatedTrackings}
                        onEdit={mockOnEdit}
                    />
                );

                // refreshReminders should be called when state changes
                expect(mockRefreshReminders).toHaveBeenCalled();
            });

            it("should show no Next Reminder when tracking is Paused (no new reminders generated)", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.PAUSED,
                        frequency: { type: "daily" },
                    },
                ];

                // No reminders exist (paused tracking doesn't generate new ones)
                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: [],
                    refreshReminders: mockRefreshReminders,
                });

                render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Next Reminder should be empty
                const trackingElements = screen.getAllByText("Did I exercise?");
                const trackingRow = trackingElements[0].closest("tr");
                expect(trackingRow).toBeTruthy();
                const emptyReminderCell4 = trackingRow?.querySelector(".cell-next-reminder");
                expect(emptyReminderCell4).toHaveTextContent("—");
            });

            it("should show Next Reminder when tracking is Resumed (new reminders generated)", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                // After resuming, new reminder is created
                const reminders: ReminderData[] = [
                    {
                        id: 1,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: futureTime,
                        status: ReminderStatus.UPCOMING,
                        value: null
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders,
                    refreshReminders: mockRefreshReminders,
                });

                render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Next Reminder should show the new reminder time - check that it's not empty
                const trackingElements = screen.getAllByText("Did I exercise?");
                const trackingRow = trackingElements[0].closest("tr");
                expect(trackingRow).toBeTruthy();
                const nextReminderCell = trackingRow?.querySelector(".cell-next-reminder");
                expect(nextReminderCell).toBeInTheDocument();
                expect(nextReminderCell).not.toHaveTextContent("—");
            });

            it("should show no Next Reminder when tracking is Archived", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.ARCHIVED,
                        frequency: { type: "daily" },
                    },
                ];

                // Archived tracking doesn't generate new reminders
                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders: [],
                    refreshReminders: mockRefreshReminders,
                });

                render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Next Reminder should be empty
                const trackingElements = screen.getAllByText("Did I exercise?");
                const trackingRow = trackingElements[0].closest("tr");
                expect(trackingRow).toBeTruthy();
                const emptyReminderCell1 = trackingRow?.querySelector(".cell-next-reminder");
                expect(emptyReminderCell1).toHaveTextContent("—");
            });
        });

        describe("Next Reminder calculation logic", () => {
            it("should show the earliest PENDING reminder when multiple exist", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                // Multiple PENDING reminders with different times
                const reminders: ReminderData[] = [
                    {
                        id: 1,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: laterFutureTime,
                        status: ReminderStatus.PENDING,
                        value: null
                    },
                    {
                        id: 2,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: futureTime,
                        status: ReminderStatus.PENDING,
                        value: null
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders,
                    refreshReminders: mockRefreshReminders,
                });

                render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Should show the earliest one (futureTime, not laterFutureTime) - check that it's not empty
                const trackingElements = screen.getAllByText("Did I exercise?");
                const trackingRow = trackingElements[0].closest("tr");
                expect(trackingRow).toBeTruthy();
                const nextReminderCell = trackingRow?.querySelector(".cell-next-reminder");
                expect(nextReminderCell).toBeInTheDocument();
                // Verify it shows a date (not empty)
                expect(nextReminderCell).not.toHaveTextContent("—");
            });

            it("should show the earliest UPCOMING reminder when multiple exist", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                // Multiple UPCOMING reminders with different times
                const reminders: ReminderData[] = [
                    {
                        id: 1,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: laterFutureTime,
                        status: ReminderStatus.UPCOMING,
                        value: null
                    },
                    {
                        id: 2,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: futureTime,
                        status: ReminderStatus.UPCOMING,
                        value: null
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders,
                    refreshReminders: mockRefreshReminders,
                });

                render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Should show the earliest one (futureTime, not laterFutureTime) - check that it's not empty
                const trackingElements = screen.getAllByText("Did I exercise?");
                const trackingRow = trackingElements[0].closest("tr");
                expect(trackingRow).toBeTruthy();
                const nextReminderCell = trackingRow?.querySelector(".cell-next-reminder");
                expect(nextReminderCell).toBeInTheDocument();
                // Verify it shows a date (not empty)
                expect(nextReminderCell).not.toHaveTextContent("—");
            });

            it("should prioritize PENDING over UPCOMING when both exist", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                // Both PENDING and UPCOMING reminders exist
                const reminders: ReminderData[] = [
                    {
                        id: 1,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: laterFutureTime,
                        status: ReminderStatus.UPCOMING,
                        value: null
                    },
                    {
                        id: 2,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: futureTime,
                        status: ReminderStatus.PENDING,
                        value: null
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders,
                    refreshReminders: mockRefreshReminders,
                });

                render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Should show the PENDING one (futureTime) as it's earlier - check that it's not empty
                const trackingElements = screen.getAllByText("Did I exercise?");
                const trackingRow = trackingElements[0].closest("tr");
                expect(trackingRow).toBeTruthy();
                const nextReminderCell = trackingRow?.querySelector(".cell-next-reminder");
                expect(nextReminderCell).toBeInTheDocument();
                // Verify it shows a date (not empty)
                expect(nextReminderCell).not.toHaveTextContent("—");
            });

            it("should not show past reminders in Next Reminder", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                // Only past reminders exist
                const reminders: ReminderData[] = [
                    {
                        id: 1,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: pastTime,
                        status: ReminderStatus.PENDING,
                        value: null
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders,
                    refreshReminders: mockRefreshReminders,
                });

                render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Next Reminder should be empty (past reminders are filtered out)
                const trackingElements = screen.getAllByText("Did I exercise?");
                const trackingRow = trackingElements[0].closest("tr");
                expect(trackingRow).toBeTruthy();
                const emptyReminderCell2 = trackingRow?.querySelector(".cell-next-reminder");
                expect(emptyReminderCell2).toHaveTextContent("—");
            });

            it("should not show ANSWERED reminders in Next Reminder", () => {
                const trackings: TrackingData[] = [
                    {
                        id: 1,
                        user_id: 1,
                        question: "Did I exercise?",
                        state: TrackingState.RUNNING,
                        frequency: { type: "daily" },
                    },
                ];

                // Only ANSWERED reminders exist
                const reminders: ReminderData[] = [
                    {
                        id: 1,
                        tracking_id: 1,
                        user_id: 1,
                        scheduled_time: futureTime,
                        status: ReminderStatus.ANSWERED,
                        value: ReminderValue.COMPLETED
                    },
                ];

                (useRemindersModule.useReminders as any).mockReturnValue({
                    reminders,
                    refreshReminders: mockRefreshReminders,
                });

                render(
                    <TrackingsList
                        trackings={trackings}
                        onEdit={mockOnEdit}
                    />
                );

                // Next Reminder should be empty (ANSWERED reminders are filtered out)
                const trackingElements = screen.getAllByText("Did I exercise?");
                const trackingRow = trackingElements[0].closest("tr");
                expect(trackingRow).toBeTruthy();
                const emptyReminderCell3 = trackingRow?.querySelector(".cell-next-reminder");
                expect(emptyReminderCell3).toHaveTextContent("—");
            });
        });
    });
});

