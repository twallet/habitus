// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsModal } from '../NotificationsModal';
import { UserData } from '../../models/User';

describe('NotificationsModal', () => {
    const mockOnClose = vi.fn();
    const mockOnSave = vi.fn().mockResolvedValue(undefined);
    const mockGetTelegramStartLink = vi.fn().mockResolvedValue({
        link: 'https://t.me/testbot?start=token123%201',
        token: 'token123'
    });
    const mockGetTelegramStatus = vi.fn().mockResolvedValue({
        connected: false,
        telegramChatId: null
    });

    const mockUser: UserData = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        notification_channels: 'Email',
        telegram_chat_id: '',
        created_at: '2024-01-15T10:30:00Z',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render modal with title', () => {
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        expect(screen.getByText('Configure notifications')).toBeInTheDocument();
    });

    it('should render all notification channels', () => {
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.getByText('Telegram')).toBeInTheDocument();
        expect(screen.getByText('WhatsApp')).toBeInTheDocument();
        expect(screen.getByText('MS Teams')).toBeInTheDocument();
        expect(screen.getByText('Slack')).toBeInTheDocument();
    });

    it('should have Email selected by default', () => {
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        const emailRadio = screen.getByRole('radio', { name: /email/i });
        expect(emailRadio).toBeChecked();
    });

    it('should show "Coming soon" badge for disabled channels', () => {
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        // Check for badges (not descriptions)
        const badges = screen.getAllByText('Coming soon').filter(
            (el) => el.className.includes('coming-soon-badge')
        );
        expect(badges).toHaveLength(3);
    });

    it('should close modal when close button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close modal when overlay is clicked', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        const overlay = document.querySelector('.modal-overlay');
        if (overlay) {
            await user.click(overlay);
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        }
    });

    it('should change selected channel when radio button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        expect(telegramRadio).toBeChecked();
        const emailRadio = screen.getByRole('radio', { name: /email/i });
        expect(emailRadio).not.toBeChecked();
    });

    it('should show email confirmation message when Email is selected', () => {
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
                user={mockUser}
            />
        );

        // Check for the info message (not the channel description)
        const emailMessage = screen.getByText((content, element) => {
            return (
                content.includes('Reminders will be sent to') &&
                element?.className.includes('message-text') === true
            );
        });
        expect(emailMessage).toBeInTheDocument();
        expect(emailMessage.textContent).toContain(mockUser.email!);
    });

    it('should show Telegram connection modal when Telegram is selected', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(mockGetTelegramStartLink).toHaveBeenCalledTimes(1);
        });

        // Check for modal title
        await waitFor(() => {
            expect(screen.getByText('Connect Telegram')).toBeInTheDocument();
        });

        // Check for the link in the modal
        await waitFor(() => {
            const link = screen.getByRole('link', { name: /connect telegram/i });
            expect(link).toBeInTheDocument();
        });
    });

    it('should show Telegram connection link in modal after selecting Telegram', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            const link = screen.getByRole('link', { name: /connect telegram/i });
            expect(link).toHaveAttribute('href', 'https://t.me/testbot?start=token123%201');
            expect(link).toHaveAttribute('target', '_blank');
        });
    });

    it('should check Telegram status after selecting Telegram', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(mockGetTelegramStatus).toHaveBeenCalled();
        });
    });

    it('should return to Email when cancel button is clicked in Telegram modal', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(screen.getByText('Connect Telegram')).toBeInTheDocument();
        });

        // Find the cancel button in the Telegram modal (there are multiple cancel buttons)
        const cancelButtons = screen.getAllByRole('button', { name: /^cancel$/i });
        // The cancel button in the Telegram modal should be the one inside the modal with title "Connect Telegram"
        const telegramModal = screen.getByText('Connect Telegram').closest('.modal-content');
        const cancelButton = telegramModal?.querySelector('button.btn-secondary');

        if (cancelButton) {
            await user.click(cancelButton);
        } else {
            // Fallback: click the last cancel button (should be the one in the Telegram modal)
            await user.click(cancelButtons[cancelButtons.length - 1]);
        }

        await waitFor(() => {
            const emailRadio = screen.getByRole('radio', { name: /email/i });
            expect(emailRadio).toBeChecked();
            expect(screen.queryByText('Connect Telegram')).not.toBeInTheDocument();
        });
    });

    it('should show connected status when Telegram is already connected', () => {
        const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
            connected: true,
            telegramChatId: '123456789'
        });

        const userWithTelegram: UserData = {
            ...mockUser,
            notification_channels: 'Telegram',
            telegram_chat_id: '123456789',
        };

        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatusConnected}
                user={userWithTelegram}
            />
        );

        expect(screen.getByText(/telegram account connected/i)).toBeInTheDocument();
        expect(screen.getByText(/123456789/)).toBeInTheDocument();
    });

    it('should load user preferences on mount', () => {
        const userWithPreferences: UserData = {
            ...mockUser,
            notification_channels: 'Telegram',
            telegram_chat_id: '123456789',
        };

        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
                user={userWithPreferences}
            />
        );

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        expect(telegramRadio).toBeChecked();
    });

    it('should disable save button when Telegram is selected but not connected', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(screen.getByText('Connect Telegram')).toBeInTheDocument();
        });

        // Close the modal to see the save button in the main form
        const cancelButtons = screen.getAllByRole('button', { name: /^cancel$/i });
        const telegramModal = screen.getByText('Connect Telegram').closest('.modal-content');
        const cancelButton = telegramModal?.querySelector('button.btn-secondary');

        if (cancelButton) {
            await user.click(cancelButton);
        } else {
            await user.click(cancelButtons[cancelButtons.length - 1]);
        }

        await waitFor(() => {
            // Telegram is still selected but not connected, so save should be disabled
            const telegramRadioAfterCancel = screen.getByRole('radio', { name: /telegram/i });
            expect(telegramRadioAfterCancel).toBeChecked();

            // The save button in the main form should be disabled
            const mainForm = document.querySelector('.notifications-form');
            const saveButton = mainForm?.querySelector('button[type="submit"]') as HTMLButtonElement;
            expect(saveButton).toBeDisabled();
        });

        expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should close Telegram modal when connection is established', async () => {
        const user = userEvent.setup();
        let resolveStatus: (value: { connected: boolean; telegramChatId: string | null }) => void;
        const mockGetTelegramStatusDelayed = vi.fn().mockImplementation(() => {
            return new Promise<{ connected: boolean; telegramChatId: string | null }>((resolve) => {
                resolveStatus = resolve;
            });
        });

        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatusDelayed}
            />
        );

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(screen.getByText('Connect Telegram')).toBeInTheDocument();
        });

        // Simulate connection
        resolveStatus!({ connected: true, telegramChatId: '123456789' });

        await waitFor(() => {
            expect(screen.queryByText('Connect Telegram')).not.toBeInTheDocument();
        });
    });

    it('should submit form with Email channel', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        const saveButton = screen.getByRole('button', { name: /^save$/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith('Email', undefined);
        });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should submit form with Telegram channel when connected', async () => {
        const user = userEvent.setup();
        const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
            connected: true,
            telegramChatId: '123456789'
        });

        const userWithTelegram: UserData = {
            ...mockUser,
            notification_channels: 'Telegram',
            telegram_chat_id: '123456789',
        };

        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatusConnected}
                user={userWithTelegram}
            />
        );

        const saveButton = screen.getByRole('button', { name: /^save$/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith('Telegram', '123456789');
        });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should display error message on save failure', async () => {
        const user = userEvent.setup();
        const errorMessage = 'Failed to save notification settings';
        const mockOnSaveWithError = vi.fn().mockRejectedValue(new Error(errorMessage));

        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSaveWithError}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
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
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSaveDelayed}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
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


    it('should render channel icons', () => {
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        // Check for emoji icons (Email)
        const emailLabel = screen.getByText('Email').closest('label');
        expect(emailLabel?.querySelector('.channel-icon')).toBeInTheDocument();

        // Check for SVG icons (Telegram, WhatsApp, etc.)
        const telegramLabel = screen.getByText('Telegram').closest('label');
        expect(telegramLabel?.querySelector('.channel-icon-svg')).toBeInTheDocument();
    });
});
