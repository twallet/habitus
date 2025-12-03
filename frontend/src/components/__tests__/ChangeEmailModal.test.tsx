// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangeEmailModal } from '../ChangeEmailModal';
import { UserData } from '../../models/User';

describe('ChangeEmailModal', () => {
  const mockUser: UserData = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    created_at: '2024-01-15T10:30:00Z',
  };

  const mockOnClose = vi.fn();
  const mockOnRequestEmailChange = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with current email', () => {
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    expect(screen.getByRole('heading', { name: 'Change email' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
    const currentEmailInput = screen.getByDisplayValue('john@example.com');
    expect(currentEmailInput).toBeDisabled();
  });

  it('should close modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // Note: Modal closing on overlay click and Escape key is disabled

  it('should update new email when input changes', async () => {
    const user = userEvent.setup();
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    const newEmailInput = screen.getByPlaceholderText('Enter your new email');
    await user.type(newEmailInput, 'newemail@example.com');

    expect(newEmailInput).toHaveValue('newemail@example.com');
  });

  it('should disable button and prevent submission for empty email', async () => {
    const user = userEvent.setup();
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    const submitButton = screen.getByRole('button', { name: /change email/i });
    expect(submitButton).toBeDisabled();

    // Button is disabled, so clicking should not trigger submission
    await user.click(submitButton);
    expect(mockOnRequestEmailChange).not.toHaveBeenCalled();
  });

  it('should disable button and prevent submission for invalid email format', async () => {
    const user = userEvent.setup();
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    const newEmailInput = screen.getByPlaceholderText('Enter your new email');
    await user.type(newEmailInput, 'invalid-email');

    const submitButton = screen.getByRole('button', { name: /change email/i });
    expect(submitButton).toBeDisabled();

    // Button is disabled, so clicking should not trigger submission
    await user.click(submitButton);
    expect(mockOnRequestEmailChange).not.toHaveBeenCalled();
  });

  it('should disable button and prevent submission when email is same as current', async () => {
    const user = userEvent.setup();
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    const newEmailInput = screen.getByPlaceholderText('Enter your new email');
    await user.type(newEmailInput, 'john@example.com');

    const submitButton = screen.getByRole('button', { name: /change email/i });
    expect(submitButton).toBeDisabled();

    // Button is disabled, so clicking should not trigger submission
    await user.click(submitButton);
    expect(mockOnRequestEmailChange).not.toHaveBeenCalled();
  });

  it('should submit form with valid new email', async () => {
    const user = userEvent.setup();
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    const newEmailInput = screen.getByPlaceholderText('Enter your new email');
    await user.type(newEmailInput, 'newemail@example.com');

    const submitButton = screen.getByRole('button', { name: /change email/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnRequestEmailChange).toHaveBeenCalledWith('newemail@example.com');
    });
  });

  it('should show success message after email is sent', async () => {
    const user = userEvent.setup();
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    const newEmailInput = screen.getByPlaceholderText('Enter your new email');
    await user.type(newEmailInput, 'newemail@example.com');

    const submitButton = screen.getByRole('button', { name: /change email/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/a verification link has been sent to/i)
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/newemail@example.com/i)).toBeInTheDocument();
  });

  it('should show loading state when submitting', async () => {
    const user = userEvent.setup();
    const slowRequest = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={slowRequest}
      />
    );

    const newEmailInput = screen.getByPlaceholderText('Enter your new email');
    await user.type(newEmailInput, 'newemail@example.com');

    const submitButton = screen.getByRole('button', { name: /change email/i });
    await user.click(submitButton);

    expect(screen.getByText(/sending.../i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('should show error message on request failure', async () => {
    const user = userEvent.setup();
    const errorRequest = vi.fn().mockRejectedValue(new Error('Request failed'));

    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={errorRequest}
      />
    );

    const newEmailInput = screen.getByPlaceholderText('Enter your new email');
    await user.type(newEmailInput, 'newemail@example.com');

    const submitButton = screen.getByRole('button', { name: /change email/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/request failed/i)).toBeInTheDocument();
    });
  });

  it('should close error message when close button is clicked', async () => {
    const user = userEvent.setup();
    const errorRequest = vi.fn().mockRejectedValue(new Error('Request failed'));

    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={errorRequest}
      />
    );

    const newEmailInput = screen.getByPlaceholderText('Enter your new email');
    await user.type(newEmailInput, 'newemail@example.com');

    const submitButton = screen.getByRole('button', { name: /change email/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/request failed/i)).toBeInTheDocument();
    });

    const errorCloseButton = screen.getAllByRole('button', { name: /close/i })[1];
    await user.click(errorCloseButton);

    await waitFor(() => {
      expect(screen.queryByText(/request failed/i)).not.toBeInTheDocument();
    });
  });

  it('should trim email input before submission', async () => {
    const user = userEvent.setup();
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    const newEmailInput = screen.getByPlaceholderText('Enter your new email');
    await user.type(newEmailInput, '  newemail@example.com  ');

    const submitButton = screen.getByRole('button', { name: /change email/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnRequestEmailChange).toHaveBeenCalledWith('newemail@example.com');
    });
  });

  it('should disable Change email button when no email is entered', () => {
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    const submitButton = screen.getByRole('button', { name: /change email/i });
    expect(submitButton).toBeDisabled();
  });

  it('should disable Change email button when email is invalid', async () => {
    const user = userEvent.setup();
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    const newEmailInput = screen.getByPlaceholderText('Enter your new email');
    await user.type(newEmailInput, 'invalid-email');

    const submitButton = screen.getByRole('button', { name: /change email/i });
    expect(submitButton).toBeDisabled();
  });

  it('should disable Change email button when email is same as current', async () => {
    const user = userEvent.setup();
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    const newEmailInput = screen.getByPlaceholderText('Enter your new email');
    await user.type(newEmailInput, 'john@example.com');

    const submitButton = screen.getByRole('button', { name: /change email/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable Change email button when valid different email is entered', async () => {
    const user = userEvent.setup();
    render(
      <ChangeEmailModal
        user={mockUser}
        onClose={mockOnClose}
        onRequestEmailChange={mockOnRequestEmailChange}
      />
    );

    const newEmailInput = screen.getByPlaceholderText('Enter your new email');
    await user.type(newEmailInput, 'newemail@example.com');

    const submitButton = screen.getByRole('button', { name: /change email/i });
    expect(submitButton).not.toBeDisabled();
  });
});

