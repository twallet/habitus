// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { UserProfile } from '../UserProfile';
import { UserData } from '../../models/User';

describe('UserProfile', () => {
    const mockUser: UserData = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        created_at: '2024-01-15T10:30:00Z',
        last_access: '2024-01-20T14:45:00Z',
    };

    it('should render user profile with all information', () => {
        render(<UserProfile user={mockUser} />);

        expect(screen.getByText('Your Profile')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should display formatted dates', () => {
        render(<UserProfile user={mockUser} />);

        const lastAccess = screen.getByText(/Last Access/i);
        expect(lastAccess).toBeInTheDocument();
        expect(lastAccess.nextElementSibling).toHaveTextContent(/\d+/);

        const memberSince = screen.getByText(/Member Since/i);
        expect(memberSince).toBeInTheDocument();
        expect(memberSince.nextElementSibling).toHaveTextContent(/\d+/);
    });

    it('should display user initials when no profile picture', () => {
        render(<UserProfile user={mockUser} />);

        const initials = screen.getByText('JD');
        expect(initials).toBeInTheDocument();
        expect(initials).toHaveClass('profile-picture-initials');
    });

    it('should display profile picture when available', () => {
        const userWithPicture: UserData = {
            ...mockUser,
            profile_picture_url: 'https://example.com/picture.jpg',
        };

        render(<UserProfile user={userWithPicture} />);

        const image = screen.getByAltText("John Doe's profile");
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute('src', 'https://example.com/picture.jpg');
        expect(image).toHaveClass('profile-picture');
    });

    it('should handle single name for initials', () => {
        const singleNameUser: UserData = {
            ...mockUser,
            name: 'John',
        };

        render(<UserProfile user={singleNameUser} />);

        const initials = screen.getByText('JO');
        expect(initials).toBeInTheDocument();
    });

    it('should handle user without last_access', () => {
        const userWithoutLastAccess: UserData = {
            ...mockUser,
            last_access: undefined,
        };

        render(<UserProfile user={userWithoutLastAccess} />);

        expect(screen.queryByText(/Last Access/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Member Since/i)).toBeInTheDocument();
    });

    it('should handle user without created_at', () => {
        const userWithoutCreatedAt: UserData = {
            ...mockUser,
            created_at: undefined,
        };

        render(<UserProfile user={userWithoutCreatedAt} />);

        expect(screen.queryByText(/Member Since/i)).not.toBeInTheDocument();
    });

    it('should handle invalid date format gracefully', () => {
        const userWithInvalidDate: UserData = {
            ...mockUser,
            last_access: 'invalid-date',
        };

        render(<UserProfile user={userWithInvalidDate} />);

        const lastAccess = screen.getByText(/Last Access/i);
        expect(lastAccess).toBeInTheDocument();
        expect(lastAccess.nextElementSibling).toHaveTextContent('invalid-date');
    });

    it('should display editable and read-only sections', () => {
        render(<UserProfile user={mockUser} />);

        expect(screen.getByText('Editable Information')).toBeInTheDocument();
        expect(screen.getByText('System Information (Read-only)')).toBeInTheDocument();
    });

    it('should handle name with multiple words for initials', () => {
        const multiWordUser: UserData = {
            ...mockUser,
            name: 'John Michael Doe',
        };

        render(<UserProfile user={multiWordUser} />);

        const initials = screen.getByText('JD');
        expect(initials).toBeInTheDocument();
    });
});

