// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

    it("should call onChange with undefined for daily preset", async () => {
        render(
            <DaysPatternInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith(undefined);
        });
    });

    it("should show interval inputs when interval preset is selected", async () => {
        const user = userEvent.setup();
        render(
            <DaysPatternInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = document.getElementById("frequency-preset") as HTMLSelectElement;
        await user.selectOptions(select, "interval");

        await waitFor(() => {
            expect(screen.getByLabelText(/every/i)).toBeInTheDocument();
            expect(screen.getByRole("spinbutton")).toBeInTheDocument();
        });
    });

    it("should build interval pattern when values are set", async () => {
        const user = userEvent.setup();
        render(
            <DaysPatternInput
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = document.getElementById("frequency-preset") as HTMLSelectElement;
        await user.selectOptions(select, "interval");

        await waitFor(() => {
            expect(screen.getByRole("spinbutton")).toBeInTheDocument();
        });

        const valueInput = screen.getByRole("spinbutton");
        await user.clear(valueInput);
        await user.type(valueInput, "3");

        // Find the unit select (it's a select element, not a combobox in the DOM)
        const unitSelect = document.querySelector(".interval-inputs select") as HTMLSelectElement;
        if (unitSelect) {
            await user.selectOptions(unitSelect, "weeks");
        }

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    pattern_type: DaysPatternType.INTERVAL,
                    interval_value: 3,
                    interval_unit: "weeks",
                })
            );
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

        expect(screen.getByText(/select days/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /mon/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /tue/i })).toBeInTheDocument();
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

        const mondayButton = screen.getByRole("button", { name: /mon/i });
        await user.click(mondayButton);

        await waitFor(() => {
            expect(mondayButton).toHaveClass("selected");
            expect(mockOnChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    pattern_type: DaysPatternType.DAY_OF_WEEK,
                    days: expect.arrayContaining([1]),
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
            interval_value: 2,
            interval_unit: "weeks",
        };

        render(
            <DaysPatternInput
                value={pattern}
                onChange={mockOnChange}
                onErrorChange={mockOnErrorChange}
            />
        );

        const select = screen.getByRole("combobox", { name: /frequency/i });
        expect(select).toHaveValue("interval");
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

        // Weekly preset requires at least one day selected
        // The error should be set when trying to build pattern without days
        // The component validates on preset change and calls onErrorChange
        await waitFor(() => {
            expect(mockOnErrorChange).toHaveBeenCalledWith(
                expect.stringContaining("Please select at least one day")
            );
        }, { timeout: 2000 });
    });
});

