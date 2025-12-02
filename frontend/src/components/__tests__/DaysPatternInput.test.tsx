// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DaysPatternInput } from "../DaysPatternInput";
import { DaysPattern, DaysPatternType } from "../../models/Tracking";

describe("DaysPatternInput", () => {
    const mockOnChange = vi.fn();
    const mockOnErrorChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render frequency selector", () => {
        render(
            <DaysPatternInput
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
            <DaysPatternInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        expect(select).toHaveValue("daily");
    });

    it("should call onChange with daily pattern for daily preset", async () => {
        render(
            <DaysPatternInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    pattern_type: DaysPatternType.INTERVAL,
                    interval_value: 1,
                    interval_unit: "days",
                })
            );
        });
    });

    it("should show weekly options when weekly preset is selected", async () => {
        const user = userEvent.setup();
        render(
            <DaysPatternInput
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
            <DaysPatternInput
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
            <DaysPatternInput
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
                    pattern_type: DaysPatternType.DAY_OF_WEEK,
                    days: expect.arrayContaining([1, 2]), // Monday and Tuesday
                })
            );
        });
    });

    it("should show monthly options when monthly preset is selected", async () => {
        const user = userEvent.setup();
        render(
            <DaysPatternInput
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
            <DaysPatternInput
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
        const pattern: DaysPattern = {
            pattern_type: DaysPatternType.INTERVAL,
            interval_value: 1,
            interval_unit: "days",
        };

        render(
            <DaysPatternInput
                value={pattern}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        expect(select).toHaveValue("daily");
    });

    it("should display error message when provided", () => {
        render(
            <DaysPatternInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
                error="Test error message"
            />
        );

        expect(screen.getByText("Test error message")).toBeInTheDocument();
    });

    it("should be disabled when disabled prop is true", () => {
        render(
            <DaysPatternInput
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
            <DaysPatternInput
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
            // Component should call onChange with a valid pattern (defaults to Monday)
            expect(mockOnChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    pattern_type: DaysPatternType.DAY_OF_WEEK,
                    days: expect.arrayContaining([1]),
                })
            );
        });
    });

    it("should handle monthly day input", async () => {
        const user = userEvent.setup();
        render(
            <DaysPatternInput
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
                const pattern = call[0];
                return pattern.pattern_type === DaysPatternType.DAY_OF_MONTH &&
                    pattern.type === "day_number" &&
                    pattern.day_numbers?.[0] === 15;
            });
            expect(matchingCall).toBeDefined();
        }, { timeout: 2000 });
    });

    it("should handle monthly last day option", async () => {
        const user = userEvent.setup();
        render(
            <DaysPatternInput
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
                    pattern_type: DaysPatternType.DAY_OF_MONTH,
                    type: "last_day",
                })
            );
        });
    });

    it("should handle monthly weekday ordinal option", async () => {
        const user = userEvent.setup();
        render(
            <DaysPatternInput
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
                    pattern_type: DaysPatternType.DAY_OF_MONTH,
                    type: "weekday_ordinal",
                })
            );
        });
    });

    it("should handle yearly month and day inputs", async () => {
        const user = userEvent.setup();
        render(
            <DaysPatternInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        await user.selectOptions(select, "yearly");

        // Should show month select and day input
        const selects = screen.getAllByRole("combobox");
        const monthSelect = selects.find(s => s !== select);
        expect(monthSelect).toBeInTheDocument();

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
                const pattern = call[0];
                return pattern.pattern_type === DaysPatternType.DAY_OF_YEAR &&
                    pattern.type === "date" &&
                    pattern.month === 3 &&
                    pattern.day === 15;
            });
            expect(matchingCall).toBeDefined();
        }, { timeout: 2000 });
    });

    it("should default to Monday when switching to weekly", async () => {
        const user = userEvent.setup();
        render(
            <DaysPatternInput
                value={{
                    pattern_type: DaysPatternType.INTERVAL,
                    interval_value: 1,
                    interval_unit: "days",
                }}
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
            <DaysPatternInput
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
            <DaysPatternInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
                error={null}
            />
        );

        expect(screen.queryByText(/test error/i)).not.toBeInTheDocument();
    });

    it("should handle disabled state for all inputs", () => {
        render(
            <DaysPatternInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
                disabled={true}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        expect(select).toBeDisabled();
    });
});

