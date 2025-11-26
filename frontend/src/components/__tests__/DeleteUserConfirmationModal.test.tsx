import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteUserConfirmationModal } from '../DeleteUserConfirmationModal';

describe('DeleteUserConfirmationModal', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal with user name', () => {
    render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByRole('heading', { name: 'Delete Account' })).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    expect(screen.getByText(/John Doe's/i)).toBeInTheDocument();
  });

  it('should close modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should close modal when overlay is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const overlay = container.querySelector('.modal-overlay');
    if (overlay) {
      await user.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should close modal on Escape key', async () => {
    render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    await userEvent.keyboard('{Escape}');

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should disable delete button when confirmation text is not "DELETE"', () => {
    render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /delete account/i });
    expect(deleteButton).toBeDisabled();
  });

  it('should enable delete button when confirmation text is "DELETE"', async () => {
    const user = userEvent.setup();
    render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const confirmationInput = screen.getByPlaceholderText('DELETE');
    await user.type(confirmationInput, 'DELETE');

    const deleteButton = screen.getByRole('button', { name: /delete account/i });
    expect(deleteButton).not.toBeDisabled();
  });

  it('should not enable delete button for case-insensitive match', async () => {
    const user = userEvent.setup();
    render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const confirmationInput = screen.getByPlaceholderText('DELETE');
    await user.type(confirmationInput, 'delete');

    const deleteButton = screen.getByRole('button', { name: /delete account/i });
    expect(deleteButton).toBeDisabled();
  });

  it('should call onConfirm when form is submitted with correct confirmation', async () => {
    const user = userEvent.setup();
    render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const confirmationInput = screen.getByPlaceholderText('DELETE');
    await user.type(confirmationInput, 'DELETE');

    const deleteButton = screen.getByRole('button', { name: /delete account/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onConfirm when form is submitted without correct confirmation', async () => {
    const user = userEvent.setup();
    render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    const confirmationInput = screen.getByPlaceholderText('DELETE');
    await user.type(confirmationInput, 'WRONG');

    const deleteButton = screen.getByRole('button', { name: /delete account/i });
    await user.click(deleteButton);

    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('should show loading state when deleting', async () => {
    const user = userEvent.setup();
    const slowConfirm = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={slowConfirm}
      />
    );

    const confirmationInput = screen.getByPlaceholderText('DELETE');
    await user.type(confirmationInput, 'DELETE');

    const deleteButton = screen.getByRole('button', { name: /delete account/i });
    await user.click(deleteButton);

    expect(screen.getByText(/deleting.../i)).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();
  });

  it('should show error message on delete failure', async () => {
    const user = userEvent.setup();
    const errorConfirm = jest.fn().mockRejectedValue(new Error('Delete failed'));

    render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={errorConfirm}
      />
    );

    const confirmationInput = screen.getByPlaceholderText('DELETE');
    await user.type(confirmationInput, 'DELETE');

    const deleteButton = screen.getByRole('button', { name: /delete account/i });

    // Clear any previous calls before clicking
    mockOnClose.mockClear();

    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/delete failed/i)).toBeInTheDocument();
    });

    // Ensure onClose was not called after error
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should close error message when close button is clicked', async () => {
    const user = userEvent.setup();
    const errorConfirm = jest.fn().mockRejectedValue(new Error('Delete failed'));

    render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={errorConfirm}
      />
    );

    const confirmationInput = screen.getByPlaceholderText('DELETE');
    await user.type(confirmationInput, 'DELETE');

    const deleteButton = screen.getByRole('button', { name: /delete account/i });
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
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText(/all your data will be permanently deleted/i)).toBeInTheDocument();
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
  });

  it('should disable confirmation input when deleting', async () => {
    const user = userEvent.setup();
    const slowConfirm = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(
      <DeleteUserConfirmationModal
        userName="John Doe"
        onClose={mockOnClose}
        onConfirm={slowConfirm}
      />
    );

    const confirmationInput = screen.getByPlaceholderText('DELETE');
    await user.type(confirmationInput, 'DELETE');

    const deleteButton = screen.getByRole('button', { name: /delete account/i });
    await user.click(deleteButton);

    expect(confirmationInput).toBeDisabled();
  });
});

