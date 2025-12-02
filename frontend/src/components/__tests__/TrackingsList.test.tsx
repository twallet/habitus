// @vitest-environment jsdom
import { vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingsList } from "../TrackingsList";
import { TrackingData, TrackingType, DaysPatternType } from "../../models/Tracking";

describe("TrackingsList", () => {
    const mockOnEdit = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
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

    it("should call onEdit when edit button is clicked", () => {
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

        const editButton = screen.getByRole("button", { name: /edit/i });
        fireEvent.click(editButton);

        expect(mockOnEdit).toHaveBeenCalledWith(trackings[0]);
        expect(mockOnEdit).toHaveBeenCalledTimes(1);
    });

    it("should display notes when present", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                notes: "<p>Some notes</p>",
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        expect(screen.getByText("📝")).toBeInTheDocument();
    });

    it("should not display notes section when notes are absent", () => {
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

        expect(screen.queryByText("📝")).not.toBeInTheDocument();
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

        const questionCell = screen.getByTitle(longQuestion);
        expect(questionCell.textContent).toBe(longQuestion.substring(0, 50) + "...");
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

        const questionCell = screen.getByTitle(longQuestion);
        expect(questionCell).toHaveAttribute("title", longQuestion);
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

    it("should display full frequency details in tooltip", () => {
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

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const frequencyCell = screen.getByText("Mon, Wed, Fri");
        expect(frequencyCell).toHaveAttribute("title", "Frequency: Weekly (Monday, Wednesday, Friday)");
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

    it("should display stripped HTML notes in tooltip", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                notes: "<p>Some <strong>notes</strong></p>",
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        const notesCell = screen.getByText("📝");
        expect(notesCell).toHaveAttribute("title", "Some notes");
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
        expect(screen.getByText("Notes")).toBeInTheDocument();
        expect(screen.getByText("Actions")).toBeInTheDocument();
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
        expect(screen.getByText("📝")).toBeInTheDocument();
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

    it("should handle empty notes tooltip", () => {
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

        const notesCell = screen.getByText("Did I exercise?").closest("tr")?.querySelector(".cell-notes");
        expect(notesCell).toHaveAttribute("title", "");
    });
});

