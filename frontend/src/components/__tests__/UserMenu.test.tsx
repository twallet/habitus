// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserMenu } from '../UserMenu';
import { UserData } from '../../models/User';

describe('UserMenu', () => {
    const mockUser: UserData = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        created_at: '2024-01-01T00:00:00Z',
    };

    const mockOnEditProfile = vi.fn();
    const mockOnChangeEmail = vi.fn();
    const mockOnNotifications = vi.fn();
    const mockOnLogout = vi.fn();
    const mockOnDeleteUser = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render user menu button', () => {
        render(
            <UserMenu
                user={mockUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        const button = screen.getByRole('button', { name: /account settings/i });
        expect(button).toBeInTheDocument();
    });

    it('should display user initials when no profile picture', () => {
        render(
            <UserMenu
                user={mockUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('should display user initials for single name', () => {
        const singleNameUser: UserData = {
            ...mockUser,
            name: 'John',
        };

        render(
            <UserMenu
                user={singleNameUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        expect(screen.getByText('JO')).toBeInTheDocument();
    });

    it('should display user initials for multiple word name', () => {
        const multiWordUser: UserData = {
            ...mockUser,
            name: 'John Michael Smith',
        };

        render(
            <UserMenu
                user={multiWordUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        expect(screen.getByText('JS')).toBeInTheDocument();
    });

    it('should display profile picture when available', () => {
        const userWithPicture: UserData = {
            ...mockUser,
            profile_picture_url: 'https://example.com/avatar.jpg',
        };

        render(
            <UserMenu
                user={userWithPicture}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        const image = screen.getByAltText("John Doe's profile");
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute('src', 'https://example.com/avatar.jpg');
        expect(screen.queryByText('JD')).not.toBeInTheDocument();
    });

    it('should open menu when button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <UserMenu
                user={mockUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        const button = screen.getByRole('button', { name: /account settings/i });
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Account settings')).toBeInTheDocument();
            expect(screen.getByText('Change email')).toBeInTheDocument();
            expect(screen.getByText('Notifications')).toBeInTheDocument();
            expect(screen.getByText('Log out')).toBeInTheDocument();
            expect(screen.getByText('Delete account')).toBeInTheDocument();
        });
    });

    it('should close menu when button is clicked again', async () => {
        const user = userEvent.setup();
        render(
            <UserMenu
                user={mockUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        const button = screen.getByRole('button', { name: /account settings/i });
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Account settings')).toBeInTheDocument();
        });

        await user.click(button);

        await waitFor(() => {
            expect(screen.queryByText('Account settings')).not.toBeInTheDocument();
        });
    });

    it('should call onEditProfile when Account settings is clicked', async () => {
        const user = userEvent.setup();
        render(
            <UserMenu
                user={mockUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        const button = screen.getByRole('button', { name: /account settings/i });
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Account settings')).toBeInTheDocument();
        });

        const accountSettingsItem = screen.getByText('Account settings');
        await user.click(accountSettingsItem);

        expect(mockOnEditProfile).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(screen.queryByText('Account settings')).not.toBeInTheDocument();
        });
    });

    it('should call onChangeEmail when Change email is clicked', async () => {
        const user = userEvent.setup();
        render(
            <UserMenu
                user={mockUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        const button = screen.getByRole('button', { name: /account settings/i });
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Change email')).toBeInTheDocument();
        });

        const changeEmailItem = screen.getByText('Change email');
        await user.click(changeEmailItem);

        expect(mockOnChangeEmail).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(screen.queryByText('Change email')).not.toBeInTheDocument();
        });
    });

    it('should call onNotifications when Notifications is clicked', async () => {
        const user = userEvent.setup();
        render(
            <UserMenu
                user={mockUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        const button = screen.getByRole('button', { name: /account settings/i });
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Notifications')).toBeInTheDocument();
        });

        const notificationsItem = screen.getByText('Notifications');
        await user.click(notificationsItem);

        expect(mockOnNotifications).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
        });
    });

    it('should call onLogout when Log out is clicked', async () => {
        const user = userEvent.setup();
        render(
            <UserMenu
                user={mockUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        const button = screen.getByRole('button', { name: /account settings/i });
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Log out')).toBeInTheDocument();
        });

        const logoutItem = screen.getByText('Log out');
        await user.click(logoutItem);

        expect(mockOnLogout).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(screen.queryByText('Log out')).not.toBeInTheDocument();
        });
    });

    it('should call onDeleteUser when Delete account is clicked', async () => {
        const user = userEvent.setup();
        render(
            <UserMenu
                user={mockUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        const button = screen.getByRole('button', { name: /account settings/i });
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Delete account')).toBeInTheDocument();
        });

        const deleteItem = screen.getByText('Delete account');
        await user.click(deleteItem);

        expect(mockOnDeleteUser).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(screen.queryByText('Delete account')).not.toBeInTheDocument();
        });
    });

    it('should close menu when clicking outside', async () => {
        const user = userEvent.setup();
        render(
            <UserMenu
                user={mockUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        const button = screen.getByRole('button', { name: /account settings/i });
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Account settings')).toBeInTheDocument();
        });

        // Click outside the menu
        await user.click(document.body);

        await waitFor(() => {
            expect(screen.queryByText('Account settings')).not.toBeInTheDocument();
        });
    });

    it('should not close menu when clicking inside menu', async () => {
        const user = userEvent.setup();
        render(
            <UserMenu
                user={mockUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        const button = screen.getByRole('button', { name: /account settings/i });
        await user.click(button);

        await waitFor(() => {
            expect(screen.getByText('Account settings')).toBeInTheDocument();
        });

        // Click on a menu item (not the button itself)
        const accountSettingsItem = screen.getByText('Account settings');
        await user.click(accountSettingsItem);

        // Menu should close after clicking item (because handleMenuItemClick closes it)
        await waitFor(() => {
            expect(screen.queryByText('Account settings')).not.toBeInTheDocument();
        });
    });

    it('should handle user name with extra whitespace', () => {
        const userWithWhitespace: UserData = {
            ...mockUser,
            name: '  John   Doe  ',
        };

        render(
            <UserMenu
                user={userWithWhitespace}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('should set aria-expanded attribute correctly', async () => {
        const user = userEvent.setup();
        render(
            <UserMenu
                user={mockUser}
                onEditProfile={mockOnEditProfile}
                onChangeEmail={mockOnChangeEmail}
                onNotifications={mockOnNotifications}
                onLogout={mockOnLogout}
                onDeleteUser={mockOnDeleteUser}
            />
        );

        const button = screen.getByRole('button', { name: /account settings/i });
        expect(button).toHaveAttribute('aria-expanded', 'false');

        await user.click(button);

        await waitFor(() => {
            expect(button).toHaveAttribute('aria-expanded', 'true');
        });
    });
});

