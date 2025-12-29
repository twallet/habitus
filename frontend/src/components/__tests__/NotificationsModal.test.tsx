// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsModal } from '../NotificationsModal';
import { UserData } from '../../models/User';

describe('NotificationsModal', () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn().mockResolvedValue(undefined);

    const mockUser: UserData = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        notification_channels: ['Email'],
        telegram_chat_id: '',
        created_at: '2024-01-15T10:30:00Z',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render modal with title', () => {
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        expect(screen.getByText('Configure notifications')).toBeInTheDocument();
    });

    it('should render all notification channels', () => {
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.getByText('Calendar')).toBeInTheDocument();
        expect(screen.getByText('Telegram')).toBeInTheDocument();
        expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });

    it('should have Email selected by default', () => {
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const emailCheckbox = screen.getByLabelText(/email/i).closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(emailCheckbox).toBeChecked();
    });

    it('should close modal when close button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close modal when overlay is clicked', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const overlay = document.querySelector('.modal-overlay');
        if (overlay) {
            await user.click(overlay);
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        }
    });

    it('should toggle channel selection', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const calendarLabel = screen.getByText('Calendar').closest('label');
        const calendarCheckbox = calendarLabel?.querySelector('input[type="checkbox"]') as HTMLInputElement;

        expect(calendarCheckbox).not.toBeChecked();
        await user.click(calendarLabel!);
        expect(calendarCheckbox).toBeChecked();

        await user.click(calendarLabel!);
        expect(calendarCheckbox).not.toBeChecked();
    });

    it('should show Telegram chat ID input when Telegram is selected', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const telegramLabel = screen.getByText('Telegram').closest('label');
        await user.click(telegramLabel!);

        await waitFor(() => {
            expect(screen.getByLabelText(/telegram chat id/i)).toBeInTheDocument();
        });
    });

    it('should show Calendar provider select when Calendar is selected', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const calendarLabel = screen.getByText('Calendar').closest('label');
        await user.click(calendarLabel!);

        await waitFor(() => {
            expect(screen.getByLabelText(/calendar provider/i)).toBeInTheDocument();
        });
    });

    it('should show WhatsApp number input when WhatsApp is selected', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const whatsappLabel = screen.getByText('WhatsApp').closest('label');
        await user.click(whatsappLabel!);

        await waitFor(() => {
            expect(screen.getByLabelText(/whatsapp number/i)).toBeInTheDocument();
        });
    });

    it('should load user preferences on mount', () => {
        const userWithPreferences: UserData = {
            ...mockUser,
            notification_channels: ['Email', 'Telegram'],
            telegram_chat_id: '123456789',
        };

        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} user={userWithPreferences} />
        );

        const emailCheckbox = screen.getByLabelText(/email/i).closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
        const telegramCheckbox = screen.getByLabelText(/telegram/i).closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;

        expect(emailCheckbox).toBeChecked();
        expect(telegramCheckbox).toBeChecked();
    });

    it('should validate Telegram chat ID when Telegram is selected', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const telegramLabel = screen.getByText('Telegram').closest('label');
        await user.click(telegramLabel!);

        await waitFor(() => {
            expect(screen.getByLabelText(/telegram chat id/i)).toBeInTheDocument();
        });

        const saveButton = screen.getByRole('button', { name: /^save$/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(screen.getByText(/telegram chat id is required/i)).toBeInTheDocument();
        });

        expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should submit form with selected channels', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const telegramLabel = screen.getByText('Telegram').closest('label');
        await user.click(telegramLabel!);

        await waitFor(() => {
            expect(screen.getByLabelText(/telegram chat id/i)).toBeInTheDocument();
        });

        const telegramInput = screen.getByLabelText(/telegram chat id/i);
        await user.type(telegramInput, '123456789');

        const saveButton = screen.getByRole('button', { name: /^save$/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith(['Email', 'Telegram'], '123456789');
        });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple channel selection', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const calendarLabel = screen.getByText('Calendar').closest('label');
        const whatsappLabel = screen.getByText('WhatsApp').closest('label');

        await user.click(calendarLabel!);
        await user.click(whatsappLabel!);

        const saveButton = screen.getByRole('button', { name: /^save$/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith(['Email', 'Calendar', 'WhatsApp'], undefined);
        });
    });

    it('should display error message on save failure', async () => {
        const user = userEvent.setup();
        const errorMessage = 'Failed to save notification settings';
        const mockOnSaveWithError = vi.fn().mockRejectedValue(new Error(errorMessage));

        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSaveWithError} />
        );

        const saveButton = screen.getByRole('button', { name: /^save$/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });
    });

    it('should disable form during submission', async () => {
        const user = userEvent.setup();
        let resolveSave: () => void;
        const mockOnSaveDelayed = vi.fn().mockImplementation(() => {
            return new Promise<void>((resolve) => {
                resolveSave = resolve;
            });
        });

        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSaveDelayed} />
        );

        const saveButton = screen.getByRole('button', { name: /^save$/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(saveButton).toBeDisabled();
            expect(screen.getByText(/saving/i)).toBeInTheDocument();
        });

        resolveSave!();
        await waitFor(() => {
            expect(saveButton).not.toBeDisabled();
        });
    });

    it('should hide configuration sections when channels are deselected', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        const telegramLabel = screen.getByText('Telegram').closest('label');
        await user.click(telegramLabel!);

        await waitFor(() => {
            expect(screen.getByLabelText(/telegram chat id/i)).toBeInTheDocument();
        });

        await user.click(telegramLabel!);

        await waitFor(() => {
            expect(screen.queryByLabelText(/telegram chat id/i)).not.toBeInTheDocument();
        });
    });

    it('should maintain backward compatibility with existing Email/Telegram setup', async () => {
        const user = userEvent.setup();
        const userWithTelegram: UserData = {
            ...mockUser,
            notification_channels: ['Email', 'Telegram'],
            telegram_chat_id: '987654321',
        };

        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} user={userWithTelegram} />
        );

        const emailCheckbox = screen.getByLabelText(/email/i).closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
        const telegramCheckbox = screen.getByLabelText(/telegram/i).closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;

        expect(emailCheckbox).toBeChecked();
        expect(telegramCheckbox).toBeChecked();

        await waitFor(() => {
            const telegramInput = screen.getByLabelText(/telegram chat id/i) as HTMLInputElement;
            expect(telegramInput.value).toBe('987654321');
        });
    });

    it('should render channel icons', () => {
        render(
            <NotificationsModal onClose={mockOnClose} onSave={mockOnSave} />
        );

        // Check for emoji icons (Email and Calendar)
        const emailLabel = screen.getByText('Email').closest('label');
        const calendarLabel = screen.getByText('Calendar').closest('label');

        expect(emailLabel?.querySelector('.channel-icon')).toBeInTheDocument();
        expect(calendarLabel?.querySelector('.channel-icon')).toBeInTheDocument();

        // Check for SVG icons (Telegram and WhatsApp)
        const telegramLabel = screen.getByText('Telegram').closest('label');
        const whatsappLabel = screen.getByText('WhatsApp').closest('label');

        expect(telegramLabel?.querySelector('.channel-icon-svg')).toBeInTheDocument();
        expect(whatsappLabel?.querySelector('.channel-icon-svg')).toBeInTheDocument();
    });
});

