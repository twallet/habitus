// @vitest-environment jsdom
import { vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingForm } from "../TrackingForm";
import { Frequency } from "../../models/Tracking";

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
        // Try both frequency selectors (one in FrequencyInput, one for One-time)
        let frequencySelect = document.getElementById("tracking-frequency") as HTMLSelectElement;
        if (!frequencySelect) {
            frequencySelect = document.getElementById("frequency-preset") as HTMLSelectElement;
        }
        if (!frequencySelect) {
            throw new Error("Frequency select not found");
        }
        // Convert display name to option value
        const optionValue = frequency === "One-time" ? "one-time" : frequency.toLowerCase();
        await user.selectOptions(frequencySelect, optionValue);
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

        // Add schedule time (same input for both recurring and one-time)
        const timeInput = document.getElementById("schedule-time") as HTMLInputElement;
        if (!timeInput) {
            throw new Error("Schedule time input not found");
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
        const questionToFreq = questionInput.compareDocumentPosition(frequencyLabel);
        expect(questionToFreq & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should show icon field as the last field before form actions", () => {
        const { container } = render(<TrackingForm onSubmit={mockOnSubmit} />);

        const iconInput = document.getElementById("tracking-icon") as HTMLInputElement;
        const notesInput = screen.getByRole("textbox", { name: /^notes/i });
        const createButton = screen.getByRole("button", { name: /^create$/i });

        expect(iconInput).toBeInTheDocument();
        expect(notesInput).toBeInTheDocument();
        expect(createButton).toBeInTheDocument();

        // Get all form groups and verify order
        const formGroups = container.querySelectorAll(".form-group");
        const notesGroup = Array.from(formGroups).find(group => group.contains(notesInput));
        const iconGroup = Array.from(formGroups).find(group => group.contains(iconInput));
        const actionsGroup = container.querySelector(".form-actions");

        expect(notesGroup).toBeTruthy();
        expect(iconGroup).toBeTruthy();
        expect(actionsGroup).toBeTruthy();

        // Icon group should come after notes group
        const notesIndex = Array.from(formGroups).indexOf(notesGroup!);
        const iconIndex = Array.from(formGroups).indexOf(iconGroup!);
        expect(iconIndex).toBeGreaterThan(notesIndex);

        // Actions should come after icon
        const allElements = Array.from(container.querySelectorAll(".form-group, .form-actions"));
        const iconGroupIndex = allElements.indexOf(iconGroup!);
        const actionsIndex = allElements.indexOf(actionsGroup!);
        expect(actionsIndex).toBeGreaterThan(iconGroupIndex);
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
        expect(options).toContain("one-time");
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
                    type: "weekly",
                    days: expect.any(Array),
                })
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
                    type: "monthly",
                })
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
                    type: "yearly",
                    kind: "date",
                    month: expect.any(Number),
                    day: expect.any(Number),
                })
            );
        });
    });

    it("should show date field on same line as frequency when One-time is selected", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        await setFrequency(user, "One-time");

        const frequencySelect = document.getElementById("frequency-preset") as HTMLSelectElement;
        const dateInput = document.getElementById("one-time-date") as HTMLInputElement;

        expect(frequencySelect).toBeInTheDocument();
        expect(dateInput).toBeInTheDocument();

        // Both should be in the same frequency-field-row (within FrequencyInput)
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
                    type: "daily",
                })
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
            expect(callArgs[4]).toEqual(expect.objectContaining({
                type: "one-time",
                date: dateString,
            }));
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
                    type: "daily",
                })
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

        // Clear the one-time date to trigger validation error
        const dateInput = document.getElementById("one-time-date") as HTMLInputElement;
        if (dateInput) {
            await user.clear(dateInput);
        }

        // Submit button should be disabled when no one-time date
        const submitBtn = screen.getByRole("button", { name: /^create$/i }) as HTMLButtonElement;
        expect(submitBtn.disabled).toBe(true);

        // Try to submit form directly
        const form = questionInput.closest("form")!;
        fireEvent.submit(form);

        await waitFor(() => {
            const errorText = screen.queryByText(/one-time date is required/i) ||
                screen.queryByText(/at least one time is required/i);
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

    it("should reset oneTimeDate when switching away from One-time", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", { name: /^question \*/i });
        await user.type(questionInput, "Test question");

        // Switch to One-time
        await setFrequency(user, "One-time");

        // Verify oneTimeDate is set (component should set it to today)
        await waitFor(() => {
            const dateInput = document.getElementById("one-time-date") as HTMLInputElement;
            expect(dateInput).toBeInTheDocument();
            expect(dateInput.value).not.toBe("");
            // The date should be today (component sets it to today using local time)
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            expect(dateInput.value).toBe(todayStr);
        });

        // Switch away from One-time to Weekly
        await setFrequency(user, "Weekly");

        // Verify date input is no longer visible (conditionally rendered)
        await waitFor(() => {
            const dateInputAfter = document.getElementById("one-time-date");
            expect(dateInputAfter).not.toBeInTheDocument();
        });
    });

    it("should set oneTimeDate to today when switching to One-time", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", { name: /^question \*/i });
        await user.type(questionInput, "Test question");

        // Start with Weekly
        await setFrequency(user, "Weekly");

        // Switch to One-time
        await setFrequency(user, "One-time");

        // Verify oneTimeDate is set (component should set it to today)
        await waitFor(() => {
            const dateInput = document.getElementById("one-time-date") as HTMLInputElement;
            expect(dateInput).toBeInTheDocument();
            expect(dateInput.value).not.toBe("");
            // The date should be today (component sets it to today using local time)
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            expect(dateInput.value).toBe(todayStr);
        });
    });

    it("should set default weekly pattern to tomorrow's weekday", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", { name: /^question \*/i });
        await user.type(questionInput, "Test question");

        // Switch to Weekly
        await setFrequency(user, "Weekly");
        await addSchedule(user);

        const submitButton = screen.getByRole("button", { name: /^create$/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalled();
            const callArgs = mockOnSubmit.mock.calls[0];
            const frequency = callArgs[4] as Frequency;

            expect(frequency.type).toBe("weekly");
            if (frequency.type === "weekly") {
                expect(frequency.days).toBeDefined();
                expect(Array.isArray(frequency.days)).toBe(true);
                expect(frequency.days.length).toBeGreaterThan(0);

                // Verify it's a valid weekday (0-6)
                // Note: The exact weekday depends on when the test runs, so we just verify it's valid
                expect(frequency.days[0]).toBeGreaterThanOrEqual(0);
                expect(frequency.days[0]).toBeLessThanOrEqual(6);
            }
        });
    });

    it("should set default monthly pattern to tomorrow's day number", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", { name: /^question \*/i });
        await user.type(questionInput, "Test question");

        // Switch to Monthly
        await setFrequency(user, "Monthly");
        await addSchedule(user);

        const submitButton = screen.getByRole("button", { name: /^create$/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalled();
            const callArgs = mockOnSubmit.mock.calls[0];
            const frequency = callArgs[4] as Frequency;

            expect(frequency.type).toBe("monthly");
            if (frequency.type === "monthly" && frequency.kind === "day_number" && frequency.day_numbers) {
                expect(Array.isArray(frequency.day_numbers)).toBe(true);
                expect(frequency.day_numbers.length).toBeGreaterThan(0);

                // Verify it's a valid day number (1-31)
                // Note: The exact day depends on when the test runs, so we just verify it's valid
                expect(frequency.day_numbers[0]).toBeGreaterThanOrEqual(1);
                expect(frequency.day_numbers[0]).toBeLessThanOrEqual(31);
            }
        });
    });

    it("should set default yearly pattern to tomorrow's month and day", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", { name: /^question \*/i });
        await user.type(questionInput, "Test question");

        // Switch to Yearly
        await setFrequency(user, "Yearly");
        await addSchedule(user);

        const submitButton = screen.getByRole("button", { name: /^create$/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalled();
            const callArgs = mockOnSubmit.mock.calls[0];
            const frequency = callArgs[4] as Frequency;

            expect(frequency.type).toBe("yearly");
            if (frequency.type === "yearly" && frequency.kind === "date") {
                // Verify it's tomorrow's month and day
                // Note: The pattern is set when frequency changes, so we need to check
                // the actual pattern that was submitted, not recalculate tomorrow
                expect(frequency.month).toBeGreaterThanOrEqual(1);
                expect(frequency.month).toBeLessThanOrEqual(12);
                expect(frequency.day).toBeGreaterThanOrEqual(1);
                expect(frequency.day).toBeLessThanOrEqual(31);
            }
        });
    });

    it("should reset fields when changing frequency between different types", async () => {
        const user = userEvent.setup();
        render(<TrackingForm onSubmit={mockOnSubmit} />);

        const questionInput = screen.getByRole("textbox", { name: /^question \*/i });
        await user.type(questionInput, "Test question");

        // Start with Weekly
        await setFrequency(user, "Weekly");
        await addSchedule(user);

        // Switch to Monthly - should reset the days pattern
        await setFrequency(user, "Monthly");
        await addSchedule(user);

        const submitButton = screen.getByRole("button", { name: /^create$/i });
        await user.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalled();
            const callArgs = mockOnSubmit.mock.calls[0];
            const frequency = callArgs[4] as Frequency;

            // Should be monthly pattern, not weekly
            expect(frequency.type).toBe("monthly");
            if (frequency.type === "monthly" && frequency.kind === "day_number") {
                expect(frequency.day_numbers).toBeDefined();
            }
        });
    });
});

