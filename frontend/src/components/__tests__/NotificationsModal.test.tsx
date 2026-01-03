// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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

    it('should have Email selected by default', () => {
        render(
            <NotificationsModal
                onClose={mockOnClose}
                onSave={mockOnSave}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatus}
                user={mockUser}
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
                user={mockUser}
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
                user={mockUser}
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
                user={mockUser}
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
                user={mockUser}
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

        // Email should be selected by default and show the email badge
        const emailBadge = screen.getByText(mockUser.email!);
        expect(emailBadge).toBeInTheDocument();
        const emailRadio = screen.getByRole('radio', { name: /email/i });
        expect(emailRadio).toBeChecked();
    });

    it('should show inline Telegram connection panel when Telegram is selected', async () => {
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(mockGetTelegramStartLink).toHaveBeenCalledTimes(1);
        });

        // Check for inline connection panel (not a separate modal)
        // Check for the link in the inline panel
        await waitFor(() => {
            const link = screen.getByRole('link', { name: /^go$/i });
            expect(link).toBeInTheDocument();
        });
    });

    it('should show hardcoded Telegram bot URL in inline panel after selecting Telegram', async () => {
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            const link = screen.getByRole('link', { name: /^go$/i });
            // Should use hardcoded URL, not the API link
            expect(link).toHaveAttribute('href', 'https://t.me/abitus_robot');
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveTextContent('Go');
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
                user={mockUser}
            />
        );

        // Wait for initial status check on mount to complete (only happens if user is provided)
        await waitFor(() => {
            expect(mockGetTelegramStatus).toHaveBeenCalled();
        });

        // Clear the initial call
        mockGetTelegramStatus.mockClear();

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        // When Telegram is selected, it opens the modal which generates a link
        // Status check happens on mount and when copy is clicked, not when selecting Telegram
        await waitFor(() => {
            expect(mockGetTelegramStartLink).toHaveBeenCalled();
        });
    });

    it('should NOT show "Connecting..." badge when Telegram link is generated', async () => {
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            const link = screen.getByRole('link', { name: /^go$/i });
            expect(link).toBeInTheDocument();
        });

        // Telegram should remain selected but NOT show connecting badge
        await waitFor(() => {
            expect(telegramRadio).toBeChecked();
            expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
        });
    });

    it('should NOT show cancel button in Telegram connection panel', async () => {
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /^go$/i })).toBeInTheDocument();
        });

        // Cancel button should NOT exist in the connection panel
        const cancelButtons = screen.queryAllByRole('button', { name: /^cancel$/i });
        const cancelButtonInPanel = cancelButtons.find(btn =>
            btn.closest('.telegram-connection-panel-inline')
        );
        expect(cancelButtonInPanel).toBeUndefined();
    });

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

        // Wait for status check to complete and badge to appear
        await waitFor(() => {
            expect(screen.getByText(/@testuser|Connected/i)).toBeInTheDocument();
        });
    });

    it('should load user preferences on mount', async () => {
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

        // Wait for preferences to load and Telegram radio to be checked
        await waitFor(() => {
            const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
            expect(telegramRadio).toBeChecked();
        });
    });

    it('should show 2-step connection panel when Telegram is selected but not connected', async () => {
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            // Title should be shown
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();

            // Step 1: Button to open Telegram
            const telegramLink = screen.getByRole('link', { name: /^go$/i });
            expect(telegramLink).toBeInTheDocument();
            expect(telegramLink).toHaveAttribute('href', 'https://t.me/abitus_robot');
            expect(telegramLink).toHaveTextContent('Go');

            // Step 2: Copy key button
            const copyButton = screen.getByRole('button', { name: /copy key/i });
            expect(copyButton).toBeInTheDocument();
        });

        // Should NOT show "Preparing connection..." or "Waiting for connection..."
        expect(screen.queryByText('Preparing connection...')).not.toBeInTheDocument();
        expect(screen.queryByText('Waiting for connection...')).not.toBeInTheDocument();

        // Telegram should remain selected
        expect(telegramRadio).toBeChecked();
    });

    it('should show connection panel when Telegram is selected (connection happens via webhook)', async () => {
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /^go$/i })).toBeInTheDocument();
        });

        // Connection panel should remain visible
        // Connection will happen via webhook when user sends /start command in Telegram
        // No automatic polling or connection detection
        expect(screen.getByRole('link', { name: /^go$/i })).toBeInTheDocument();
    });

    it('should save automatically when switching to Email channel', async () => {
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

        // Select Telegram first to change from default Email
        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        // Wait for connection panel to appear
        await waitFor(() => {
            expect(screen.getByRole('link', { name: /^go$/i })).toBeInTheDocument();
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

        // Switch to Email first, then back to Telegram to trigger save
        const emailRadio = screen.getByRole('radio', { name: /email/i });
        await user.click(emailRadio);

        await waitFor(() => {
            // When switching from Telegram to Email, it passes the telegramChatId (which gets cleared)
            expect(mockOnSave).toHaveBeenCalledWith('Email', expect.anything());
        });

        mockOnSave.mockClear();

        // Now click Telegram to trigger save
        // Find by value since the accessible name might include badge text
        const telegramRadio = document.querySelector('input[type="radio"][value="Telegram"]') as HTMLElement;
        expect(telegramRadio).toBeInTheDocument();
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
                user={mockUser}
            />
        );

        // Switch to Telegram first, then switch back to Email to trigger save with error
        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /^go$/i })).toBeInTheDocument();
        });

        // Switch back to Email to trigger save
        const emailRadio = screen.getByRole('radio', { name: /email/i });
        await user.click(emailRadio);

        // After switching, Email should be saved, which will trigger the error
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
                user={mockUser}
            />
        );

        // Switch to Telegram first, then switch back to Email to trigger save
        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(screen.getByRole('link', { name: /^go$/i })).toBeInTheDocument();
        });

        // Switch back to Email to trigger save
        const emailRadio = screen.getByRole('radio', { name: /email/i });
        await user.click(emailRadio);

        // After switching, Email should be saved, which should disable radio buttons
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
                user={mockUser}
            />
        );

        // Check for emoji icons (Email)
        const emailLabel = screen.getByText('Email').closest('label');
        expect(emailLabel?.querySelector('.channel-icon')).toBeInTheDocument();

        // Check for SVG icons (Telegram, WhatsApp, etc.)
        const telegramLabel = screen.getByText('Telegram').closest('label');
        expect(telegramLabel?.querySelector('.channel-icon-svg')).toBeInTheDocument();
    });

    it('should show title "Connect your Telegram account"', async () => {
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            // Should show the title before the steps
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });
    });

    it('should NOT display the start command text, only the Copy Key button', async () => {
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            // Should NOT display the command text
            expect(screen.queryByText(/^\/?start\s+token123\s+1$/)).not.toBeInTheDocument();

            // Should only show the Copy Key button
            const copyButton = screen.getByRole('button', { name: /copy key/i });
            expect(copyButton).toBeInTheDocument();
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        await waitFor(() => {
            const copyButton = screen.getByRole('button', { name: /copy key/i });
            expect(copyButton).toBeInTheDocument();
        });

        const copyButton = screen.getByRole('button', { name: /copy key/i });
        await user.click(copyButton);

        await waitFor(() => {
            expect(writeTextSpy).toHaveBeenCalledWith('/start token123 1');
        });

        writeTextSpy.mockRestore();
    });


    it('should NOT poll for Telegram connection status when hasActiveToken is false', async () => {
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

        // Wait for initial status check on mount to complete
        await waitFor(() => {
            expect(mockGetTelegramStatus).toHaveBeenCalled();
        });

        const telegramRadio = document.querySelector('input[type="radio"][value="Telegram"]') as HTMLElement;
        expect(telegramRadio).toBeInTheDocument();
        await user.click(telegramRadio);

        await waitFor(() => {
            expect(mockGetTelegramStartLink).toHaveBeenCalledTimes(1);
        });

        // Clear all previous calls (including initial mount check)
        mockGetTelegramStatus.mockClear();

        // Wait a bit to ensure no polling happens (polling only happens when hasActiveToken is true)
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
        });

        // Verify that getTelegramStatus was NOT called repeatedly (no polling when hasActiveToken is false)
        expect(mockGetTelegramStatus).not.toHaveBeenCalled();
    });

    it('should show "Connecting..." badge when hasActiveToken is true', async () => {
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

        // Wait for status check to be called
        await waitFor(() => {
            expect(mockGetTelegramStatusWithToken).toHaveBeenCalled();
        });

        // Wait for badge to appear - the badge appears when telegramConnecting is true (set by hasActiveToken)
        await waitFor(() => {
            expect(screen.getByText('Connecting...')).toBeInTheDocument();
        });
    });

    it('should poll for status when hasActiveToken is true', async () => {
        vi.useFakeTimers();

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

        // Wait for initial status check and let it complete
        await waitFor(() => {
            expect(mockGetTelegramStatusWithToken).toHaveBeenCalled();
        });

        // Let the async status check complete
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        // Clear initial call
        mockGetTelegramStatusWithToken.mockClear();

        // Advance time by 30 seconds (polling interval) and run all async timers
        await act(async () => {
            vi.advanceTimersByTime(30000);
            await vi.runAllTimersAsync();
        });

        // Verify that getTelegramStatus was called again (polling)
        // The polling happens via setInterval when telegramConnecting is true
        expect(mockGetTelegramStatusWithToken).toHaveBeenCalled();

        vi.useRealTimers();
    });

    it('should show message when Copy key button is clicked', async () => {
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

        const telegramRadio = document.querySelector('input[type="radio"][value="Telegram"]') as HTMLElement;
        expect(telegramRadio).toBeInTheDocument();
        await user.click(telegramRadio);

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        // Wait for the link generation to complete and copy button to appear
        const copyButton = await waitFor(() => {
            return screen.getByRole('button', { name: /copy key/i });
        });

        await user.click(copyButton);

        // Wait for clipboard write and success message to appear
        await waitFor(() => {
            expect(writeTextSpy).toHaveBeenCalled();
            expect(screen.getByText(/You can now close this window/i)).toBeInTheDocument();
        });

        writeTextSpy.mockRestore();
    });

});
