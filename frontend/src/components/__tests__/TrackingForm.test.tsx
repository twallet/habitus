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

    it("should render form elements", () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        expect(
            screen.getByRole("textbox", { name: /^question \*/i })
        ).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: /^type \*/i })).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /create tracking/i })
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
            name: /create tracking/i,
        });

        await user.type(questionInput, "Did I exercise today?");
        await user.selectOptions(typeSelect, TrackingType.TRUE_FALSE);
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith(
                "Did I exercise today?",
                TrackingType.TRUE_FALSE,
                undefined,
                undefined,
                undefined
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
            name: /^notes$/i,
        });
        const submitButton = screen.getByRole("button", {
            name: /create tracking/i,
        });

        await user.type(questionInput, "Did I exercise?");
        await user.type(notesInput, "Exercise notes");
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith(
                "Did I exercise?",
                TrackingType.TRUE_FALSE,
                undefined,
                "Exercise notes",
                undefined
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
        await user.click(
            screen.getByRole("button", { name: /create tracking/i })
        );

        expect(
            screen.getByText(/must not exceed 500 characters/i)
        ).toBeInTheDocument();
        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should clear form after successful submission", async () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);
        const user = userEvent.setup();

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        }) as HTMLInputElement;
        await user.type(questionInput, "Did I exercise?");
        await user.click(
            screen.getByRole("button", { name: /create tracking/i })
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
            name: /creating/i,
        }) as HTMLButtonElement;
        expect(submitButton.disabled).toBe(true);
    });

    it("should disable submit button when question is empty", () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const submitButton = screen.getByRole("button", {
            name: /create tracking/i,
        }) as HTMLButtonElement;
        expect(submitButton.disabled).toBe(true);
    });
});

