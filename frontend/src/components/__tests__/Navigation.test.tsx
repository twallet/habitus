import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navigation, View } from '../Navigation';

describe('Navigation', () => {
    const mockOnViewChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render both navigation buttons', () => {
        render(<Navigation currentView="profile" onViewChange={mockOnViewChange} />);

        expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /trackings/i })).toBeInTheDocument();
    });

    it('should highlight active view for profile', () => {
        render(<Navigation currentView="profile" onViewChange={mockOnViewChange} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        const trackingsButton = screen.getByRole('button', { name: /trackings/i });

        expect(profileButton).toHaveClass('active');
        expect(trackingsButton).not.toHaveClass('active');
    });

    it('should highlight active view for trackings', () => {
        render(<Navigation currentView="trackings" onViewChange={mockOnViewChange} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        const trackingsButton = screen.getByRole('button', { name: /trackings/i });

        expect(trackingsButton).toHaveClass('active');
        expect(profileButton).not.toHaveClass('active');
    });

    it('should call onViewChange when profile button is clicked', async () => {
        const user = userEvent.setup();
        render(<Navigation currentView="trackings" onViewChange={mockOnViewChange} />);

        const profileButton = screen.getByRole('button', { name: /profile/i });
        await user.click(profileButton);

        expect(mockOnViewChange).toHaveBeenCalledWith('profile');
        expect(mockOnViewChange).toHaveBeenCalledTimes(1);
    });

    it('should call onViewChange when trackings button is clicked', async () => {
        const user = userEvent.setup();
        render(<Navigation currentView="profile" onViewChange={mockOnViewChange} />);

        const trackingsButton = screen.getByRole('button', { name: /trackings/i });
        await user.click(trackingsButton);

        expect(mockOnViewChange).toHaveBeenCalledWith('trackings');
        expect(mockOnViewChange).toHaveBeenCalledTimes(1);
    });

    it('should have correct button types', () => {
        render(<Navigation currentView="profile" onViewChange={mockOnViewChange} />);

        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
            expect(button).toHaveAttribute('type', 'button');
        });
    });
});

