// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditProfileModal } from '../EditProfileModal';
import { UserData } from '../../models/User';

describe('EditProfileModal', () => {
  const mockUser: UserData = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    created_at: '2024-01-15T10:30:00Z',
  };

  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with user information', () => {
    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={mockOnSave} />
    );

    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
  });

  it('should close modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should close modal when overlay is clicked', async () => {
    const user = userEvent.setup();
    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const overlay = screen.getByText('Edit Profile').closest('.modal-overlay');
    if (overlay) {
      await user.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should close modal on Escape key', async () => {
    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={mockOnSave} />
    );

    await userEvent.keyboard('{Escape}');

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should update name when input changes', async () => {
    const user = userEvent.setup();
    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const nameInput = screen.getByLabelText(/name \*/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Jane Smith');

    expect(nameInput).toHaveValue('Jane Smith');
  });

  it('should show character count', () => {
    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={mockOnSave} />
    );

    expect(screen.getByText(/8\/30/i)).toBeInTheDocument();
  });

  it('should submit form with updated name', async () => {
    const user = userEvent.setup();
    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const nameInput = screen.getByLabelText(/name \*/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Jane Smith');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('Jane Smith', null, false);
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should handle profile picture file selection', async () => {
    const user = userEvent.setup();
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const fileInput = screen.getByLabelText(/profile picture/i) as HTMLInputElement;
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(fileInput.files?.[0]).toBe(file);
    });
  });

  it('should show error for non-image file', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const fileInput = screen.getByLabelText(/profile picture/i) as HTMLInputElement;

    // Create a FileList-like object and assign it to the input
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    // Trigger the change event manually
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(/please select an image file/i)).toBeInTheDocument();
    });
  });

  it('should show error for file larger than 5MB', async () => {
    const user = userEvent.setup();
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });

    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={mockOnSave} />
    );

    const fileInput = screen.getByLabelText(/profile picture/i) as HTMLInputElement;
    await user.upload(fileInput, largeFile);

    await waitFor(() => {
      expect(screen.getByText(/image size must be less than 5mb/i)).toBeInTheDocument();
    });
  });

  it('should remove profile picture', async () => {
    const user = userEvent.setup();
    const userWithPicture: UserData = {
      ...mockUser,
      profile_picture_url: 'https://example.com/picture.jpg',
    };

    render(
      <EditProfileModal
        user={userWithPicture}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const removeButton = screen.getByRole('button', { name: /remove/i });
    await user.click(removeButton);

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('John Doe', null, true);
    });
  });

  it('should show loading state when submitting', async () => {
    const user = userEvent.setup();
    const slowSave = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={slowSave} />
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
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={errorSave} />
    );

    // Clear any previous calls to mockOnClose
    mockOnClose.mockClear();

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    });

    // Verify modal is still open (title should still be visible)
    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    // Verify onClose was not called after the error
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should close error message when close button is clicked', async () => {
    const user = userEvent.setup();
    const errorSave = vi.fn().mockRejectedValue(new Error('Save failed'));

    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={errorSave} />
    );

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    });

    const errorCloseButton = screen.getAllByRole('button', { name: /close/i })[1];
    await user.click(errorCloseButton);

    await waitFor(() => {
      expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument();
    });
  });

  it('should prevent double submission', async () => {
    const user = userEvent.setup();
    const slowSave = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(
      <EditProfileModal user={mockUser} onClose={mockOnClose} onSave={slowSave} />
    );

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);
    await user.click(saveButton);

    await waitFor(() => {
      expect(slowSave).toHaveBeenCalledTimes(1);
    });
  });

  it('should display current profile picture if available', () => {
    const userWithPicture: UserData = {
      ...mockUser,
      profile_picture_url: 'https://example.com/picture.jpg',
    };

    render(
      <EditProfileModal
        user={userWithPicture}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    const image = screen.getByAltText('Profile preview');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/picture.jpg');
  });
});

