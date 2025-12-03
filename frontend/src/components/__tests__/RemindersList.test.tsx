// @vitest-environment jsdom
import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemindersList } from "../RemindersList";
import { ReminderData, ReminderStatus } from "../../models/Reminder";
import { TrackingData, TrackingType } from "../../models/Tracking";
import * as useRemindersModule from "../../hooks/useReminders";
import * as useTrackingsModule from "../../hooks/useTrackings";

// Mock the hooks
vi.mock("../../hooks/useReminders", () => ({
    useReminders: vi.fn(),
}));

vi.mock("../../hooks/useTrackings", () => ({
    useTrackings: vi.fn(),
}));

describe("RemindersList", () => {
    const mockUpdateReminder = vi.fn().mockResolvedValue(undefined);
    const mockSnoozeReminder = vi.fn().mockResolvedValue(undefined);
    const mockDeleteReminder = vi.fn().mockResolvedValue(undefined);
    const mockRefreshReminders = vi.fn().mockResolvedValue(undefined);

    const mockTracking: TrackingData = {
        id: 1,
        user_id: 1,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        icon: "💪",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders: [],
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [],
        });
    });

    it("should render loading state", () => {
        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders: [],
            isLoading: true,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });

        render(<RemindersList />);

        expect(screen.getByText(/loading reminders/i)).toBeInTheDocument();
    });

    it("should render empty state when no reminders", () => {
        render(<RemindersList />);

        expect(screen.getByText(/no reminders yet/i)).toBeInTheDocument();
        expect(screen.getByText(/create your first tracking to get started/i)).toBeInTheDocument();
    });

    it("should render empty state with create link when onCreate is provided", async () => {
        const mockOnCreate = vi.fn();
        render(<RemindersList onCreate={mockOnCreate} />);

        expect(screen.getByText(/no reminders yet/i)).toBeInTheDocument();
        const createLink = screen.getByRole("button", { name: /create your first tracking/i });
        expect(createLink).toBeInTheDocument();

        await userEvent.click(createLink);
        expect(mockOnCreate).toHaveBeenCalledTimes(1);
    });

    it("should render list of reminders", () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        expect(screen.getByText("Did I exercise?")).toBeInTheDocument();
        expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("should show answer when reminder has answer", () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                answer: "Yes",
                status: ReminderStatus.ANSWERED,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        expect(screen.getByText("Yes")).toBeInTheDocument();
    });

    it("should show notes indicator when reminder has notes", () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                notes: "Some notes",
                status: ReminderStatus.PENDING,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        expect(screen.getByText("📝")).toBeInTheDocument();
    });

    it("should open answer modal when Answer is clicked", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        const statusBadge = screen.getByText("Pending");
        await userEvent.click(statusBadge);

        // Wait for dropdown to open and find Answer button in the dropdown menu
        const answerText = await screen.findByText((content, element) => {
            return content === "Answer" && element?.closest(".status-dropdown-menu") !== null;
        });
        const answerButton = answerText.closest("button");
        expect(answerButton).toBeTruthy();
        if (answerButton) {
            await userEvent.click(answerButton);
            await waitFor(() => {
                expect(screen.getByText("Answer Reminder")).toBeInTheDocument();
            });
        }
    });

    it("should show delete confirmation when Delete is clicked", async () => {
        const reminders: ReminderData[] = [
            {
                id: 1,
                tracking_id: 1,
                user_id: 1,
                scheduled_time: "2024-01-01T10:00:00Z",
                status: ReminderStatus.PENDING,
            },
        ];

        (useRemindersModule.useReminders as any).mockReturnValue({
            reminders,
            isLoading: false,
            updateReminder: mockUpdateReminder,
            snoozeReminder: mockSnoozeReminder,
            deleteReminder: mockDeleteReminder,
            refreshReminders: mockRefreshReminders,
        });
        (useTrackingsModule.useTrackings as any).mockReturnValue({
            trackings: [mockTracking],
        });

        render(<RemindersList />);

        const statusBadge = screen.getByText("Pending");
        await userEvent.click(statusBadge);

        // Wait for dropdown to open and find Delete button in the dropdown menu
        const deleteText = await screen.findByText((content, element) => {
            return content === "Delete" && element?.closest(".status-dropdown-menu") !== null;
        });
        const deleteButton = deleteText.closest("button");
        expect(deleteButton).toBeTruthy();
        if (deleteButton) {
            await userEvent.click(deleteButton);
            await waitFor(() => {
                expect(screen.getByText("Delete Reminder")).toBeInTheDocument();
            });
        }
    });
});

