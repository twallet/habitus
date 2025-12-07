// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Navigation } from '../Navigation';

describe('Navigation', () => {
    const renderNavigation = (initialRoute = '/') => {
        return render(
            <MemoryRouter initialEntries={[initialRoute]}>
                <Navigation runningTrackingsCount={0} pendingRemindersCount={0} />
            </MemoryRouter>
        );
    };

    it('should render both navigation links', () => {
        renderNavigation();

        expect(screen.getByRole('link', { name: /trackings/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /reminders/i })).toBeInTheDocument();
    });

    it('should highlight active link for trackings', () => {
        renderNavigation('/');

        const trackingsLink = screen.getByRole('link', { name: /trackings/i });
        const remindersLink = screen.getByRole('link', { name: /reminders/i });

        expect(trackingsLink).toHaveClass('active');
        expect(remindersLink).not.toHaveClass('active');
    });

    it('should highlight active link for reminders', () => {
        renderNavigation('/reminders');

        const trackingsLink = screen.getByRole('link', { name: /trackings/i });
        const remindersLink = screen.getByRole('link', { name: /reminders/i });

        expect(remindersLink).toHaveClass('active');
        expect(trackingsLink).not.toHaveClass('active');
    });

    it('should show running trackings count badge', () => {
        render(
            <MemoryRouter>
                <Navigation runningTrackingsCount={3} pendingRemindersCount={0} />
            </MemoryRouter>
        );

        const badge = screen.getByLabelText('3 running trackings');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('3');
    });

    it('should show pending reminders count badge', () => {
        render(
            <MemoryRouter>
                <Navigation runningTrackingsCount={0} pendingRemindersCount={5} />
            </MemoryRouter>
        );

        const badge = screen.getByLabelText('5 pending reminders');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('5');
    });

    it('should not show badges when counts are zero', () => {
        renderNavigation();

        expect(screen.queryByLabelText(/running trackings/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/pending reminders/i)).not.toBeInTheDocument();
    });
});
