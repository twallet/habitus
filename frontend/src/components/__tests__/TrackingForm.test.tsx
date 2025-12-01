// @vitest-environment jsdom
import { vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingForm } from "../TrackingForm";
import { TrackingType } from "../../models/Tracking";

describe("TrackingForm", () => {
    const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Helper function to add a schedule in tests.
     * @param user - User event instance
     * @param hour - Hour value (default: 9)
     * @param minutes - Minutes value (default: 0)
     */
    const addSchedule = async (
        user: ReturnType<typeof userEvent.setup>,
        hour: number = 9,
        minutes: number = 0
    ) => {
        const hourInput = screen.getByLabelText(/^hour$/i) as HTMLInputElement;
        const minutesInput = screen.getByLabelText(/^minutes$/i) as HTMLInputElement;
        const addButton = screen.getByRole("button", { name: /add schedule/i });

        await user.clear(hourInput);
        await user.type(hourInput, hour.toString());
        await user.clear(minutesInput);
        await user.type(minutesInput, minutes.toString());
        await user.click(addButton);
    };

    it("should render form elements", () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        expect(
            screen.getByRole("textbox", { name: /^question \*/i })
        ).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: /^type \*/i })).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /^add$/i })
        ).toBeInTheDocument();
    });

    it("should update character count as user types", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        });
        await user.type(questionInput, "Did I exercise?");

        // Character count should be visible after typing
        // "Did I exercise?" has 15 characters
        expect(screen.getByText(/15\/500/i)).toBeInTheDocument();
    });

    it("should call onSubmit with form data when submitted", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        });
        const typeSelect = screen.getByRole("combobox", {
            name: /^type \*/i,
        });
        const submitButton = screen.getByRole("button", {
            name: /^add$/i,
        });

        await user.type(questionInput, "Did I exercise today?");
        await user.selectOptions(typeSelect, TrackingType.TRUE_FALSE);
        await addSchedule(user);
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith(
                "Did I exercise today?",
                TrackingType.TRUE_FALSE,
                undefined,
                undefined,
                [{ hour: 9, minutes: 0 }]
            );
        });
    });

    it("should call onSubmit with notes when provided", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        });
        const notesInput = screen.getByRole("textbox", {
            name: /^notes \?/i,
        });
        const submitButton = screen.getByRole("button", {
            name: /^add$/i,
        });

        await user.type(questionInput, "Did I exercise?");
        await user.type(notesInput, "Exercise notes");
        await addSchedule(user);
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith(
                "Did I exercise?",
                TrackingType.TRUE_FALSE,
                "Exercise notes",
                undefined,
                [{ hour: 9, minutes: 0 }]
            );
        });
    });

    it("should show error when question is empty", async () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        });
        const form = questionInput.closest("form")!;

        // Submit form with empty question
        fireEvent.submit(form);

        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should show error when question exceeds max length", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        }) as HTMLInputElement;
        const longQuestion = "a".repeat(501);
        fireEvent.change(questionInput, { target: { value: longQuestion } });
        await addSchedule(user);
        const form = questionInput.closest("form")!;
        fireEvent.submit(form);

        await waitFor(() => {
            expect(
                screen.getByText(/must not exceed 500 characters/i)
            ).toBeInTheDocument();
        });
        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should clear form after successful submission", async () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);
        const user = userEvent.setup();

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        }) as HTMLInputElement;
        await user.type(questionInput, "Did I exercise?");
        await addSchedule(user);
        await user.click(
            screen.getByRole("button", { name: /^add$/i })
        );

        await waitFor(() => {
            expect(questionInput.value).toBe("");
        });
    });

    it("should call onCancel when cancel button is clicked", async () => {
        const user = userEvent.setup();
        const mockOnCancel = vi.fn();
        render(<TrackingForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        const cancelButton = screen.getByRole("button", { name: /cancel/i });
        await user.click(cancelButton);

        expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it("should disable submit button when isSubmitting", () => {
        render(<TrackingForm onSubmit={mockOnSubmit} isSubmitting={true} />);

        const submitButton = screen.getByRole("button", {
            name: /adding/i,
        }) as HTMLButtonElement;
        expect(submitButton.disabled).toBe(true);
    });

    it("should disable submit button when question is empty", () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const submitButton = screen.getByRole("button", {
            name: /^add$/i,
        }) as HTMLButtonElement;
        expect(submitButton.disabled).toBe(true);
    });

    it("should disable submit button when no schedules are added", () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        }) as HTMLInputElement;
        fireEvent.change(questionInput, { target: { value: "Test question" } });

        const submitButton = screen.getByRole("button", {
            name: /^add$/i,
        }) as HTMLButtonElement;
        expect(submitButton.disabled).toBe(true);
    });

    it("should show error when submitting without schedules", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        });
        await user.type(questionInput, "Did I exercise?");

        // Submit button should be disabled when no schedules
        const submitButton = screen.getByRole("button", {
            name: /^add$/i,
        }) as HTMLButtonElement;
        expect(submitButton.disabled).toBe(true);

        // Try to submit form directly
        const form = questionInput.closest("form")!;
        fireEvent.submit(form);

        await waitFor(() => {
            expect(
                screen.getByText(/at least one schedule is required/i)
            ).toBeInTheDocument();
        });
        expect(mockOnSubmit).not.toHaveBeenCalled();
    });
});

