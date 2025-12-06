// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditTrackingModal } from '../EditTrackingModal';
import { TrackingData, DaysPatternType } from '../../models/Tracking';

describe('EditTrackingModal', () => {
  const defaultDaysPattern = {
    pattern_type: DaysPatternType.INTERVAL,
    interval_value: 1,
    interval_unit: "days" as const,
  };

  const mockTracking: TrackingData = {
    id: 1,
    question: 'Did I exercise today?',
    notes: 'Some notes',
    user_id: 1,
    schedules: [{ id: 1, tracking_id: 1, hour: 9, minutes: 0 }],
    days: defaultDaysPattern,
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

    expect(screen.getByText('Edit tracking')).toBeInTheDocument();
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

  // Note: Modal closing on overlay click and Escape key is disabled

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

  it('should show error for question exceeding 100 characters', async () => {
    const user = userEvent.setup();
    render(
      <EditTrackingModal
        tracking={mockTracking}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const questionInput = screen.getByRole('textbox', { name: /^question \*/i });
    fireEvent.change(questionInput, { target: { value: 'x'.repeat(101) } });

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText(/question must not exceed 100 characters/i)
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

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        1,
        defaultDaysPattern,
        'New question?',
        undefined,
        undefined,
        undefined,
      );
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
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

    const saveButton = screen.getByRole('button', { name: /^save$/i });
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

    // Make a change to ensure onSave is called
    const questionInput = screen.getByRole('textbox', { name: /^question \*/i });
    await user.clear(questionInput);
    await user.type(questionInput, 'Updated question?');

    // Get initial call count before clicking save
    const initialCallCount = mockOnClose.mock.calls.length;

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    await user.click(saveButton);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify modal is still open (title should still be visible)
    expect(screen.getByText('Edit tracking')).toBeInTheDocument();
    expect(screen.getByText(/save failed/i)).toBeInTheDocument();

    // Wait a bit more to ensure onClose is not called after error is shown
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify onClose was not called after clicking save (only check calls after initial)
    const callsAfterSave = mockOnClose.mock.calls.length - initialCallCount;
    expect(callsAfterSave).toBe(0);
  });

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

  it('should clear icon when icon is deleted', async () => {
    const user = userEvent.setup();
    const trackingWithIcon: TrackingData = {
      ...mockTracking,
      icon: '💪',
    };

    render(
      <EditTrackingModal
        tracking={trackingWithIcon}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const iconInput = screen.getByRole('textbox', { name: /^icon/i });
    await user.clear(iconInput);

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        1,
        defaultDaysPattern,
        undefined,
        undefined,
        '', // Empty string to clear the icon
        undefined,
      );
    });
  });

  it('should update icon when icon is changed', async () => {
    const user = userEvent.setup();
    const trackingWithIcon: TrackingData = {
      ...mockTracking,
      icon: '💪',
    };

    render(
      <EditTrackingModal
        tracking={trackingWithIcon}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const iconInput = screen.getByRole('textbox', { name: /^icon/i });
    await user.clear(iconInput);
    await user.type(iconInput, '🏋️');

    const saveButton = screen.getByRole('button', { name: /^save$/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        1,
        defaultDaysPattern,
        undefined,
        undefined,
        '🏋️',
        undefined,
      );
    });
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
    const saveButton = screen.getByRole('button', { name: /^save$/i }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    // Try to submit form directly
    const form = screen.getByRole('textbox', { name: /^question \*/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/at least one time is required/i)
      ).toBeInTheDocument();
    });
    expect(mockOnSave).not.toHaveBeenCalled();
  });
});

