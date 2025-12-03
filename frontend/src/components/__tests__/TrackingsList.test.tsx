// @vitest-environment jsdom
import { vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingsList } from "../TrackingsList";
import { TrackingData, TrackingType, DaysPatternType, TrackingState } from "../../models/Tracking";
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
        type: TrackingType.TRUE_FALSE,
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
            screen.getByText(/no trackings yet/i)
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
                type: TrackingType.TRUE_FALSE,
            },
            {
                id: 2,
                user_id: 1,
                question: "Did I meditate?",
                type: TrackingType.REGISTER,
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        expect(screen.getByText("Did I exercise today?")).toBeInTheDocument();
        expect(screen.getByText("Did I meditate?")).toBeInTheDocument();
        expect(screen.getByText("🔘")).toBeInTheDocument();
        expect(screen.getByText("🖊️")).toBeInTheDocument();
    });

    it("should call onEdit when tracking name is clicked", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
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
                type: TrackingType.TRUE_FALSE,
                icon: "💪",
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        expect(screen.getByText("💪")).toBeInTheDocument();
        expect(screen.getByText("Did I exercise?")).toBeInTheDocument();
        const trackingCell = screen.getByText("Did I exercise?").closest(".cell-tracking");
        expect(trackingCell?.textContent).toContain("💪");
        expect(trackingCell?.textContent).toContain("Did I exercise?");
    });

    it("should display only question when icon is absent", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        expect(screen.getByText("Did I exercise?")).toBeInTheDocument();
        const trackingCell = screen.getByText("Did I exercise?").closest(".cell-tracking");
        expect(trackingCell?.textContent).toBe("Did I exercise?");
        expect(trackingCell?.textContent).not.toContain("💪");
    });

    it("should display single schedule time", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
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

        expect(screen.getByText("09:00")).toBeInTheDocument();
    });

    it("should display first time with count for multiple schedules", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
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

        expect(screen.getByText(/09:00 \+2/)).toBeInTheDocument();
    });

    it("should display tooltip with all times", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
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

        const timesCell = screen.getByText(/09:00 \+1/);
        expect(timesCell).toHaveAttribute("title", "09:00, 14:30");
    });

    it("should truncate long questions", () => {
        const longQuestion = "A".repeat(60);
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: longQuestion,
                type: TrackingType.TRUE_FALSE,
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
                type: TrackingType.TRUE_FALSE,
                icon: "💪",
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
                type: TrackingType.TRUE_FALSE,
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
                type: TrackingType.TRUE_FALSE,
                days: {
                    pattern_type: DaysPatternType.INTERVAL,
                    interval_value: 1,
                    interval_unit: "days",
                },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        expect(screen.getByText("Daily")).toBeInTheDocument();
    });

    it("should display frequency for weekly pattern", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                days: {
                    pattern_type: DaysPatternType.DAY_OF_WEEK,
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

        expect(screen.getByText("Mon, Wed, Fri")).toBeInTheDocument();
    });

    it("should display frequency for monthly pattern", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                days: {
                    pattern_type: DaysPatternType.DAY_OF_MONTH,
                    type: "day_number",
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

        expect(screen.getByText("Days 1, 15 of month")).toBeInTheDocument();
    });

    it("should display frequency for yearly pattern", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                days: {
                    pattern_type: DaysPatternType.DAY_OF_YEAR,
                    type: "date",
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

        expect(screen.getByText("January 1")).toBeInTheDocument();
    });

    it("should display default frequency when days pattern is missing", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        expect(screen.getByText("Daily")).toBeInTheDocument();
    });

    it("should display next reminder time in tooltip", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                days: {
                    pattern_type: DaysPatternType.DAY_OF_WEEK,
                    days: [1, 3, 5],
                },
            },
        ];

        // Mock useReminders to return no reminders (default behavior)
        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders: [],
        });

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const frequencyCell = screen.getByText("Mon, Wed, Fri");
        expect(frequencyCell).toHaveAttribute("title", "No upcoming reminder");
    });

    it("should display full type label in tooltip", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const typeCell = screen.getByText("🔘");
        expect(typeCell).toHaveAttribute("title", "Yes/No");
    });


    it("should display table headers", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        expect(screen.getByText("Tracking")).toBeInTheDocument();
        expect(screen.getByText("Type")).toBeInTheDocument();
        expect(screen.getByText("Times")).toBeInTheDocument();
        expect(screen.getByText("Frequency")).toBeInTheDocument();
        expect(screen.getByText("Status")).toBeInTheDocument();
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

        const createButton = screen.getByRole("button", { name: /create your first tracking/i });
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

        expect(screen.getByText(/no trackings yet/i)).toBeInTheDocument();
        expect(screen.getByText(/create your first tracking to get started!/i)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /create your first tracking/i })).not.toBeInTheDocument();
    });

    it("should handle trackings with all fields populated", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise today?",
                type: TrackingType.REGISTER,
                icon: "🏋️",
                notes: "<p>Exercise notes</p>",
                schedules: [
                    { id: 1, tracking_id: 1, hour: 9, minutes: 0 },
                    { id: 2, tracking_id: 1, hour: 18, minutes: 30 },
                ],
                days: {
                    pattern_type: DaysPatternType.DAY_OF_WEEK,
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

        expect(screen.getByText("🏋️")).toBeInTheDocument();
        expect(screen.getByText("Did I exercise today?")).toBeInTheDocument();
        const trackingCell = screen.getByText("Did I exercise today?").closest(".cell-tracking");
        expect(trackingCell?.textContent).toContain("🏋️");
        expect(trackingCell?.textContent).toContain("Did I exercise today?");
        expect(screen.getByText("🖊️")).toBeInTheDocument();
        expect(screen.getByText(/09:00 \+1/)).toBeInTheDocument();
        expect(screen.getByText("Mon, Wed, Fri")).toBeInTheDocument();
    });

    it("should handle trackings with no schedules", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const timesCell = screen.getByText("Did I exercise?").closest("tr")?.querySelector(".cell-times");
        expect(timesCell?.textContent).toBe("");
        expect(timesCell).toHaveAttribute("title", "No times");
    });

    it("should format interval frequency correctly", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                days: {
                    pattern_type: DaysPatternType.INTERVAL,
                    interval_value: 2,
                    interval_unit: "weeks",
                },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        expect(screen.getByText("Every 2 weeks")).toBeInTheDocument();
    });

    it("should format last day of month pattern", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                days: {
                    pattern_type: DaysPatternType.DAY_OF_MONTH,
                    type: "last_day",
                },
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        expect(screen.getByText("Last day of month")).toBeInTheDocument();
    });

    it("should format weekday ordinal pattern", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                days: {
                    pattern_type: DaysPatternType.DAY_OF_MONTH,
                    type: "weekday_ordinal",
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

        expect(screen.getByText("Second Monday of month")).toBeInTheDocument();
    });

    it("should format all days of week as Daily", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                days: {
                    pattern_type: DaysPatternType.DAY_OF_WEEK,
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

        expect(screen.getByText("Daily")).toBeInTheDocument();
    });


    it("should show delete confirmation modal when delete button is clicked for archived tracking", async () => {
        const user = userEvent.setup();
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                state: TrackingState.ARCHIVED,
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // Find the status badge and open dropdown
        const statusBadge = screen.getByRole("button", { name: /current status: archived/i });
        await user.click(statusBadge);

        // Find the delete button in the dropdown
        const deleteButton = await screen.findByRole("button", { name: /change state to deleted/i });
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
                type: TrackingType.TRUE_FALSE,
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

        // Find the status badge and open dropdown
        const statusBadge = screen.getByRole("button", { name: /current status: paused/i });
        await user.click(statusBadge);

        // Find the resume button in the dropdown
        const resumeButton = await screen.findByRole("button", { name: /change state to running/i });
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
                type: TrackingType.TRUE_FALSE,
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

        // Find the status badge and open dropdown
        const statusBadge = screen.getByRole("button", { name: /current status: archived/i });
        await user.click(statusBadge);

        // Click delete button in dropdown
        const deleteButton = await screen.findByRole("button", { name: /change state to deleted/i });
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
                type: TrackingType.TRUE_FALSE,
                state: TrackingState.ARCHIVED,
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // Find the status badge and open dropdown
        const statusBadge = screen.getByRole("button", { name: /current status: archived/i });
        await user.click(statusBadge);

        // Click delete button in dropdown
        const deleteButton = await screen.findByRole("button", { name: /change state to deleted/i });
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

    it("should filter out deleted trackings from display", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                state: TrackingState.RUNNING,
            },
            {
                id: 2,
                user_id: 1,
                question: "Did I meditate?",
                type: TrackingType.TRUE_FALSE,
                state: TrackingState.DELETED,
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        // Only the running tracking should be visible
        expect(screen.getByText("Did I exercise?")).toBeInTheDocument();
        expect(screen.queryByText("Did I meditate?")).not.toBeInTheDocument();
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
                    type: TrackingType.TRUE_FALSE,
                    state: TrackingState.RUNNING,
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
                    type: TrackingType.TRUE_FALSE,
                    state: TrackingState.RUNNING,
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
                    type: TrackingType.TRUE_FALSE,
                    state: TrackingState.RUNNING,
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
                type: TrackingType.TRUE_FALSE,
                state: TrackingState.RUNNING,
                schedules: [{ id: 1, tracking_id: 1, hour: 8, minutes: 0 }],
                days: { pattern_type: DaysPatternType.INTERVAL, interval_value: 1, interval_unit: "days" },
            },
            {
                id: 2,
                user_id: 1,
                question: "Did I meditate?",
                type: TrackingType.REGISTER,
                state: TrackingState.PAUSED,
                schedules: [{ id: 2, tracking_id: 2, hour: 9, minutes: 30 }],
                days: { pattern_type: DaysPatternType.DAY_OF_WEEK, days: [1, 3, 5] },
            },
            {
                id: 3,
                user_id: 1,
                question: "Did I read a book?",
                type: TrackingType.TRUE_FALSE,
                state: TrackingState.ARCHIVED,
                schedules: [{ id: 3, tracking_id: 3, hour: 20, minutes: 0 }],
                days: { pattern_type: DaysPatternType.INTERVAL, interval_value: 1, interval_unit: "days" },
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

            expect(screen.getByText("Did I exercise today?")).toBeInTheDocument();
            expect(screen.queryByText("Did I meditate?")).not.toBeInTheDocument();
            expect(screen.queryByText("Did I read a book?")).not.toBeInTheDocument();
        });

        it("should filter by type using checkboxes", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const showFiltersButton = screen.getByRole("button", { name: /show filters/i });
            await user.click(showFiltersButton);

            const yesNoCheckbox = screen.getByLabelText("Filter by type: Yes/No");
            await user.click(yesNoCheckbox);

            expect(screen.getByText("Did I exercise today?")).toBeInTheDocument();
            expect(screen.getByText("Did I read a book?")).toBeInTheDocument();
            expect(screen.queryByText("Did I meditate?")).not.toBeInTheDocument();
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

            expect(screen.getByText("Did I exercise today?")).toBeInTheDocument();
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

            expect(screen.getByText("Did I meditate?")).toBeInTheDocument();
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

            expect(screen.getByText("Did I exercise today?")).toBeInTheDocument();
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

            const yesNoCheckbox = screen.getByLabelText("Filter by type: Yes/No");
            await user.click(yesNoCheckbox);

            expect(screen.getByText("Did I exercise today?")).toBeInTheDocument();
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

            expect(screen.getByText("Did I exercise today?")).toBeInTheDocument();
        });
    });

    describe("Sorting", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Zebra question",
                type: TrackingType.REGISTER,
                state: TrackingState.ARCHIVED,
                schedules: [{ id: 1, tracking_id: 1, hour: 10, minutes: 0 }],
            },
            {
                id: 2,
                user_id: 1,
                question: "Apple question",
                type: TrackingType.TRUE_FALSE,
                state: TrackingState.RUNNING,
                schedules: [{ id: 2, tracking_id: 2, hour: 8, minutes: 0 }],
            },
            {
                id: 3,
                user_id: 1,
                question: "Banana question",
                type: TrackingType.TRUE_FALSE,
                state: TrackingState.PAUSED,
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

        it("should sort by type", async () => {
            const user = userEvent.setup();
            render(
                <TrackingsList
                    trackings={trackings}
                    onEdit={mockOnEdit}
                />
            );

            const typeHeader = screen.getByLabelText("Sort by type");
            await user.click(typeHeader);

            const rows = screen.getAllByRole("row");
            const dataRows = rows.slice(1);
            // "register" comes before "true_false" alphabetically
            expect(dataRows[0]).toHaveTextContent("Zebra question");
            expect(dataRows[1]).toHaveTextContent("Apple question");
            expect(dataRows[2]).toHaveTextContent("Banana question");
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

            expect(screen.getByText("↑")).toBeInTheDocument();
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
            expect(screen.getByText("↑")).toBeInTheDocument();

            await user.click(trackingHeader);
            expect(screen.getByText("↓")).toBeInTheDocument();
        });
    });

    describe("Filtering and Sorting Combined", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Alpha exercise",
                type: TrackingType.TRUE_FALSE,
                state: TrackingState.RUNNING,
            },
            {
                id: 2,
                user_id: 1,
                question: "Beta exercise",
                type: TrackingType.TRUE_FALSE,
                state: TrackingState.RUNNING,
            },
            {
                id: 3,
                user_id: 1,
                question: "Gamma meditation",
                type: TrackingType.REGISTER,
                state: TrackingState.RUNNING,
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
});

