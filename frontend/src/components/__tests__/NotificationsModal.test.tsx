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
        link: 'https://t.me/testbot',
        token: 'token123',
        userId: 1
    });
    // Default mock that handles multiple calls (mount + useEffect)
    // Component calls checkTelegramStatus twice on mount: once in useEffect([]) and once in useEffect([user])
    const mockGetTelegramStatus = vi.fn()
        .mockResolvedValueOnce({
            connected: false,
            telegramChatId: null,
            telegramUsername: null,
            hasActiveToken: false
        })
        .mockResolvedValue({
            connected: false,
            telegramChatId: null,
            telegramUsername: null,
            hasActiveToken: false
        });

    const mockUser: UserData = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        notification_channels: 'Email',
        telegram_chat_id: '',
        created_at: '2024-01-15T10:30:00Z',
    };

    /**
     * Helper function to get Telegram radio button.
     * The Telegram radio button doesn't have an accessible name due to SVG and badge elements.
     */
    const getTelegramRadio = () => {
        return document.querySelector('input[type="radio"][value="Telegram"]') as HTMLInputElement;
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render modal with title', () => {
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
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
                    user={mockUser}
                />
            );

            expect(screen.getByText('Email')).toBeInTheDocument();
            expect(screen.getByText('Telegram')).toBeInTheDocument();
            expect(screen.getByText('WhatsApp')).toBeInTheDocument();
        });

        it('should render channel icons', () => {
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            const emailLabel = screen.getByText('Email').closest('label');
            expect(emailLabel?.querySelector('.channel-icon')).toBeInTheDocument();

            const telegramLabel = screen.getByText('Telegram').closest('label');
            expect(telegramLabel?.querySelector('.channel-icon-svg')).toBeInTheDocument();
        });

        it('should show "Coming soon" badge for disabled channels', () => {
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            const badges = screen.getAllByText('Coming soon').filter(
                (el) => el.className.includes('coming-soon-badge')
            );
            expect(badges.length).toBeGreaterThan(0);
        });

        it('should render close button', () => {
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
        });
    });

    describe('Initial State', () => {
        it('should default to Email when no user provided', () => {
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

        it('should load user notification preference on mount', () => {
            const userWithTelegram: UserData = {
                ...mockUser,
                notification_channels: 'Telegram',
                telegram_chat_id: '123456789',
            };

            const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
                connected: true,
                telegramChatId: '123456789',
                telegramUsername: 'testuser',
                hasActiveToken: false
            });

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusConnected}
                    user={userWithTelegram}
                />
            );

            const telegramRadio = getTelegramRadio();
            expect(telegramRadio).toBeChecked();
        });

        it('should check Telegram status on mount', async () => {
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            await waitFor(() => {
                expect(mockGetTelegramStatus).toHaveBeenCalled();
            });
        });

        it('should show email badge when user has email', () => {
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            expect(screen.getByText(mockUser.email!)).toBeInTheDocument();
        });
    });

    describe('Email Channel', () => {
        it('should select Email when clicked', async () => {
            const user = userEvent.setup();
            const userWithTelegram: UserData = {
                ...mockUser,
                notification_channels: 'Telegram',
                telegram_chat_id: '123456789',
            };

            const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
                connected: true,
                telegramChatId: '123456789',
                telegramUsername: 'testuser',
                hasActiveToken: false
            });

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusConnected}
                    user={userWithTelegram}
                />
            );

            await waitFor(() => {
                expect(mockGetTelegramStatusConnected).toHaveBeenCalled();
            });

            const emailRadio = screen.getByRole('radio', { name: /email/i });
            await user.click(emailRadio);

            await waitFor(() => {
                expect(emailRadio).toBeChecked();
                expect(mockOnSave).toHaveBeenCalledWith('Email', expect.anything());
            });
        });
    });

    describe('Telegram Channel - Not Connected', () => {
        it('should show "No account connected" badge when Telegram is not connected', async () => {
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('No account connected')).toBeInTheDocument();
            });
        });

        it('should open connection modal when Telegram is selected but not connected', async () => {
            const user = userEvent.setup();
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            const telegramRadio = getTelegramRadio();
            await user.click(telegramRadio);

            await waitFor(() => {
                expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
            });
        });

        it('should keep Email selected when opening Telegram connection modal', async () => {
            const user = userEvent.setup();
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            const telegramRadio = getTelegramRadio();
            await user.click(telegramRadio);

            await waitFor(() => {
                expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
            });

            const emailRadio = screen.getByRole('radio', { name: /email/i });
            expect(emailRadio).toBeChecked();
            expect(telegramRadio).not.toBeChecked();
        });

        it('should generate link when connection modal opens', async () => {
            const user = userEvent.setup();
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            const telegramRadio = getTelegramRadio();
            await user.click(telegramRadio);

            await waitFor(() => {
                expect(mockGetTelegramStartLink).toHaveBeenCalled();
            });
        });

        it('should switch back to Email when connection modal closes without connection', async () => {
            const user = userEvent.setup();
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            await user.click(getTelegramRadio());

            await waitFor(() => {
                expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
            });

            const closeButtons = screen.getAllByRole('button', { name: /close/i });
            const telegramModalCloseButton = closeButtons[closeButtons.length - 1];
            await user.click(telegramModalCloseButton);

            await waitFor(() => {
                const emailRadio = screen.getByRole('radio', { name: /email/i });
                expect(emailRadio).toBeChecked();
            });
        });
    });

    describe('Telegram Channel - Connected', () => {
        it('should show connected status when Telegram is already connected', async () => {
            const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
                connected: true,
                telegramChatId: '123456789',
                telegramUsername: 'testuser',
                hasActiveToken: false
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

            await waitFor(() => {
                expect(screen.getByText(/@testuser|Connected/i)).toBeInTheDocument();
            });
        });

        it('should select and save Telegram when clicked and already connected', async () => {
            const user = userEvent.setup();
            const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
                connected: true,
                telegramChatId: '123456789',
                telegramUsername: 'testuser',
                hasActiveToken: false
            });

            const userWithTelegram: UserData = {
                ...mockUser,
                notification_channels: 'Email',
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

            await waitFor(() => {
                expect(mockGetTelegramStatusConnected).toHaveBeenCalled();
            });

            const telegramRadio = document.querySelector('input[type="radio"][value="Telegram"]') as HTMLElement;
            await user.click(telegramRadio);

            await waitFor(() => {
                expect(mockOnSave).toHaveBeenCalledWith('Telegram', '123456789');
            });
        });

        it('should show disconnect button when Telegram is connected', async () => {
            const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
                connected: true,
                telegramChatId: '123456789',
                telegramUsername: 'testuser',
                hasActiveToken: false
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

            await waitFor(() => {
                const disconnectButton = screen.getByRole('button', { name: /disconnect telegram account/i });
                expect(disconnectButton).toBeInTheDocument();
            });
        });

        it('should disconnect Telegram when disconnect button is clicked', async () => {
            const user = userEvent.setup();
            const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
                connected: true,
                telegramChatId: '123456789',
                telegramUsername: 'testuser',
                hasActiveToken: false
            });

            const mockOnDisconnectTelegram = vi.fn().mockResolvedValue(undefined);

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
                    onDisconnectTelegram={mockOnDisconnectTelegram}
                    user={userWithTelegram}
                />
            );

            await waitFor(() => {
                expect(mockGetTelegramStatusConnected).toHaveBeenCalled();
            });

            const disconnectButton = screen.getByRole('button', { name: /disconnect telegram account/i });
            await user.click(disconnectButton);

            await waitFor(() => {
                expect(mockOnDisconnectTelegram).toHaveBeenCalled();
            });
        });

        it('should handle disconnect error', async () => {
            const user = userEvent.setup();
            const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
                connected: true,
                telegramChatId: '123456789',
                telegramUsername: 'testuser',
                hasActiveToken: false
            });

            const errorMessage = 'Failed to disconnect';
            const mockOnDisconnectTelegram = vi.fn().mockRejectedValue(new Error(errorMessage));

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
                    onDisconnectTelegram={mockOnDisconnectTelegram}
                    user={userWithTelegram}
                />
            );

            await waitFor(() => {
                expect(mockGetTelegramStatusConnected).toHaveBeenCalled();
            });

            const disconnectButton = screen.getByRole('button', { name: /disconnect telegram account/i });
            await user.click(disconnectButton);

            await waitFor(() => {
                expect(screen.getByText(errorMessage)).toBeInTheDocument();
            });
        });
    });

    describe('Telegram Connection Flow', () => {
        it('should show connection steps in modal', async () => {
            const user = userEvent.setup();
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            const telegramRadio = getTelegramRadio();
            await user.click(telegramRadio);

            await waitFor(() => {
                expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: /go to chat/i })).toBeInTheDocument();
            });
        });

        it('should show error when webhook is not configured', async () => {
            const user = userEvent.setup();
            const mockGetTelegramStartLinkWithError = vi.fn().mockResolvedValue({
                link: 'https://t.me/testbot',
                token: 'token123',
                userId: 1,
                webhookConfigured: false,
                webhookUrl: null,
                webhookError: null
            });

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLinkWithError}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            await user.click(getTelegramRadio());

            await waitFor(() => {
                expect(screen.getByText(/Telegram webhook is not configured/i)).toBeInTheDocument();
            });
        });

        it('should disable Go to chat button until Copy Key is clicked', async () => {
            const user = userEvent.setup();
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            await user.click(getTelegramRadio());

            await waitFor(() => {
                const goButton = screen.getByRole('button', { name: /go to chat/i });
                expect(goButton).toBeDisabled();
            });
        });

        it('should copy start command to clipboard when Copy Key button is clicked', async () => {
            const user = userEvent.setup();
            const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            const telegramRadio = getTelegramRadio();
            await user.click(telegramRadio);

            await waitFor(() => {
                expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
            });

            const copyButton = await waitFor(() => {
                return screen.getByRole('button', { name: /copy key/i });
            });

            await user.click(copyButton);

            await waitFor(() => {
                expect(writeTextSpy).toHaveBeenCalledWith('/start token123 1');
            });

            writeTextSpy.mockRestore();
        });

        it('should enable Go to chat button after Copy Key is clicked', async () => {
            const user = userEvent.setup();
            vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            await user.click(getTelegramRadio());

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
            });

            const copyButton = screen.getByRole('button', { name: /copy key/i });
            await user.click(copyButton);

            await waitFor(() => {
                const goButton = screen.getByRole('button', { name: /go to chat/i });
                expect(goButton).not.toBeDisabled();
            });
        });

        it('should show waiting view when Go to chat button is clicked', async () => {
            const user = userEvent.setup();
            vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            await user.click(getTelegramRadio());

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /copy key/i }));
            await user.click(screen.getByRole('button', { name: /go to chat/i }));

            await waitFor(() => {
                expect(screen.getByText(/Waiting for you to paste the key/i)).toBeInTheDocument();
                expect(screen.getByRole('button', { name: /cancel connection/i })).toBeInTheDocument();
            });
        });

        it('should close connection modal when Cancel Connection is clicked', async () => {
            const user = userEvent.setup();
            const mockCancelTelegramConnection = vi.fn().mockResolvedValue({ success: true });
            vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    onCancelTelegramConnection={mockCancelTelegramConnection}
                    user={mockUser}
                />
            );

            await user.click(getTelegramRadio());

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /copy key/i }));
            await user.click(screen.getByRole('button', { name: /go to chat/i }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /cancel connection/i })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /cancel connection/i }));

            await waitFor(() => {
                expect(mockCancelTelegramConnection).toHaveBeenCalled();
                expect(screen.queryByText(/Waiting for you to paste the key/i)).not.toBeInTheDocument();
            });
        });

        it('should poll connection status every 2 seconds when in waiting state', async () => {
            const user = userEvent.setup();
            vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

            let callCount = 0;
            const mockGetTelegramStatusPolling = vi.fn().mockImplementation(async () => {
                callCount++;
                // First 2 calls: mount effects (useEffect([]) + useEffect([user]))
                if (callCount <= 2) {
                    return {
                        connected: false,
                        telegramChatId: null,
                        telegramUsername: null,
                        hasActiveToken: false
                    };
                }
                // Call 3: initial poll when entering waiting state
                if (callCount === 3) {
                    return {
                        connected: false,
                        telegramChatId: null,
                        telegramUsername: null,
                        hasActiveToken: false
                    };
                }
                // Call 4: after 2 seconds
                if (callCount === 4) {
                    return {
                        connected: false,
                        telegramChatId: null,
                        telegramUsername: null,
                        hasActiveToken: false
                    };
                }
                // Call 5: after another 2 seconds - still not connected
                return {
                    connected: false,
                    telegramChatId: null,
                    telegramUsername: null,
                    hasActiveToken: false
                };
            });

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusPolling}
                    user={mockUser}
                />
            );

            await user.click(getTelegramRadio());

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /copy key/i }));
            await user.click(screen.getByRole('button', { name: /go to chat/i }));

            await waitFor(() => {
                expect(screen.getByText(/Waiting for you to paste the key/i)).toBeInTheDocument();
            });

            // Wait for initial poll - polling starts immediately when entering waiting state
            const initialCallCount = mockGetTelegramStatusPolling.mock.calls.length;
            await waitFor(() => {
                expect(mockGetTelegramStatusPolling.mock.calls.length).toBeGreaterThan(initialCallCount);
            }, { timeout: 3000 });

            // Wait for first polling interval - should happen after ~2 seconds
            const callCountAfterInitial = mockGetTelegramStatusPolling.mock.calls.length;
            await waitFor(() => {
                expect(mockGetTelegramStatusPolling.mock.calls.length).toBeGreaterThan(callCountAfterInitial);
            }, { timeout: 3000 });

            // Wait for second polling interval - should happen after another ~2 seconds
            const callCountAfterFirstPoll = mockGetTelegramStatusPolling.mock.calls.length;
            await waitFor(() => {
                expect(mockGetTelegramStatusPolling.mock.calls.length).toBeGreaterThan(callCountAfterFirstPoll);
            }, { timeout: 3000 });
        });

        it('should stop polling and auto-close modal when connection is detected', async () => {
            const user = userEvent.setup();
            vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

            let callCount = 0;
            let waitingStateEntered = false;
            const mockGetTelegramStatusPolling = vi.fn().mockImplementation(async () => {
                callCount++;
                // First 2 calls: mount effects
                if (callCount <= 2) {
                    return {
                        connected: false,
                        telegramChatId: null,
                        telegramUsername: null,
                        hasActiveToken: false
                    };
                }
                // Call 3: initial poll when entering waiting state
                if (callCount === 3) {
                    return {
                        connected: false,
                        telegramChatId: null,
                        telegramUsername: null,
                        hasActiveToken: false
                    };
                }
                // After waiting state is entered, allow a few more polls before returning connected
                // This ensures the waiting view is visible before connection is detected
                if (!waitingStateEntered || callCount < 5) {
                    return {
                        connected: false,
                        telegramChatId: null,
                        telegramUsername: null,
                        hasActiveToken: false
                    };
                }
                // Call 5+: connection detected after polling
                return {
                    connected: true,
                    telegramChatId: '123456789',
                    telegramUsername: 'testuser',
                    hasActiveToken: false
                };
            });

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusPolling}
                    user={mockUser}
                />
            );

            await user.click(getTelegramRadio());

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /copy key/i }));
            await user.click(screen.getByRole('button', { name: /go to chat/i }));

            // Mark that waiting state has been entered
            await waitFor(() => {
                expect(screen.getByText(/Waiting for you to paste the key/i)).toBeInTheDocument();
            });
            waitingStateEntered = true;

            // Wait for initial poll - polling starts immediately when entering waiting state
            await waitFor(() => {
                expect(mockGetTelegramStatusPolling).toHaveBeenCalled();
            }, { timeout: 3000 });

            // Wait for polling to detect connection and close modal
            // The mock returns connected on call 5+, so polling should detect it
            await waitFor(() => {
                expect(screen.queryByText(/Waiting for you to paste the key/i)).not.toBeInTheDocument();
            }, { timeout: 5000 });

            // Verify polling stopped (no more calls after connection detected)
            const callCountAfterConnection = mockGetTelegramStatusPolling.mock.calls.length;
            // Wait a bit to ensure no additional calls
            await new Promise(resolve => setTimeout(resolve, 2500));
            expect(mockGetTelegramStatusPolling.mock.calls.length).toBe(callCountAfterConnection);
        });

        it('should stop polling when modal is closed', async () => {
            const user = userEvent.setup();
            vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
            // Mock window.confirm to return true (user confirms closing)
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

            const mockGetTelegramStatusPolling = vi.fn().mockResolvedValue({
                connected: false,
                telegramChatId: null,
                telegramUsername: null,
                hasActiveToken: false
            });

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusPolling}
                    user={mockUser}
                />
            );

            await user.click(getTelegramRadio());

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: /copy key/i }));
            await user.click(screen.getByRole('button', { name: /go to chat/i }));

            await waitFor(() => {
                expect(screen.getByText(/Waiting for you to paste the key/i)).toBeInTheDocument();
            });

            // Wait for initial poll
            await waitFor(() => {
                expect(mockGetTelegramStatusPolling).toHaveBeenCalled();
            }, { timeout: 3000 });

            // Close the modal (click the main modal close button, not the Telegram modal close button)
            const closeButtons = screen.getAllByRole('button', { name: /close/i });
            const mainModalCloseButton = closeButtons[0];
            await user.click(mainModalCloseButton);

            await waitFor(() => {
                expect(screen.queryByText(/Waiting for you to paste the key/i)).not.toBeInTheDocument();
            }, { timeout: 3000 });

            // Verify polling stopped (no more calls after modal closed)
            const callCountBeforeClose = mockGetTelegramStatusPolling.mock.calls.length;
            // Wait a bit to ensure no additional calls (polling interval is 2 seconds)
            await new Promise(resolve => setTimeout(resolve, 2500));
            expect(mockGetTelegramStatusPolling.mock.calls.length).toBe(callCountBeforeClose);

            confirmSpy.mockRestore();
        });

        it('should verify command text is not displayed in UI', async () => {
            const user = userEvent.setup();
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            await user.click(getTelegramRadio());

            await waitFor(() => {
                expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
            });

            // Verify the command text (/start token123 1) is NOT displayed
            expect(screen.queryByText('/start token123 1')).not.toBeInTheDocument();
            expect(screen.queryByText('/start')).not.toBeInTheDocument();
            expect(screen.queryByText('token123')).not.toBeInTheDocument();

            // But the Copy key button should be present
            expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
        });
    });

    describe('Telegram Connection Success', () => {
        it('should auto-select Telegram when connection is detected via status check', async () => {
            const user = userEvent.setup();
            vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

            let callCount = 0;
            const waitingStateRef = { value: false, enteredAtCall: 0 };
            const mockGetTelegramStatusConnected = vi.fn().mockImplementation(async () => {
                callCount++;
                // Return not connected until we're in waiting state
                if (!waitingStateRef.value) {
                    return {
                        connected: false,
                        telegramChatId: null,
                        telegramUsername: null,
                        hasActiveToken: false
                    };
                }
                // After entering waiting state, allow a few polling calls before returning connected
                // This ensures we've had at least 2-3 polling attempts
                const callsSinceWaiting = callCount - waitingStateRef.enteredAtCall;
                if (callsSinceWaiting < 2) {
                    return {
                        connected: false,
                        telegramChatId: null,
                        telegramUsername: null,
                        hasActiveToken: false
                    };
                }
                // Connection detected via polling
                return {
                    connected: true,
                    telegramChatId: '123456789',
                    telegramUsername: 'testuser',
                    hasActiveToken: false
                };
            });

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusConnected}
                    user={mockUser}
                />
            );

            await waitFor(() => {
                expect(mockGetTelegramStatusConnected).toHaveBeenCalled();
            }, { timeout: 3000 });

            // Initially Email should be selected
            const emailRadio = screen.getByRole('radio', { name: /email/i });
            expect(emailRadio).toBeChecked();

            // Click Telegram to open connection modal (Telegram is not connected yet)
            await user.click(getTelegramRadio());

            await waitFor(() => {
                expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
            }, { timeout: 3000 });

            // Go through the connection steps to enter waiting state
            await user.click(screen.getByRole('button', { name: /copy key/i }));
            await user.click(screen.getByRole('button', { name: /go to chat/i }));

            await waitFor(() => {
                expect(screen.getByText(/Waiting for you to paste the key/i)).toBeInTheDocument();
            }, { timeout: 3000 });

            // Mark that we're now in waiting state - polling will start and detect connection
            // Record the current call count so we can ensure a few polling calls happen first
            waitingStateRef.value = true;
            waitingStateRef.enteredAtCall = callCount;

            // Polling will detect connection and auto-close modal
            // Wait for modal to auto-close when connection is detected
            await waitFor(() => {
                expect(screen.queryByText(/Waiting for you to paste the key/i)).not.toBeInTheDocument();
            }, { timeout: 5000 });

            // Wait for Telegram to be auto-selected
            await waitFor(() => {
                const telegramRadio = getTelegramRadio();
                expect(telegramRadio).toBeChecked();
            }, { timeout: 5000 });

            // Verify save was called with Telegram
            await waitFor(() => {
                expect(mockOnSave).toHaveBeenCalledWith('Telegram', '123456789');
            }, { timeout: 3000 });
        });
    });

    describe('Telegram Status Checking', () => {
        it('should handle hasActiveToken state', async () => {
            const mockGetTelegramStatusWithToken = vi.fn().mockResolvedValue({
                connected: false,
                telegramChatId: null,
                telegramUsername: null,
                hasActiveToken: true
            });

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusWithToken}
                    user={mockUser}
                />
            );

            await waitFor(() => {
                expect(mockGetTelegramStatusWithToken).toHaveBeenCalled();
            });

            const emailRadio = screen.getByRole('radio', { name: /email/i });
            expect(emailRadio).toBeChecked();
            expect(screen.getByText('No account connected')).toBeInTheDocument();
        });

        it('should check status when user prop changes', async () => {
            // Mock handles initial mount calls (2 calls: useEffect([]) + useEffect([user]))
            let callCount = 0;
            const mockGetTelegramStatusForRerender = vi.fn().mockImplementation(async () => {
                callCount++;
                // First 2 calls: mount effects
                if (callCount <= 2) {
                    return {
                        connected: false,
                        telegramChatId: null,
                        telegramUsername: null,
                        hasActiveToken: false
                    };
                }
                // Subsequent calls: connected
                return {
                    connected: true,
                    telegramChatId: '123456789',
                    telegramUsername: 'testuser',
                    hasActiveToken: false
                };
            });

            const { rerender } = render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusForRerender}
                    user={mockUser}
                />
            );

            // Wait for initial mount calls (2 calls expected)
            await waitFor(() => {
                expect(mockGetTelegramStatusForRerender.mock.calls.length).toBeGreaterThanOrEqual(2);
            }, { timeout: 3000 });

            const callCountBeforeRerender = mockGetTelegramStatusForRerender.mock.calls.length;

            const updatedUser: UserData = {
                ...mockUser,
                telegram_chat_id: '123456789',
            };

            rerender(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusForRerender}
                    user={updatedUser}
                />
            );

            // When user has telegram_chat_id, useEffect calls checkTelegramStatus if !telegramUsername
            await waitFor(() => {
                expect(mockGetTelegramStatusForRerender.mock.calls.length).toBeGreaterThan(callCountBeforeRerender);
            }, { timeout: 5000 });
        });

        it('should handle Connecting state (hasActiveToken true but not connected)', async () => {
            // Mock handles multiple calls on mount (2 calls expected)
            const mockGetTelegramStatusConnecting = vi.fn()
                .mockResolvedValueOnce({
                    connected: false,
                    telegramChatId: null,
                    telegramUsername: null,
                    hasActiveToken: true // Active token exists but not connected yet
                })
                .mockResolvedValue({
                    connected: false,
                    telegramChatId: null,
                    telegramUsername: null,
                    hasActiveToken: true // Active token exists but not connected yet
                });

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusConnecting}
                    user={mockUser}
                />
            );

            // Wait for mount calls (2 calls expected)
            await waitFor(() => {
                expect(mockGetTelegramStatusConnecting.mock.calls.length).toBeGreaterThanOrEqual(2);
            }, { timeout: 5000 });

            // Should show "No account connected" badge
            await waitFor(() => {
                expect(screen.getByText('No account connected')).toBeInTheDocument();
            }, { timeout: 3000 });

            // Email should be selected (Telegram not connected)
            await waitFor(() => {
                const emailRadio = screen.getByRole('radio', { name: /email/i });
                expect(emailRadio).toBeChecked();
            }, { timeout: 3000 });
        });

        it('should automatically switch to Email when Telegram is selected but connection is lost', async () => {
            let callCount = 0;
            const mockGetTelegramStatusLost = vi.fn().mockImplementation(async () => {
                callCount++;
                // First 2 calls: connected (initial state from mount - useEffect([]) + useEffect([user]))
                if (callCount <= 2) {
                    return {
                        connected: true,
                        telegramChatId: '123456789',
                        telegramUsername: 'testuser',
                        hasActiveToken: false
                    };
                }
                // Subsequent calls: disconnected (simulating connection loss detected on status check)
                return {
                    connected: false,
                    telegramChatId: null,
                    telegramUsername: null,
                    hasActiveToken: false
                };
            });

            const userWithTelegram: UserData = {
                ...mockUser,
                notification_channels: 'Telegram',
                telegram_chat_id: '123456789',
            };

            const { rerender } = render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusLost}
                    user={userWithTelegram}
                />
            );

            // Wait for initial status check
            await waitFor(() => {
                expect(mockGetTelegramStatusLost).toHaveBeenCalled();
            });

            // Initially Telegram should be selected
            await waitFor(() => {
                const telegramRadio = getTelegramRadio();
                expect(telegramRadio).toBeChecked();
            }, { timeout: 3000 });

            // Simulate user prop change to trigger status check again
            // This simulates the scenario where the backend detects connection loss
            const userWithoutTelegram: UserData = {
                ...mockUser,
                notification_channels: 'Telegram',
                telegram_chat_id: '', // Connection lost
            };

            rerender(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusLost}
                    user={userWithoutTelegram}
                />
            );

            // Status check detects connection is lost - should switch to Email
            await waitFor(() => {
                const emailRadio = screen.getByRole('radio', { name: /email/i });
                expect(emailRadio).toBeChecked();
            }, { timeout: 5000 });

            // Verify Email preference was saved
            await waitFor(() => {
                expect(mockOnSave).toHaveBeenCalledWith('Email', expect.anything());
            }, { timeout: 3000 });
        });
    });

    describe('Error Handling', () => {
        it('should display error message on save failure', async () => {
            const user = userEvent.setup();
            const errorMessage = 'Failed to save notification settings';
            const mockOnSaveWithError = vi.fn().mockRejectedValue(new Error(errorMessage));

            // When user has telegram_chat_id, useEffect calls checkTelegramStatus if !telegramUsername
            // Mount calls: useEffect([]) + useEffect([user]) if !telegramUsername
            const mockGetTelegramStatusConnected = vi.fn()
                .mockResolvedValueOnce({
                    connected: true,
                    telegramChatId: '123456789',
                    telegramUsername: 'testuser',
                    hasActiveToken: false
                })
                .mockResolvedValue({
                    connected: true,
                    telegramChatId: '123456789',
                    telegramUsername: 'testuser',
                    hasActiveToken: false
                });

            const userWithTelegram: UserData = {
                ...mockUser,
                notification_channels: 'Telegram',
                telegram_chat_id: '123456789',
            };

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSaveWithError}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusConnected}
                    user={userWithTelegram}
                />
            );

            await waitFor(() => {
                expect(mockGetTelegramStatusConnected).toHaveBeenCalled();
            }, { timeout: 3000 });

            const emailRadio = screen.getByRole('radio', { name: /email/i });
            await user.click(emailRadio);

            await waitFor(() => {
                expect(screen.getByText(errorMessage)).toBeInTheDocument();
            }, { timeout: 5000 });
        });

        it('should allow dismissing error message', async () => {
            const user = userEvent.setup();
            const errorMessage = 'Failed to save notification settings';
            const mockOnSaveWithError = vi.fn().mockRejectedValue(new Error(errorMessage));

            // When user has telegram_chat_id, useEffect calls checkTelegramStatus if !telegramUsername
            const mockGetTelegramStatusConnected = vi.fn()
                .mockResolvedValueOnce({
                    connected: true,
                    telegramChatId: '123456789',
                    telegramUsername: 'testuser',
                    hasActiveToken: false
                })
                .mockResolvedValue({
                    connected: true,
                    telegramChatId: '123456789',
                    telegramUsername: 'testuser',
                    hasActiveToken: false
                });

            const userWithTelegram: UserData = {
                ...mockUser,
                notification_channels: 'Telegram',
                telegram_chat_id: '123456789',
            };

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSaveWithError}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusConnected}
                    user={userWithTelegram}
                />
            );

            await waitFor(() => {
                expect(mockGetTelegramStatusConnected).toHaveBeenCalled();
            }, { timeout: 3000 });

            const emailRadio = screen.getByRole('radio', { name: /email/i });
            await user.click(emailRadio);

            await waitFor(() => {
                expect(screen.getByText(errorMessage)).toBeInTheDocument();
            }, { timeout: 5000 });

            const closeButtons = screen.getAllByRole('button', { name: /close/i });
            const errorMessageCloseButton = closeButtons.find(btn =>
                btn.closest('.message.error')
            );
            if (errorMessageCloseButton) {
                await user.click(errorMessageCloseButton);
            }

            await waitFor(() => {
                expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
            }, { timeout: 3000 });
        });

        it('should allow dismissing success message', async () => {
            const user = userEvent.setup();
            // Mock handles 2 calls on mount (useEffect([]) + useEffect([user]))
            const mockGetTelegramStatusConnected = vi.fn()
                .mockResolvedValueOnce({
                    connected: false,
                    telegramChatId: null,
                    telegramUsername: null,
                    hasActiveToken: false
                })
                .mockResolvedValue({
                    connected: false,
                    telegramChatId: null,
                    telegramUsername: null,
                    hasActiveToken: false
                });

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusConnected}
                    user={mockUser}
                />
            );

            await waitFor(() => {
                expect(mockGetTelegramStatusConnected).toHaveBeenCalledTimes(2);
            }, { timeout: 3000 });

            await user.click(getTelegramRadio());

            await waitFor(() => {
                expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
            }, { timeout: 3000 });

            const closeButtons = screen.getAllByRole('button', { name: /close/i });
            const telegramModalCloseButton = closeButtons[closeButtons.length - 1];

            mockGetTelegramStatusConnected.mockResolvedValue({
                connected: true,
                telegramChatId: '123456789',
                telegramUsername: 'testuser',
                hasActiveToken: false
            });

            await user.click(telegramModalCloseButton);

            await waitFor(() => {
                expect(screen.getByText(/Telegram connected successfully/i)).toBeInTheDocument();
            }, { timeout: 5000 });

            const successCloseButtons = screen.getAllByRole('button', { name: /close/i });
            const successCloseButton = successCloseButtons.find(btn =>
                btn.closest('.message.success')
            );

            if (successCloseButton) {
                await user.click(successCloseButton);
                await waitFor(() => {
                    expect(screen.queryByText(/Telegram connected successfully/i)).not.toBeInTheDocument();
                }, { timeout: 3000 });
            }
        });
    });

    describe('State Management', () => {
        it('should disable radio buttons while submitting', async () => {
            const user = userEvent.setup();
            let resolveSave: () => void;
            const savePromise = new Promise<void>((resolve) => {
                resolveSave = resolve;
            });
            const mockOnSaveDelayed = vi.fn().mockImplementation(() => savePromise);

            const userWithTelegram: UserData = {
                ...mockUser,
                notification_channels: 'Telegram',
                telegram_chat_id: '123456789',
            };

            const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
                connected: true,
                telegramChatId: '123456789',
                telegramUsername: 'testuser',
                hasActiveToken: false
            });

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSaveDelayed}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusConnected}
                    user={userWithTelegram}
                />
            );

            await waitFor(() => {
                expect(mockGetTelegramStatusConnected).toHaveBeenCalled();
            }, { timeout: 3000 });

            // Wait for Telegram to be selected
            await waitFor(() => {
                const telegramRadio = getTelegramRadio();
                expect(telegramRadio).toBeChecked();
            }, { timeout: 3000 });

            // Click Email to trigger save (switching from Telegram to Email)
            const emailRadio = screen.getByRole('radio', { name: /email/i });
            await user.click(emailRadio);

            // Radio buttons should be disabled while saving
            await waitFor(() => {
                expect(emailRadio).toBeDisabled();
            }, { timeout: 5000 });

            resolveSave!();
            await savePromise;

            // Radio buttons should be enabled again
            await waitFor(() => {
                expect(emailRadio).not.toBeDisabled();
            }, { timeout: 3000 });
        });

        it('should prevent double submission', async () => {
            const user = userEvent.setup();
            let resolveSave: () => void;
            const savePromise = new Promise<void>((resolve) => {
                resolveSave = resolve;
            });
            const mockOnSaveDelayed = vi.fn().mockImplementation(() => savePromise);

            const userWithTelegram: UserData = {
                ...mockUser,
                notification_channels: 'Telegram',
                telegram_chat_id: '123456789',
            };

            // When user has telegram_chat_id, useEffect calls checkTelegramStatus if !telegramUsername
            const mockGetTelegramStatusConnected = vi.fn()
                .mockResolvedValueOnce({
                    connected: true,
                    telegramChatId: '123456789',
                    telegramUsername: 'testuser',
                    hasActiveToken: false
                })
                .mockResolvedValue({
                    connected: true,
                    telegramChatId: '123456789',
                    telegramUsername: 'testuser',
                    hasActiveToken: false
                });

            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSaveDelayed}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatusConnected}
                    user={userWithTelegram}
                />
            );

            await waitFor(() => {
                expect(mockGetTelegramStatusConnected.mock.calls.length).toBeGreaterThanOrEqual(1);
            }, { timeout: 3000 });

            await waitFor(() => {
                const telegramRadio = getTelegramRadio();
                expect(telegramRadio).toBeChecked();
            }, { timeout: 3000 });

            const emailRadio = screen.getByRole('radio', { name: /email/i });
            await user.click(emailRadio);
            await user.click(emailRadio);

            await waitFor(() => {
                expect(mockOnSaveDelayed).toHaveBeenCalledTimes(1);
            }, { timeout: 5000 });

            resolveSave!();
            await savePromise;
        });
    });

    describe('Modal Closing', () => {
        it('should close modal when close button is clicked', async () => {
            const user = userEvent.setup();
            render(
                <NotificationsModal
                    onClose={mockOnClose}
                    onSave={mockOnSave}
                    onGetTelegramStartLink={mockGetTelegramStartLink}
                    onGetTelegramStatus={mockGetTelegramStatus}
                    user={mockUser}
                />
            );

            // Wait for modal to render
            await waitFor(() => {
                expect(screen.getByText('Configure notifications')).toBeInTheDocument();
            }, { timeout: 3000 });

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
                    user={mockUser}
                />
            );

            // Wait for modal to render
            await waitFor(() => {
                expect(screen.getByText('Configure notifications')).toBeInTheDocument();
            }, { timeout: 3000 });

            const overlay = document.querySelector('.modal-overlay');
            if (overlay) {
                await user.click(overlay);
                expect(mockOnClose).toHaveBeenCalledTimes(1);
            }
        });
    });
});

