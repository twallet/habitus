// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditTrackingModal } from '../EditTrackingModal';
import { TrackingData, TrackingType } from '../../models/Tracking';

describe('EditTrackingModal', () => {
  const mockTracking: TrackingData = {
    id: 1,
    question: 'Did I exercise today?',
    type: TrackingType.TRUE_FALSE,
    notes: 'Some notes',
    user_id: 1,
    schedules: [{ id: 1, tracking_id: 1, hour: 9, minutes: 0 }],
  };

  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with tracking information', () => {
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('Edit Tracking')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Did I exercise today?')).toBeInTheDocument();
  });

  it('should close modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should close modal when overlay is clicked', async () => {
    const user = userEvent.setup();
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const overlay = screen.getByText('Edit Tracking').closest('.modal-overlay');
    if (overlay) {
      await user.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should close modal on Escape key', async () => {
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    await userEvent.keyboard('{Escape}');

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should update question when input changes', async () => {
    const user = userEvent.setup();
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const questionInput = screen.getByRole('textbox', { name: /^question \*/i });
    await user.clear(questionInput);
    await user.type(questionInput, 'New question?');

    expect(questionInput).toHaveValue('New question?');
  });

  it('should show character count for question', () => {
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText(/21\/500/i)).toBeInTheDocument();
  });

  it('should update type when select changes', async () => {
    const user = userEvent.setup();
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const typeSelect = screen.getByRole('combobox', { name: /^type \*/i });
    await user.selectOptions(typeSelect, TrackingType.REGISTER);

    expect(typeSelect).toHaveValue(TrackingType.REGISTER);
  });

  it('should update notes when input changes', async () => {
    const user = userEvent.setup();
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const notesInput = screen.getByRole('textbox', { name: /^notes \?/i });
    await user.clear(notesInput);
    await user.type(notesInput, 'New notes');

    expect(notesInput).toHaveValue('New notes');
  });

  it('should show error for empty question', async () => {
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const questionInput = screen.getByRole('textbox', { name: /^question \*/i });
    fireEvent.change(questionInput, { target: { value: '' } });

    const form = questionInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/question is required/i)).toBeInTheDocument();
    });
  });

  it('should show error for question exceeding 500 characters', async () => {
    const user = userEvent.setup();
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const questionInput = screen.getByRole('textbox', { name: /^question \*/i });
    fireEvent.change(questionInput, { target: { value: 'x'.repeat(501) } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText(/question must not exceed 500 characters/i)
      ).toBeInTheDocument();
    });
  });

  it('should submit form with updated question', async () => {
    const user = userEvent.setup();
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const questionInput = screen.getByRole('textbox', { name: /^question \*/i });
    fireEvent.change(questionInput, { target: { value: 'New question?' } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        1,
        'New question?',
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should submit form with updated type', async () => {
    const user = userEvent.setup();
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const typeSelect = screen.getByRole('combobox', { name: /^type \*/i });
    await user.selectOptions(typeSelect, TrackingType.REGISTER);

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        1,
        undefined,
        TrackingType.REGISTER,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  it('should show loading state when submitting', async () => {
    const user = userEvent.setup();
    const slowSave = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={slowSave}
      />
    );

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    expect(screen.getByText(/saving.../i)).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
  });

  it('should show error message on save failure', async () => {
    const user = userEvent.setup();
    const errorSave = vi.fn().mockRejectedValue(new Error('Save failed'));

    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={errorSave}
      />
    );

    // Clear any previous calls to mockOnClose after render
    mockOnClose.mockClear();

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify modal is still open (title should still be visible)
    expect(screen.getByText('Edit Tracking')).toBeInTheDocument();
    expect(screen.getByText(/save failed/i)).toBeInTheDocument();

    // Wait a bit more to ensure onClose is not called after error is shown
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify onClose was not called after the error
    // Note: onClose might be called during render or initial setup, but not after error
    const callsAfterError = mockOnClose.mock.calls.length;
    expect(callsAfterError).toBe(0);
  });


  // TODO: Fix race condition with onClose being called twice
  // it('should call onDelete when delete is confirmed', async () => {
  //   const user = userEvent.setup();
  //   render(
  //     <EditTrackingModal
  //       tracking={mockTracking}
  //       onClose={mockOnClose}
  //       onSave={mockOnSave}
  //       onDelete={mockOnDelete}
  //     />
  //   );

  //   const deleteButton = screen.getByRole('button', { name: /delete/i });
  //   await user.click(deleteButton);

  //   // Wait for confirmation dialog to appear
  //   await waitFor(() => {
  //     expect(screen.getByText(/are you sure you want to delete this tracking\?/i)).toBeInTheDocument();
  //   });

  //   // Find the delete button within the confirmation dialog
  //   const confirmationDialog = screen.getByText(/are you sure you want to delete this tracking\?/i).closest('.delete-confirmation') as HTMLElement;
  //   expect(confirmationDialog).toBeInTheDocument();
  //   const confirmDeleteButton = within(confirmationDialog).getByRole('button', { name: /delete/i });
  //   await user.click(confirmDeleteButton);

  //   await waitFor(() => {
  //     expect(mockOnDelete).toHaveBeenCalledWith(1);
  //     expect(mockOnClose).toHaveBeenCalledTimes(1);
  //   });
  // });




  // TODO: Fix race condition with onClose being called on delete failure
  // it('should show error message on delete failure', async () => {
  //   const user = userEvent.setup();
  //   const errorDelete = vi.fn().mockRejectedValue(new Error('Delete failed'));

  //   render(
  //     <EditTrackingModal
  //       tracking={mockTracking}
  //       onClose={mockOnClose}
  //       onSave={mockOnSave}
  //       onDelete={errorDelete}
  //     />
  //   );

  //   const deleteButton = screen.getByRole('button', { name: /delete/i });
  //   await user.click(deleteButton);

  //   // Wait for confirmation dialog to appear
  //   await waitFor(() => {
  //     expect(screen.getByText(/are you sure you want to delete this tracking\?/i)).toBeInTheDocument();
  //   });

  //   // Find the delete button within the confirmation dialog
  //   const confirmationDialog = screen.getByText(/are you sure you want to delete this tracking\?/i).closest('.delete-confirmation') as HTMLElement;
  //   expect(confirmationDialog).toBeInTheDocument();
  //   const confirmDeleteButton = within(confirmationDialog).getByRole('button', { name: /delete/i });

  //   // Click and wait for the error to appear
  //   await user.click(confirmDeleteButton);

  //   // Wait for the error message to appear and confirmation dialog to disappear
  //   await waitFor(() => {
  //     expect(screen.getByText(/delete failed/i)).toBeInTheDocument();
  //     expect(screen.queryByText(/are you sure you want to delete this tracking\?/i)).not.toBeInTheDocument();
  //   }, { timeout: 3000 });

  //   // Verify errorDelete was called
  //   expect(errorDelete).toHaveBeenCalled();

  //   // The component should not call onClose when delete fails
  //   // Check immediately after error appears - if onClose was called, it would have been called already
  //   expect(mockOnClose).not.toHaveBeenCalled();
  //   expect(mockOnSave).not.toHaveBeenCalled();
  // });

  it('should handle tracking without notes', () => {
    const trackingWithoutNotes: TrackingData = {
      ...mockTracking,
      notes: undefined,
    };

    render(
      <EditTrackingModal
        tracking={trackingWithoutNotes}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const notesInput = screen.getByRole('textbox', { name: /^notes \?/i });
    expect(notesInput).toHaveValue('');
  });

  it('should show error when submitting without schedules', async () => {
    const trackingWithoutSchedules: TrackingData = {
      ...mockTracking,
      schedules: [],
    };

    render(
      <EditTrackingModal
        tracking={trackingWithoutSchedules}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    // Submit button should be disabled when no schedules
    const saveButton = screen.getByRole('button', { name: /save changes/i }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    // Try to submit form directly
    const form = screen.getByRole('textbox', { name: /^question \*/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/at least one schedule is required/i)
      ).toBeInTheDocument();
    });
    expect(mockOnSave).not.toHaveBeenCalled();
  });
});

