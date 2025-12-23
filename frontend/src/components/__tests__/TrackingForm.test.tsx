// @vitest-environment jsdom
import { vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingForm } from "../TrackingForm";
import { DaysPatternType } from "../../models/Tracking";

describe("TrackingForm", () => {
    const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Helper function to set frequency.
     * @param user - User event instance
     * @param frequency - Frequency value (default: "Daily")
     */
    const setFrequency = async (user: ReturnType<typeof userEvent.setup>, frequency: "Daily" | "Weekly" | "Monthly" | "Yearly" | "One-time" = "Daily") => {
        // Try both frequency selectors (one in DaysPatternInput, one for One-time)
        let frequencySelect = document.getElementById("tracking-frequency") as HTMLSelectElement;
        if (!frequencySelect) {
            frequencySelect = document.getElementById("frequency-preset") as HTMLSelectElement;
        }
        if (!frequencySelect) {
            throw new Error("Frequency select not found");
        }
        await user.selectOptions(frequencySelect, frequency);
    };

    /**
     * Helper function to add a schedule in tests (requires recurring mode).
     * @param user - User event instance
     * @param hour - Hour value (default: 9)
     * @param minutes - Minutes value (default: 0)
     */
    const addSchedule = async (
        user: ReturnType<typeof userEvent.setup>,
        hour: number = 9,
        minutes: number = 0
    ) => {
        const timeInput = document.getElementById("schedule-time") as HTMLInputElement;
        if (!timeInput) {
            throw new Error("Time input not found");
        }
        const buttons = screen.getAllByRole("button", { name: /^add$/i });
        const addButton = buttons.find(btn => btn.getAttribute("type") === "button" && btn.textContent === "Add") as HTMLButtonElement;

        const timeValue = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        await user.clear(timeInput);
        await user.type(timeInput, timeValue);
        await user.click(addButton);
    };

    /**
     * Helper function to set one-time date and add a schedule.
     * @param user - User event instance
     * @param date - Date string in format "YYYY-MM-DD"
     * @param hour - Hour value (default: extracts from dateTime if provided, or uses 9)
     * @param minutes - Minutes value (default: extracts from dateTime if provided, or uses 0)
     */
    const setOneTimeDateAndSchedule = async (
        user: ReturnType<typeof userEvent.setup>,
        date: string,
        hour: number = 9,
        minutes: number = 0
    ) => {
        const dateInput = document.getElementById("one-time-date") as HTMLInputElement;
        if (!dateInput) {
            throw new Error("One-time date input not found");
        }
        await user.clear(dateInput);
        await user.type(dateInput, date);

        // Add schedule time
        const timeInput = document.getElementById("one-time-schedule-time") as HTMLInputElement;
        if (!timeInput) {
            throw new Error("One-time schedule time input not found");
        }
        const timeValue = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        await user.clear(timeInput);
        await user.type(timeInput, timeValue);

        const addButtons = screen.getAllByRole("button", { name: /^add$/i });
        const addButton = addButtons.find(btn => btn.getAttribute("type") === "button" && btn.textContent === "Add") as HTMLButtonElement;
        if (addButton) {
            await user.click(addButton);
        }
    };

    it("should render form elements", () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        expect(
            screen.getByRole("textbox", { name: /^question \*/i })
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();
    });

    it("should show frequency field below question field", () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", { name: /^question \*/i });
        const frequencyLabel = screen.getByText(/^frequency/i);

        // Frequency should appear after question in the DOM
        expect(questionInput.compareDocumentPosition(frequencyLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it("should show icon field as the last field before form actions", () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const iconInput = document.getElementById("tracking-icon") as HTMLInputElement;
        const notesInput = screen.getByRole("textbox", { name: /^notes/i });
        const createButton = screen.getByRole("button", { name: /^create$/i });

        expect(iconInput).toBeInTheDocument();
        expect(notesInput).toBeInTheDocument();
        expect(createButton).toBeInTheDocument();

        // Icon should appear after notes in the DOM
        expect(notesInput.compareDocumentPosition(iconInput)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        // Icon should appear before create button
        expect(iconInput.compareDocumentPosition(createButton)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    });

    it("should default to Daily frequency", () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const frequencySelect = document.getElementById("frequency-preset") as HTMLSelectElement;
        expect(frequencySelect).toBeInTheDocument();
        expect(frequencySelect.value).toBe("daily");
    });

    it("should show all frequency options: Daily, Weekly, Monthly, Yearly, One-time", () => {
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const frequencySelect = document.getElementById("frequency-preset") as HTMLSelectElement;
        expect(frequencySelect).toBeInTheDocument();

        const options = Array.from(frequencySelect.options).map(opt => opt.value);
        expect(options).toContain("daily");
        expect(options).toContain("weekly");
        expect(options).toContain("monthly");
        expect(options).toContain("yearly");
        expect(options).toContain("One-time");
    });

    it("should create DAY_OF_WEEK pattern when Weekly is selected", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", { name: /^question \*/i });
        await user.type(questionInput, "Did I exercise?");

        await setFrequency(user, "Weekly");
        await addSchedule(user);

        const submitButton = screen.getByRole("button", { name: /^create$/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith(
                "Did I exercise?",
                undefined,
                undefined,
                [{ hour: 9, minutes: 0 }],
                expect.objectContaining({
                    pattern_type: DaysPatternType.DAY_OF_WEEK,
                    days: expect.any(Array),
                }),
                undefined
            );
        });
    });

    it("should create DAY_OF_MONTH pattern when Monthly is selected", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", { name: /^question \*/i });
        await user.type(questionInput, "Did I exercise?");

        await setFrequency(user, "Monthly");
        await addSchedule(user);

        const submitButton = screen.getByRole("button", { name: /^create$/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith(
                "Did I exercise?",
                undefined,
                undefined,
                [{ hour: 9, minutes: 0 }],
                expect.objectContaining({
                    pattern_type: DaysPatternType.DAY_OF_MONTH,
                }),
                undefined
            );
        });
    });

    it("should create DAY_OF_YEAR pattern when Yearly is selected", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", { name: /^question \*/i });
        await user.type(questionInput, "Did I exercise?");

        await setFrequency(user, "Yearly");
        await addSchedule(user);

        const submitButton = screen.getByRole("button", { name: /^create$/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith(
                "Did I exercise?",
                undefined,
                undefined,
                [{ hour: 9, minutes: 0 }],
                expect.objectContaining({
                    pattern_type: DaysPatternType.DAY_OF_YEAR,
                    type: "date",
                    month: expect.any(Number),
                    day: expect.any(Number),
                }),
                undefined
            );
        });
    });

    it("should show date field on same line as frequency when One-time is selected", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        await setFrequency(user, "One-time");

        const frequencySelect = document.getElementById("tracking-frequency") as HTMLSelectElement;
        const dateInput = document.getElementById("one-time-date") as HTMLInputElement;

        expect(frequencySelect).toBeInTheDocument();
        expect(dateInput).toBeInTheDocument();

        // Both should be in the same frequency-field-row
        const frequencyFieldRow = frequencySelect.closest(".frequency-field-row");
        const dateFieldRow = dateInput.closest(".frequency-field-row");
        expect(frequencyFieldRow).toBe(dateFieldRow);
    });

    it("should reset frequency to Daily after successful submission", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", { name: /^question \*/i });
        await user.type(questionInput, "Did I exercise?");
        await setFrequency(user, "Weekly");
        await addSchedule(user);

        const submitBtn = screen.getByRole("button", { name: /^create$/i });
        await user.click(submitBtn);

        await waitFor(() => {
            const frequencySelect = document.getElementById("frequency-preset") as HTMLSelectElement;
            expect(frequencySelect.value).toBe("daily");
        });
    });


    it("should call onSubmit with form data when submitted (recurring)", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        });

        await user.type(questionInput, "Did I exercise today?");
        // Frequency defaults to Daily, so no need to change it
        await addSchedule(user);
        const submitButton = screen.getByRole("button", { name: /^create$/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith(
                "Did I exercise today?",
                undefined,
                undefined,
                [{ hour: 9, minutes: 0 }],
                expect.objectContaining({
                    pattern_type: DaysPatternType.INTERVAL,
                    interval_value: 1,
                    interval_unit: "days",
                }),
                undefined
            );
        });
    });

    it("should call onSubmit with form data when submitted (one-time)", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        });

        await user.type(questionInput, "Did I exercise today?");
        await setFrequency(user, "One-time");
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1); // Tomorrow to avoid time validation issues
        const dateString = futureDate.toISOString().slice(0, 10); // YYYY-MM-DD
        await setOneTimeDateAndSchedule(user, dateString, 9, 0);
        const submitButton = screen.getByRole("button", { name: /^create$/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalled();
            const callArgs = mockOnSubmit.mock.calls[0];
            expect(callArgs[0]).toBe("Did I exercise today?");
            expect(callArgs[1]).toBeUndefined();
            expect(callArgs[2]).toBeUndefined();
            expect(callArgs[3]).toHaveLength(1);
            expect(callArgs[3][0]).toEqual({ hour: 9, minutes: 0 });
            expect(callArgs[4]).toBeUndefined();
            expect(callArgs[5]).toBe(dateString);
        });
    });

    it("should call onSubmit with notes when provided (recurring)", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        });
        const notesInput = screen.getByRole("textbox", {
            name: /^notes \?/i,
        });
        await user.type(questionInput, "Did I exercise?");
        await user.type(notesInput, "Exercise notes");
        // Frequency defaults to Daily, so no need to change it
        await addSchedule(user);
        const submitButton = screen.getByRole("button", { name: /^create$/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalledWith(
                "Did I exercise?",
                "Exercise notes",
                undefined,
                [{ hour: 9, minutes: 0 }],
                expect.objectContaining({
                    pattern_type: DaysPatternType.INTERVAL,
                    interval_value: 1,
                    interval_unit: "days",
                }),
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
        const longQuestion = "a".repeat(101);
        fireEvent.change(questionInput, { target: { value: longQuestion } });
        await setFrequency(user, "One-time");
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1); // Tomorrow
        const dateString = futureDate.toISOString().slice(0, 10); // YYYY-MM-DD
        await setOneTimeDateAndSchedule(user, dateString, 9, 0);
        const form = questionInput.closest("form")!;
        fireEvent.submit(form);

        await waitFor(() => {
            expect(
                screen.getByText(/must not exceed 100 characters/i)
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
        await setFrequency(user, "One-time");
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1); // Tomorrow
        const dateString = futureDate.toISOString().slice(0, 10); // YYYY-MM-DD
        await setOneTimeDateAndSchedule(user, dateString, 9, 0);
        const submitBtn = screen.getByRole("button", { name: /^create$/i });
        await user.click(submitBtn);

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

        const submitBtn = screen.getByRole("button", { name: /^create$/i }) as HTMLButtonElement;
        expect(submitBtn.disabled).toBe(true);
    });

    it("should disable submit button when no one-time date is set", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        }) as HTMLInputElement;
        await user.type(questionInput, "Test question");
        await setFrequency(user, "One-time");

        const submitBtn = screen.getByRole("button", { name: /^create$/i }) as HTMLButtonElement;
        expect(submitBtn.disabled).toBe(true);
    });

    it("should show error when submitting without one-time date", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        });
        await user.type(questionInput, "Did I exercise?");
        await setFrequency(user, "One-time");

        // Submit button should be disabled when no one-time date
        const submitBtn = screen.getByRole("button", { name: /^create$/i }) as HTMLButtonElement;
        expect(submitBtn.disabled).toBe(true);

        // Try to submit form directly
        const form = questionInput.closest("form")!;
        fireEvent.submit(form);

        await waitFor(() => {
            const errorText = screen.queryByText(/date is required for one-time tracking/i) ||
                screen.queryByText(/at least one time is required for one-time tracking/i);
            expect(errorText).toBeInTheDocument();
        });
        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it("should show error when submitting recurring without schedules", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", {
            name: /^question \*/i,
        });
        await user.type(questionInput, "Did I exercise?");
        // Frequency defaults to Daily, so no need to change it

        // Submit button should be disabled when no schedules
        const submitBtn = screen.getByRole("button", { name: /^create$/i }) as HTMLButtonElement;
        expect(submitBtn.disabled).toBe(true);

        // Try to submit form directly
        const form = questionInput.closest("form")!;
        fireEvent.submit(form);

        await waitFor(() => {
            expect(
                screen.getByText(/at least one time is required/i)
            ).toBeInTheDocument();
        });
        expect(mockOnSubmit).not.toHaveBeenCalled();
    });
});

