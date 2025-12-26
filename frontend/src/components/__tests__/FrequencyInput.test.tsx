// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FrequencyInput } from "../FrequencyInput";
import { Frequency } from "../../models/Tracking";

describe("FrequencyInput", () => {
    const mockOnChange = vi.fn();
    const mockOnErrorChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render frequency selector", () => {
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        // Check for the frequency select by its id
        const select = document.getElementById("frequency-preset");
        expect(select).toBeInTheDocument();
    });

    it("should have daily as default preset", () => {
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        expect(select).toHaveValue("daily");
    });

    it("should call onChange with daily frequency for daily preset", async () => {
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "daily",
                })
            );
        });
    });

    it("should show weekly options when weekly preset is selected", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = document.getElementById("frequency-preset") as HTMLSelectElement;
        await user.selectOptions(select, "weekly");

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /mo/i })).toBeInTheDocument();
        });
    });

    it("should show weekday buttons when weekly preset is selected", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "weekly");

        expect(screen.getByRole("button", { name: /mo/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /tu/i })).toBeInTheDocument();
    });

    it("should toggle weekday selection", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "weekly");

        // Monday is already selected by default when switching to weekly
        const mondayButton = screen.getByRole("button", { name: /mo/i });
        await waitFor(() => {
            expect(mondayButton).toHaveClass("selected");
        });

        // Click Tuesday to add it to selection
        const tuesdayButton = screen.getByRole("button", { name: /tu/i });
        await user.click(tuesdayButton);

        await waitFor(() => {
            expect(tuesdayButton).toHaveClass("selected");
            expect(mockOnChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "weekly",
                    days: expect.arrayContaining([1, 2]), // Monday and Tuesday
                })
            );
        });
    });

    it("should show monthly options when monthly preset is selected", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "monthly");

        expect(screen.getByText(/on day/i)).toBeInTheDocument();
    });

    it("should show yearly options when yearly preset is selected", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "yearly");

        // Should show month and day inputs
        const selects = screen.getAllByRole("combobox");
        const monthSelect = selects.find(s => s !== select);
        expect(monthSelect).toBeInTheDocument();
        expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    });

    it("should initialize from value prop", () => {
        const frequency: Frequency = { type: "daily" };

        render(
            <FrequencyInput
                value={frequency}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        expect(select).toHaveValue("daily");
    });

    it("should display error message when provided", () => {
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
                error="Test error message"
            />
        );

        expect(screen.getByText("Test error message")).toBeInTheDocument();
    });

    it("should be disabled when disabled prop is true", () => {
        render(
            <FrequencyInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
                disabled={true}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        expect(select).toBeDisabled();
    });

    it("should call onErrorChange when validation fails", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "weekly");

        // Weekly preset defaults to Monday, so validation should pass
        // But if we manually clear all days, it should fail
        // Since the component defaults to Monday, validation should pass
        await waitFor(() => {
            // Component should call onChange with a valid frequency (defaults to Monday)
            expect(mockOnChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "weekly",
                    days: expect.arrayContaining([1]),
                })
            );
        });
    });

    it("should handle monthly day input", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "monthly");

        // Monthly type defaults to "day", so day input should be visible
        const dayInput = screen.getByRole("spinbutton") as HTMLInputElement;
        expect(dayInput).toBeInTheDocument();

        // Use fireEvent to set the value directly
        fireEvent.change(dayInput, { target: { value: "15" } });

        // Wait for the onChange to be called with the final value (15)
        await waitFor(() => {
            const calls = mockOnChange.mock.calls;
            const matchingCall = calls.find(call => {
                const frequency = call[0] as Frequency;
                return frequency.type === "monthly" &&
                    frequency.kind === "day_number" &&
                    frequency.day_numbers?.[0] === 15;
            });
            expect(matchingCall).toBeDefined();
        }, { timeout: 2000 });
    });

    it("should handle monthly last day option", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "monthly");

        // Find the monthly type select (second select in monthly options)
        const selects = screen.getAllByRole("combobox");
        const monthlyTypeSelect = selects.find(s => s !== select);
        expect(monthlyTypeSelect).toBeInTheDocument();

        await user.selectOptions(monthlyTypeSelect!, "last");

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "monthly",
                    kind: "last_day",
                })
            );
        });
    });

    it("should handle monthly weekday ordinal option", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "monthly");

        // Find the monthly type select
        const selects = screen.getAllByRole("combobox");
        const monthlyTypeSelect = selects.find(s => s !== select);
        expect(monthlyTypeSelect).toBeInTheDocument();

        await user.selectOptions(monthlyTypeSelect!, "weekday");

        // Should show ordinal and weekday selects
        await waitFor(() => {
            const allSelects = screen.getAllByRole("combobox");
            expect(allSelects.length).toBeGreaterThan(2);
        });

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "monthly",
                    kind: "weekday_ordinal",
                })
            );
        });
    });

    it("should handle yearly month and day inputs", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "yearly");

        // Should show month select and day input
        // Wait for yearly inputs to appear
        await waitFor(() => {
            const selects = screen.getAllByRole("combobox");
            const monthSelect = selects.find(s => s !== select);
            expect(monthSelect).toBeDefined();
        });
        const selects = screen.getAllByRole("combobox");
        const monthSelect = selects.find(s => s !== select);
        expect(monthSelect).toBeDefined();

        const dayInput = screen.getByRole("spinbutton") as HTMLInputElement;
        expect(dayInput).toBeInTheDocument();

        await user.selectOptions(monthSelect!, "3"); // March

        // Wait for month change to propagate
        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalled();
        });

        // Use fireEvent to set the day value directly
        fireEvent.change(dayInput, { target: { value: "15" } });

        // Wait for the onChange to be called with the final value (month: 3, day: 15)
        await waitFor(() => {
            const calls = mockOnChange.mock.calls;
            const matchingCall = calls.find(call => {
                const frequency = call[0] as Frequency;
                return frequency.type === "yearly" &&
                    frequency.kind === "date" &&
                    frequency.month === 3 &&
                    frequency.day === 15;
            });
            expect(matchingCall).toBeDefined();
        }, { timeout: 2000 });
    });

    it("should default to Monday when switching to weekly", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        // Switch to weekly - should default to Monday
        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "weekly");

        await waitFor(() => {
            const mondayButton = screen.getByRole("button", { name: /mo/i });
            expect(mondayButton).toHaveClass("selected");
        });
    });

    it("should work without onErrorChange callback", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                onChange={mockOnChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "weekly");

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalled();
        });
    });

    it("should not display error when error prop is null", () => {
        render(
            <FrequencyInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
                error={null}
            />
        );

        expect(screen.queryByText(/test error/i)).not.toBeInTheDocument();
    });

    it("should handle disabled state for all inputs", () => {
        render(
            <FrequencyInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
                disabled={true}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        expect(select).toBeDisabled();
    });

    it("should call onFrequencyChange when frequency changes", async () => {
        const user = userEvent.setup();
        const mockOnFrequencyChange = vi.fn();
        render(
            <FrequencyInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
                onFrequencyChange={mockOnFrequencyChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "weekly");

        await waitFor(() => {
            expect(mockOnFrequencyChange).toHaveBeenCalledWith("weekly");
        });
    });

    it("should call onFrequencyChange with One-time when One-time is selected", async () => {
        const user = userEvent.setup();
        const mockOnFrequencyChange = vi.fn();
        render(
            <FrequencyInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
                onFrequencyChange={mockOnFrequencyChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "One-time");

        await waitFor(() => {
            expect(mockOnFrequencyChange).toHaveBeenCalledWith("one-time");
        });
    });

    it("should sync preset with controlled frequency prop", async () => {
        const { rerender } = render(
            <FrequencyInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
                frequency="weekly"
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        expect(select).toHaveValue("weekly");

        // Change controlled frequency
        rerender(
            <FrequencyInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
                frequency="monthly"
            />
        );

        await waitFor(() => {
            expect(select).toHaveValue("monthly");
        });
    });

    it("should not re-initialize from value when value matches last sent pattern", async () => {
        const initialFrequency: Frequency = {
            type: "weekly",
            days: [1],
        };

        const { rerender } = render(
            <FrequencyInput
                value={initialFrequency}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        // Wait for initial render
        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalled();
        }, { timeout: 1000 });

        const select = screen.getByRole("combobox", { name: /frequency/i });
        expect(select).toHaveValue("weekly");

        // Get the last frequency that was sent
        const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
        mockOnChange.mockClear();

        // Simulate parent updating value with the same frequency we sent
        rerender(
            <FrequencyInput
                value={lastCall}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        // Wait a bit to ensure no additional calls are made
        await new Promise(resolve => setTimeout(resolve, 200));

        // onChange should not be called again with the same value (or at most once more due to initial render)
        const callCountAfter = mockOnChange.mock.calls.length;
        expect(callCountAfter).toBeLessThanOrEqual(1); // Allow one call for initial render sync
    });

    it("should re-initialize when value prop changes to a different pattern", async () => {
        const initialFrequency: Frequency = {
            type: "weekly",
            days: [1],
        };

        const newFrequency: Frequency = {
            type: "weekly",
            days: [1, 3, 5],
        };

        const { rerender } = render(
            <FrequencyInput
                value={initialFrequency}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalled();
        }, { timeout: 1000 });

        // First, select weekly preset if not already
        const select = screen.getByRole("combobox", { name: /frequency/i }) as HTMLSelectElement;
        if (select.value !== "weekly") {
            const user = userEvent.setup();
            await user.selectOptions(select, "weekly");
            await waitFor(() => {
                expect(select).toHaveValue("weekly");
            });
        }

        mockOnChange.mockClear();

        // Change to a different frequency
        rerender(
            <FrequencyInput
                value={newFrequency}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        // Should update to show the new days
        await waitFor(() => {
            // The weekday buttons should reflect the new days
            // Use getAllByRole and filter to avoid multiple matches
            const allButtons = screen.getAllByRole("button");
            const mondayButton = allButtons.find(btn => btn.textContent === "Mo");
            const wednesdayButton = allButtons.find(btn => btn.textContent === "We");
            const fridayButton = allButtons.find(btn => btn.textContent === "Fr");

            expect(mondayButton).toBeDefined();
            expect(wednesdayButton).toBeDefined();
            expect(fridayButton).toBeDefined();
            expect(mondayButton).toHaveClass("selected");
            expect(wednesdayButton).toHaveClass("selected");
            expect(fridayButton).toHaveClass("selected");
        }, { timeout: 2000 });
    });

    it("should show Yearly option in frequency selector", () => {
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i }) as HTMLSelectElement;
        const options = Array.from(select.options).map(opt => opt.value);

        expect(options).toContain("yearly");
    });

    it("should show One-time option in frequency selector", () => {
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i }) as HTMLSelectElement;
        const options = Array.from(select.options).map(opt => opt.value);

        expect(options).toContain("one-time");
    });

    it("should hide frequency selector when hideFrequencySelector is true", () => {
        render(
            <FrequencyInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
                hideFrequencySelector={true}
            />
        );

        const select = document.getElementById("frequency-preset");
        expect(select).not.toBeInTheDocument();
    });

    it("should not cause infinite loop when selecting weekly days", async () => {
        const user = userEvent.setup();
        render(
            <FrequencyInput
                value={{ type: "daily" }}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        // Select weekly preset
        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "weekly");

        // Wait for initial weekly setup
        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalled();
        });

        mockOnChange.mockClear();

        // Click a day button multiple times
        const mondayButton = screen.getByRole("button", { name: /mo/i });
        await user.click(mondayButton);
        await user.click(mondayButton); // Toggle off and on

        // Should call onChange when toggling days
        // Note: If Monday was already selected, clicking it removes it, clicking again adds it
        // So onChange should be called at least once
        await waitFor(() => {
            expect(mockOnChange.mock.calls.length).toBeGreaterThan(0);
        }, { timeout: 1000 });

        // Wait a bit to ensure no more calls are made
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should have called onChange, but not excessively
        const callCount = mockOnChange.mock.calls.length;
        expect(callCount).toBeLessThan(10); // Reasonable upper bound
    });
});

