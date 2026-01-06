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
        // Use a user with Telegram already connected to test channel switching
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

        // Wait for initial status check
        await waitFor(() => {
            expect(mockGetTelegramStatusConnected).toHaveBeenCalled();
        });

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        // When Telegram is connected, clicking it should select it
        await waitFor(() => {
            expect(telegramRadio).toBeChecked();
        });
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

    it('should show Telegram connection modal when Telegram is selected', async () => {
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

        // Wait for the connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        // Wait for link generation to complete and buttons to appear
        await waitFor(() => {
            expect(mockGetTelegramStartLink).toHaveBeenCalledTimes(1);
            const copyButton = screen.getByRole('button', { name: /copy key/i });
            expect(copyButton).toBeInTheDocument();
            const goButton = screen.getByRole('button', { name: /go to chat/i });
            expect(goButton).toBeInTheDocument();
        });
    });

    it('should show Telegram connection modal with bot link after selecting Telegram', async () => {
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

        // Wait for the connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        // Wait for link generation and verify Go to chat button appears
        await waitFor(() => {
            const goButton = screen.getByRole('button', { name: /go to chat/i });
            expect(goButton).toBeInTheDocument();
            // Users copy the key first, then go to chat
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

    it('should open connection modal when Telegram is clicked but not connected', async () => {
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

        // Wait for connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        // Wait for link generation to complete
        await waitFor(() => {
            const copyButton = screen.getByRole('button', { name: /copy key/i });
            expect(copyButton).toBeInTheDocument();
        });

        // Email should remain selected (Telegram not connected yet)
        const emailRadio = screen.getByRole('radio', { name: /email/i });
        expect(emailRadio).toBeChecked();
        // Should NOT show connecting badge
        expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
    });

    it('should NOT show cancel button in Telegram connection steps view', async () => {
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

        // Wait for connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
        });

        // Cancel button should NOT exist in the steps view (only appears in waiting view)
        const cancelButtons = screen.queryAllByRole('button', { name: /cancel connection/i });
        expect(cancelButtons).toHaveLength(0);
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
        const mockGetTelegramStatusConnected = vi.fn().mockResolvedValue({
            connected: true,
            telegramChatId: '123456789',
            telegramUsername: 'testuser',
            hasActiveToken: false
        });

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
                onGetTelegramStatus={mockGetTelegramStatusConnected}
                user={userWithPreferences}
            />
        );

        // Wait for preferences to load and Telegram radio to be checked
        await waitFor(() => {
            const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
            expect(telegramRadio).toBeChecked();
        });
    });

    it('should show 2-step connection modal when Telegram is selected but not connected', async () => {
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

        // Wait for connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        // Wait for link generation to complete
        await waitFor(() => {
            // Step 1: Copy key button
            const copyButton = screen.getByRole('button', { name: /copy key/i });
            expect(copyButton).toBeInTheDocument();

            // Step 2: Go to chat button (should be disabled initially)
            const goButton = screen.getByRole('button', { name: /go to chat/i });
            expect(goButton).toBeInTheDocument();
            expect(goButton).toBeDisabled();
        });

        // Should NOT show "Preparing connection..." or "Waiting for connection..."
        expect(screen.queryByText('Preparing connection...')).not.toBeInTheDocument();
        expect(screen.queryByText(/Waiting for you to paste the key/i)).not.toBeInTheDocument();

        // When Telegram is not connected, Email should remain selected (Telegram is not actually selected until connected)
        const emailRadio = screen.getByRole('radio', { name: /email/i });
        expect(emailRadio).toBeChecked();
        expect(telegramRadio).not.toBeChecked();
    });

    it('should show connection modal when Telegram is selected (connection happens via webhook)', async () => {
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

        // Wait for connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
        });

        // Connection modal should remain visible
        // Connection will happen via webhook when user sends /start command in Telegram
        expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
    });

    it('should save automatically when switching to Email channel', async () => {
        const user = userEvent.setup();
        // Use a user with Telegram connected to test switching from Telegram to Email
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

        // Wait for initial status check to complete
        await waitFor(() => {
            expect(mockGetTelegramStatusConnected).toHaveBeenCalled();
        });

        // Wait for Telegram to be selected
        await waitFor(() => {
            const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
            expect(telegramRadio).toBeChecked();
        });

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

        // Use a user with Telegram connected to test switching from Telegram to Email with error
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
                onSave={mockOnSaveWithError}
                onGetTelegramStartLink={mockGetTelegramStartLink}
                onGetTelegramStatus={mockGetTelegramStatusConnected}
                user={userWithTelegram}
            />
        );

        // Wait for initial status check to complete
        await waitFor(() => {
            expect(mockGetTelegramStatusConnected).toHaveBeenCalled();
        });

        // Wait for Telegram to be selected
        await waitFor(() => {
            const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
            expect(telegramRadio).toBeChecked();
        });

        // Switch to Email to trigger save with error
        const emailRadio = screen.getByRole('radio', { name: /email/i });
        await user.click(emailRadio);

        // After switching, Email should be saved, which will trigger the error
        await waitFor(() => {
            expect(screen.getByText(errorMessage)).toBeInTheDocument();
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

    it('should show title "Connect your Telegram account" in connection modal', async () => {
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
            // Should show the title in the connection modal
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

        // Wait for connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

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

        // Wait for connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        await waitFor(() => {
            const copyButton = screen.getByRole('button', { name: /copy key/i });
            expect(copyButton).toBeInTheDocument();
        });

        // Verify step 2 is disabled initially
        const goButton = screen.getByRole('button', { name: /go to chat/i });
        expect(goButton).toBeDisabled();

        const copyButton = screen.getByRole('button', { name: /copy key/i });
        await user.click(copyButton);

        await waitFor(() => {
            expect(writeTextSpy).toHaveBeenCalledWith('/start token123 1');
            // Verify step 2 becomes enabled after copying
            expect(goButton).not.toBeDisabled();
        });

        writeTextSpy.mockRestore();
    });


    it('should select Email when hasActiveToken is true but not connected', async () => {
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

        // Email should be selected (Telegram not connected)
        await waitFor(() => {
            const emailRadio = screen.getByRole('radio', { name: /email/i });
            expect(emailRadio).toBeChecked();
            // Should NOT show connecting badge
            expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
            // Should show "No account connected" badge for Telegram
            expect(screen.getByText('No account connected')).toBeInTheDocument();
        });
    });

    it('should enable Go to chat button when Copy key button is clicked', async () => {
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

        // Wait for the connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        // Wait for the link generation to complete and copy button to appear
        const copyButton = await waitFor(() => {
            return screen.getByRole('button', { name: /copy key/i });
        });

        // Verify Go to chat button is disabled initially
        const goButton = screen.getByRole('button', { name: /go to chat/i });
        expect(goButton).toBeDisabled();

        await user.click(copyButton);

        // Wait for clipboard write to be called
        await waitFor(() => {
            expect(writeTextSpy).toHaveBeenCalled();
        });

        // Verify Go to chat button becomes enabled after copying
        await waitFor(() => {
            expect(goButton).not.toBeDisabled();
        });

        writeTextSpy.mockRestore();
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        // Wait for connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
        });

        // Click copy key to enable step 2
        const copyButton = screen.getByRole('button', { name: /copy key/i });
        await user.click(copyButton);

        // Click Go to chat button
        const goButton = screen.getByRole('button', { name: /go to chat/i });
        await user.click(goButton);

        // Verify waiting view appears
        await waitFor(() => {
            expect(screen.getByText(/Waiting for you to paste the key/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /cancel connection/i })).toBeInTheDocument();
        });
    });

    it('should call cancel handler when Cancel Connection button is clicked', async () => {
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        // Wait for connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
        });

        // Navigate to waiting view
        await user.click(screen.getByRole('button', { name: /copy key/i }));
        await user.click(screen.getByRole('button', { name: /go to chat/i }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /cancel connection/i })).toBeInTheDocument();
        });

        // Click Cancel Connection
        const cancelButton = screen.getByRole('button', { name: /cancel connection/i });
        await user.click(cancelButton);

        // Verify cancel handler was called and modal closed
        await waitFor(() => {
            expect(mockCancelTelegramConnection).toHaveBeenCalled();
            // Connection modal should close (not the main NotificationsModal)
            expect(screen.queryByText(/Waiting for you to paste the key/i)).not.toBeInTheDocument();
        });
    });

    it('should show confirmation dialog when closing modal in waiting state', async () => {
        const user = userEvent.setup();
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        // Wait for connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
        });

        // Navigate to waiting view
        await user.click(screen.getByRole('button', { name: /copy key/i }));
        await user.click(screen.getByRole('button', { name: /go to chat/i }));

        await waitFor(() => {
            expect(screen.getByText(/Waiting for you to paste the key/i)).toBeInTheDocument();
        });

        // Click close button (X) in the TelegramConnectionStepsModal (the second one)
        const closeButtons = screen.getAllByRole('button', { name: /close/i });
        const telegramModalCloseButton = closeButtons[closeButtons.length - 1]; // Get the last close button (inner modal)
        await user.click(telegramModalCloseButton);

        // Verify confirmation dialog was shown
        expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to close? Your Telegram connection is not complete yet.');
        // Modal should stay open because we returned false
        expect(mockOnClose).not.toHaveBeenCalled();

        confirmSpy.mockRestore();
    });

    it('should close modal when user confirms cancellation in waiting state', async () => {
        const user = userEvent.setup();
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
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

        const telegramRadio = screen.getByRole('radio', { name: /telegram/i });
        await user.click(telegramRadio);

        // Wait for connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
        });

        // Navigate to waiting view
        await user.click(screen.getByRole('button', { name: /copy key/i }));
        await user.click(screen.getByRole('button', { name: /go to chat/i }));

        await waitFor(() => {
            expect(screen.getByText(/Waiting for you to paste the key/i)).toBeInTheDocument();
        });

        // Click close button (X) in the TelegramConnectionStepsModal (the second one)
        const closeButtons = screen.getAllByRole('button', { name: /close/i });
        const telegramModalCloseButton = closeButtons[closeButtons.length - 1]; // Get the last close button (inner modal)
        await user.click(telegramModalCloseButton);

        // Verify confirmation was shown and connection modal closed
        expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to close? Your Telegram connection is not complete yet.');
        await waitFor(() => {
            expect(mockCancelTelegramConnection).toHaveBeenCalled();
            // Connection modal should close (not the main NotificationsModal)
            expect(screen.queryByText(/Waiting for you to paste the key/i)).not.toBeInTheDocument();
        });

        confirmSpy.mockRestore();
    });

    it('should close connection modal immediately when clicking X in steps view (no confirmation)', async () => {
        const user = userEvent.setup();
        const confirmSpy = vi.spyOn(window, 'confirm');

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

        // Wait for connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
        });

        // Click close button in the connection modal while still in steps view
        const closeButtons = screen.getAllByRole('button', { name: /close/i });
        const telegramModalCloseButton = closeButtons[closeButtons.length - 1]; // Get the last close button (inner modal)
        await user.click(telegramModalCloseButton);

        // Verify NO confirmation dialog was shown (only shown in waiting state or after step 1 completed)
        expect(confirmSpy).not.toHaveBeenCalled();
        // Connection modal should close immediately
        await waitFor(() => {
            expect(screen.queryByText('Connect your Telegram account')).not.toBeInTheDocument();
        });

        confirmSpy.mockRestore();
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

        await user.click(screen.getByRole('radio', { name: /telegram/i }));

        // Wait for connection modal to appear
        await waitFor(() => {
            expect(screen.getByText('Connect your Telegram account')).toBeInTheDocument();
        });

        await waitFor(() => {
            const goButton = screen.getByRole('button', { name: /go to chat/i });
            expect(goButton).toBeDisabled();
        });

        const copyButton = screen.getByRole('button', { name: /copy key/i });
        await user.click(copyButton);

        await waitFor(() => {
            const goButton = screen.getByRole('button', { name: /go to chat/i });
            expect(goButton).not.toBeDisabled();
        });
    });

});
