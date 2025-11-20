import { render, screen, fireEvent } from "@testing-library/react";
import { TrackingsList } from "../TrackingsList";
import { TrackingData, TrackingType } from "../../models/Tracking";

describe("TrackingsList", () => {
    const mockOnEdit = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
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
                start_tracking_date: "2024-01-01T10:00:00Z",
            },
            {
                id: 2,
                user_id: 1,
                question: "Did I meditate?",
                type: TrackingType.REGISTER,
                start_tracking_date: "2024-01-01T11:00:00Z",
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
        expect(screen.getByText("True/False")).toBeInTheDocument();
        expect(screen.getByText("Register")).toBeInTheDocument();
    });

    it("should call onEdit when edit button is clicked", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                start_tracking_date: "2024-01-01T10:00:00Z",
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
                start_tracking_date: "2024-01-01T10:00:00Z",
                notes: "<p>Some notes</p>",
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        expect(screen.getByText("Notes:")).toBeInTheDocument();
    });

    it("should not display notes section when notes are absent", () => {
        const trackings: TrackingData[] = [
            {
                id: 1,
                user_id: 1,
                question: "Did I exercise?",
                type: TrackingType.TRUE_FALSE,
                start_tracking_date: "2024-01-01T10:00:00Z",
            },
        ];

        render(
            <TrackingsList
                trackings={trackings}
                onEdit={mockOnEdit}
            />
        );

        expect(screen.queryByText("Notes:")).not.toBeInTheDocument();
    });
});

