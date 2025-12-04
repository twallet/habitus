// @vitest-environment jsdom
import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReminderAnswerModal } from "../ReminderAnswerModal";
import { ReminderData, ReminderStatus } from "../../models/Reminder";
import { TrackingData, TrackingType } from "../../models/Tracking";

describe("ReminderAnswerModal", () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn().mockResolvedValue(undefined);

    const mockReminder: ReminderData = {
        id: 1,
        tracking_id: 1,
        user_id: 1,
        scheduled_time: "2024-01-01T10:00:00Z",
        status: ReminderStatus.PENDING,
    };

    const mockTracking: TrackingData = {
        id: 1,
        user_id: 1,
        question: "Did I exercise?",
        type: TrackingType.TRUE_FALSE,
        icon: "💪",
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render modal with reminder data", () => {
        render(
            <ReminderAnswerModal
                reminder={mockReminder}
                tracking={mockTracking}
                onClose={mockOnClose}
                onSave={mockOnSave}
            />
        );

        expect(screen.getByText("Answer reminder")).toBeInTheDocument();
        const trackingField = screen.getByText((_content, element) => {
            return !!(element?.classList?.contains("tracking-field") &&
                element?.textContent?.includes("Did I exercise?"));
        });
        expect(trackingField).toBeInTheDocument();
    });

    it("should show Yes/No buttons for true_false type", () => {
        render(
            <ReminderAnswerModal
                reminder={mockReminder}
                tracking={mockTracking}
                onClose={mockOnClose}
                onSave={mockOnSave}
            />
        );

        expect(screen.getByText("🟢 Yes")).toBeInTheDocument();
        expect(screen.getByText("🔘 No")).toBeInTheDocument();
    });

    it("should show text field for register type", () => {
        const registerTracking: TrackingData = {
            ...mockTracking,
            type: TrackingType.REGISTER,
        };

        render(
            <ReminderAnswerModal
                reminder={mockReminder}
                tracking={registerTracking}
                onClose={mockOnClose}
                onSave={mockOnSave}
            />
        );

        const textarea = screen.getByPlaceholderText("Enter your answer...");
        expect(textarea).toBeInTheDocument();
    });

    it("should call onSave when form is submitted", async () => {
        render(
            <ReminderAnswerModal
                reminder={mockReminder}
                tracking={mockTracking}
                onClose={mockOnClose}
                onSave={mockOnSave}
            />
        );

        const yesButton = screen.getByText("🟢 Yes");
        await userEvent.click(yesButton);

        const saveButton = screen.getByText("Save");
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith(1, "Yes", "");
        });
    });

    it("should call onClose when Cancel is clicked", async () => {
        render(
            <ReminderAnswerModal
                reminder={mockReminder}
                tracking={mockTracking}
                onClose={mockOnClose}
                onSave={mockOnSave}
            />
        );

        const cancelButton = screen.getByText("Cancel");
        await userEvent.click(cancelButton);

        expect(mockOnClose).toHaveBeenCalled();
    });

    it("should call onClose when close button is clicked", async () => {
        render(
            <ReminderAnswerModal
                reminder={mockReminder}
                tracking={mockTracking}
                onClose={mockOnClose}
                onSave={mockOnSave}
            />
        );

        const closeButton = screen.getByLabelText("Close");
        await userEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalled();
    });

    it("should prefill answer and notes when editing", () => {
        const answeredReminder: ReminderData = {
            ...mockReminder,
            answer: "Yes",
            notes: "Some notes",
            status: ReminderStatus.ANSWERED,
        };

        render(
            <ReminderAnswerModal
                reminder={answeredReminder}
                tracking={mockTracking}
                onClose={mockOnClose}
                onSave={mockOnSave}
            />
        );

        const notesTextarea = screen.getByPlaceholderText(
            "Add any additional notes..."
        );
        expect(notesTextarea).toHaveValue("Some notes");
    });

    it("should handle save with notes", async () => {
        render(
            <ReminderAnswerModal
                reminder={mockReminder}
                tracking={mockTracking}
                onClose={mockOnClose}
                onSave={mockOnSave}
            />
        );

        const yesButton = screen.getByText("🟢 Yes");
        await userEvent.click(yesButton);

        const notesTextarea = screen.getByPlaceholderText(
            "Add any additional notes..."
        );
        await userEvent.type(notesTextarea, "Felt great!");

        const saveButton = screen.getByText("Save");
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith(1, "Yes", "Felt great!");
        });
    });
});

