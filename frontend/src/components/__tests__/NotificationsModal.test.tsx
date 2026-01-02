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
        telegramChatId: null,
        telegramUsername: null
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
        expect(badges).toHaveLength(1);
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

    it('should show inline Telegram connection panel when Telegram is selected', async () => {
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

        // Check for inline connection panel (not a separate modal)
        // Check for the link in the inline panel
        await waitFor(() => {
            const link = screen.getByRole('link', { name: /open telegram/i });
            expect(link).toBeInTheDocument();
        });
    });

    it('should show Telegram connection link in inline panel after selecting Telegram', async () => {
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
            const link = screen.getByRole('link', { name: /open telegram/i });
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

    it('should keep Telegram selected and show "Connecting..." badge when Telegram link is generated', async () => {
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
            const link = screen.getByRole('link', { name: /open telegram/i });
            expect(link).toBeInTheDocument();
        });

        // Telegram should remain selected and show connecting badge
        await waitFor(() => {
            expect(telegramRadio).toBeChecked();
            expect(screen.getByText('Connecting...')).toBeInTheDocument();
        });
    });

    it('should return to Email when cancel button is clicked in Telegram connection panel', async () => {
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
            expect(screen.getByRole('link', { name: /open telegram/i })).toBeInTheDocument();
        });

        // Find the cancel button in the connection panel
        const cancelButton = screen.getByRole('button', { name: /^cancel$/i });
        await user.click(cancelButton);

        await waitFor(() => {
            const emailRadio = screen.getByRole('radio', { name: /email/i });
            expect(emailRadio).toBeChecked();
            expect(screen.queryByRole('link', { name: /open telegram/i })).not.toBeInTheDocument();
            // Badge should not appear when canceling
            expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
        });

        // Should save Email preference when canceling
        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith('Email', undefined);
        });
    });

    it('should show connected status when Telegram is already connected', () => {
        const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
            connected: true,
            telegramChatId: '123456789',
            telegramUsername: 'testuser'
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

    it('should show inline connection panel when Telegram is selected but not connected', async () => {
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
            expect(screen.getByRole('link', { name: /open telegram/i })).toBeInTheDocument();
            expect(screen.getByText('Start the bot')).toBeInTheDocument();
            expect(screen.getByText('Waiting for connection...')).toBeInTheDocument();
        });

        // Telegram should remain selected
        expect(telegramRadio).toBeChecked();
    });

    it('should hide connection panel and show success message when connection is established', async () => {
        const user = userEvent.setup();
        let resolveStatus: (value: { connected: boolean; telegramChatId: string | null; telegramUsername: string | null }) => void;
        const mockGetTelegramStatusDelayed = vi.fn().mockImplementation(() => {
            return new Promise<{ connected: boolean; telegramChatId: string | null; telegramUsername: string | null }>((resolve) => {
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
            expect(screen.getByRole('link', { name: /open telegram/i })).toBeInTheDocument();
        });

        // Simulate connection
        resolveStatus!({ connected: true, telegramChatId: '123456789', telegramUsername: 'testuser' });

        await waitFor(() => {
            expect(screen.queryByRole('link', { name: /open telegram/i })).not.toBeInTheDocument();
            expect(screen.getByText(/telegram account connected/i)).toBeInTheDocument();
        });

        // Should automatically save when connected
        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith('Telegram', '123456789');
        }, { timeout: 3000 });
    });

    it('should save automatically when switching to Email channel', async () => {
        const user = userEvent.setup();
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
            />
        );

        // Select Telegram first to change from default Email
        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        // Wait for connection panel to appear
        await waitFor(() => {
            expect(screen.getByRole('link', { name: /open telegram/i })).toBeInTheDocument();
        }, { timeout: 3000 });

        // Now click Email to trigger save
        const emailRadio = screen.getByRole('radio', { name: /email/i });
        await user.click(emailRadio);

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith('Email', undefined);
        }, { timeout: 3000 });
    });

    it('should save automatically when Telegram channel is selected and connected', async () => {
        const user = userEvent.setup();
        const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
            connected: true,
            telegramChatId: '123456789',
            telegramUsername: 'testuser'
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

        // Switch to Email first, then back to Telegram to trigger save
        const emailRadio = screen.getByRole('radio', { name: /email/i });
        await user.click(emailRadio);

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith('Email', undefined);
        });

        mockOnSave.mockClear();

        // Now click Telegram to trigger save
        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalledWith('Telegram', '123456789');
        });
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

        // Switch to Telegram first, then cancel to trigger save with error
        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /open telegram/i })).toBeInTheDocument();
        });

        const cancelButton = screen.getByRole('button', { name: /^cancel$/i });
        await user.click(cancelButton);

        // After canceling, Email should be saved, which will trigger the error
        await waitFor(() => {
            expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });
    });

    it('should disable radio buttons during submission', async () => {
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

        // Switch to Telegram first, then cancel to trigger save
        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /open telegram/i })).toBeInTheDocument();
        });

        const cancelButton = screen.getByRole('button', { name: /^cancel$/i });
        await user.click(cancelButton);

        // After canceling, Email should be saved, which should disable radio buttons
        await waitFor(() => {
            const radioButtons = screen.getAllByRole('radio');
            radioButtons.forEach(radio => {
                expect(radio).toBeDisabled();
            });
        });

        resolveSave!();
        await waitFor(() => {
            const radioButtons = screen.getAllByRole('radio');
            radioButtons.forEach(radio => {
                expect(radio).not.toBeDisabled();
            });
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
