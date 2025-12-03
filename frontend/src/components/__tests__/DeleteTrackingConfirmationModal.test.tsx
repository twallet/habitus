// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteTrackingConfirmationModal } from '../DeleteTrackingConfirmationModal';
import { TrackingData, TrackingType } from '../../models/Tracking';

describe('DeleteTrackingConfirmationModal', () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn().mockResolvedValue(undefined);
    const mockTracking: TrackingData = {
        id: 1,
        user_id: 1,
        question: 'Did I exercise today?',
        type: TrackingType.TRUE_FALSE,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render modal with tracking question', () => {
        render(
            <DeleteTrackingConfirmationModal
                tracking={mockTracking}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />
        );

        expect(screen.getByRole('heading', { name: 'Delete Tracking' })).toBeInTheDocument();
        expect(screen.getByText(/are you sure you want to delete the tracking/i)).toBeInTheDocument();
        expect(screen.getByText(/"Did I exercise today\?"/)).toBeInTheDocument();
    });

    it('should close modal when close button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <DeleteTrackingConfirmationModal
                tracking={mockTracking}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />
        );

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    // Note: Modal closing on overlay click and Escape key is disabled

    it('should disable delete button when confirmation text is not "DELETE"', () => {
        render(
            <DeleteTrackingConfirmationModal
                tracking={mockTracking}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />
        );

        const deleteButton = screen.getByRole('button', { name: /delete tracking/i });
        expect(deleteButton).toBeDisabled();
    });

    it('should enable delete button when confirmation text is "DELETE"', async () => {
        const user = userEvent.setup();
        render(
            <DeleteTrackingConfirmationModal
                tracking={mockTracking}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />
        );

        const confirmationInput = screen.getByPlaceholderText('DELETE');
        await user.type(confirmationInput, 'DELETE');

        const deleteButton = screen.getByRole('button', { name: /delete tracking/i });
        expect(deleteButton).not.toBeDisabled();
    });

    it('should not enable delete button for case-insensitive match', async () => {
        const user = userEvent.setup();
        render(
            <DeleteTrackingConfirmationModal
                tracking={mockTracking}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />
        );

        const confirmationInput = screen.getByPlaceholderText('DELETE');
        await user.type(confirmationInput, 'delete');

        const deleteButton = screen.getByRole('button', { name: /delete tracking/i });
        expect(deleteButton).toBeDisabled();
    });

    it('should call onConfirm when form is submitted with correct confirmation', async () => {
        const user = userEvent.setup();
        render(
            <DeleteTrackingConfirmationModal
                tracking={mockTracking}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />
        );

        const confirmationInput = screen.getByPlaceholderText('DELETE');
        await user.type(confirmationInput, 'DELETE');

        const deleteButton = screen.getByRole('button', { name: /delete tracking/i });
        await user.click(deleteButton);

        await waitFor(() => {
            expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onConfirm when form is submitted without correct confirmation', async () => {
        const user = userEvent.setup();
        render(
            <DeleteTrackingConfirmationModal
                tracking={mockTracking}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />
        );

        const confirmationInput = screen.getByPlaceholderText('DELETE');
        await user.type(confirmationInput, 'WRONG');

        const deleteButton = screen.getByRole('button', { name: /delete tracking/i });
        await user.click(deleteButton);

        expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should show loading state when deleting', async () => {
        const user = userEvent.setup();
        const slowConfirm = vi.fn().mockImplementation(
            () => new Promise(resolve => setTimeout(resolve, 100))
        );

        render(
            <DeleteTrackingConfirmationModal
                tracking={mockTracking}
                onClose={mockOnClose}
                onConfirm={slowConfirm}
            />
        );

        const confirmationInput = screen.getByPlaceholderText('DELETE');
        await user.type(confirmationInput, 'DELETE');

        const deleteButton = screen.getByRole('button', { name: /delete tracking/i });
        await user.click(deleteButton);

        expect(screen.getByText(/deleting.../i)).toBeInTheDocument();
        expect(deleteButton).toBeDisabled();
    });

    it('should show error message on delete failure', async () => {
        const user = userEvent.setup();
        const errorConfirm = vi.fn().mockRejectedValue(new Error('Delete failed'));

        render(
            <DeleteTrackingConfirmationModal
                tracking={mockTracking}
                onClose={mockOnClose}
                onConfirm={errorConfirm}
            />
        );

        const confirmationInput = screen.getByPlaceholderText('DELETE');
        await user.type(confirmationInput, 'DELETE');

        const deleteButton = screen.getByRole('button', { name: /delete tracking/i });
        await user.click(deleteButton);

        await waitFor(() => {
            expect(screen.getByText(/delete failed/i)).toBeInTheDocument();
        });
        // Modal should remain open on error
        expect(screen.getByRole('heading', { name: /delete tracking/i })).toBeInTheDocument();
    });

    it('should close error message when close button is clicked', async () => {
        const user = userEvent.setup();
        const errorConfirm = vi.fn().mockRejectedValue(new Error('Delete failed'));

        render(
            <DeleteTrackingConfirmationModal
                tracking={mockTracking}
                onClose={mockOnClose}
                onConfirm={errorConfirm}
            />
        );

        const confirmationInput = screen.getByPlaceholderText('DELETE');
        await user.type(confirmationInput, 'DELETE');

        const deleteButton = screen.getByRole('button', { name: /delete tracking/i });
        await user.click(deleteButton);

        await waitFor(() => {
            expect(screen.getByText(/delete failed/i)).toBeInTheDocument();
        });

        const errorCloseButton = screen.getAllByRole('button', { name: /close/i })[1];
        await user.click(errorCloseButton);

        await waitFor(() => {
            expect(screen.queryByText(/delete failed/i)).not.toBeInTheDocument();
        });
    });

    it('should display warning messages', () => {
        render(
            <DeleteTrackingConfirmationModal
                tracking={mockTracking}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />
        );

        expect(screen.getByText(/this tracking will be permanently deleted/i)).toBeInTheDocument();
        expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    });

    it('should disable confirmation input when deleting', async () => {
        const user = userEvent.setup();
        const slowConfirm = vi.fn().mockImplementation(
            () => new Promise(resolve => setTimeout(resolve, 100))
        );

        render(
            <DeleteTrackingConfirmationModal
                tracking={mockTracking}
                onClose={mockOnClose}
                onConfirm={slowConfirm}
            />
        );

        const confirmationInput = screen.getByPlaceholderText('DELETE');
        await user.type(confirmationInput, 'DELETE');

        const deleteButton = screen.getByRole('button', { name: /delete tracking/i });
        await user.click(deleteButton);

        expect(confirmationInput).toBeDisabled();
    });

    // it('should not close modal on Escape key when deleting', async () => {
    //     const user = userEvent.setup();
    //     const slowConfirm = vi.fn().mockImplementation(
    //         () => new Promise(resolve => setTimeout(resolve, 100))
    //     );

    //     render(
    //         <DeleteTrackingConfirmationModal
    //             tracking={mockTracking}
    //             onClose={mockOnClose}
    //             onConfirm={slowConfirm}
    //         />
    //     );

    //     const confirmationInput = screen.getByPlaceholderText('DELETE');
    //     await user.type(confirmationInput, 'DELETE');

    //     const deleteButton = screen.getByRole('button', { name: /delete tracking/i });

    //     // Clear any previous calls
    //     mockOnClose.mockClear();

    //     await user.click(deleteButton);

    //     // Wait for deleting state to be active ("Deleting..." text should appear)
    //     await waitFor(() => {
    //         expect(screen.getByText(/deleting.../i)).toBeInTheDocument();
    //     });

    //     // Wait for the delete button to be disabled, confirming state update is complete
    //     await waitFor(() => {
    //         const deleteButton = screen.getByRole('button', { name: /deleting.../i });
    //         expect(deleteButton).toBeDisabled();
    //     });

    //     // Try to close with Escape while deleting - wrap in act to ensure React processes it correctly
    //     act(() => {
    //         fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    //     });

    //     // Modal should still be open
    //     expect(screen.getByRole('heading', { name: /delete tracking/i })).toBeInTheDocument();
    //     expect(mockOnClose).not.toHaveBeenCalled();
    // });

    // it('should not close modal on overlay click when deleting', async () => {
    //     const user = userEvent.setup();
    //     const slowConfirm = vi.fn().mockImplementation(
    //         () => new Promise(resolve => setTimeout(resolve, 100))
    //     );

    //     const { container } = render(
    //         <DeleteTrackingConfirmationModal
    //             tracking={mockTracking}
    //             onClose={mockOnClose}
    //             onConfirm={slowConfirm}
    //         />
    //     );

    //     const confirmationInput = screen.getByPlaceholderText('DELETE');
    //     await user.type(confirmationInput, 'DELETE');

    //     const deleteButton = screen.getByRole('button', { name: /delete tracking/i });

    //     // Clear any previous calls
    //     mockOnClose.mockClear();

    //     await user.click(deleteButton);

    //     // Wait for deleting state to be active (button should be disabled and "Deleting..." text should appear)
    //     await waitFor(() => {
    //         expect(screen.getByText(/deleting.../i)).toBeInTheDocument();
    //     });

    //     // Small delay to ensure refs are updated and event handlers are set up
    //     await new Promise(resolve => setTimeout(resolve, 0));

    //     // Try to close by clicking overlay while deleting
    //     // Use fireEvent directly to simulate the click
    //     const { fireEvent } = await import('@testing-library/react');
    //     const overlay = container.querySelector('.modal-overlay');
    //     if (overlay) {
    //         fireEvent.click(overlay);
    //         // Modal should still be open
    //         expect(screen.getByRole('heading', { name: /delete tracking/i })).toBeInTheDocument();
    //         expect(mockOnClose).not.toHaveBeenCalled();
    //     }
    // });
});

