// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App, { TitleUpdater } from '../App';

describe('App', () => {
    it('should render App component with BrowserRouter', () => {
        render(<App />);

        // App should render without errors
        expect(document.body).toBeTruthy();
    });
});

describe('TitleUpdater', () => {
    const originalTitle = document.title;
    let originalDevValue: boolean | undefined;

    beforeEach(() => {
        document.title = '';
        vi.clearAllMocks();
        // Store original DEV value
        originalDevValue = (globalThis as any).import?.meta?.env?.DEV;
    });

    afterEach(() => {
        document.title = originalTitle;
        // Restore original DEV value
        const env = (globalThis as any).import?.meta?.env;
        if (env && originalDevValue !== undefined) {
            env.DEV = originalDevValue;
        }
    });

    it('should set title to "Habitus [DEV]" in development environment on non-admin page', () => {
        // Mock DEV environment via globalThis (since import.meta.env is replaced at build time)
        const env = (globalThis as any).import?.meta?.env;
        if (env) {
            env.DEV = true;
        }

        const { unmount } = render(
            <MemoryRouter initialEntries={['/trackings']}>
                <TitleUpdater />
            </MemoryRouter>
        );

        expect(document.title).toBe('Habitus [DEV]');
        unmount();
    });

    it('should set title to "Habitus [DEV-ADMIN]" in development environment on admin page', () => {
        // Mock DEV environment
        const env = (globalThis as any).import?.meta?.env;
        if (env) {
            env.DEV = true;
        }

        const { unmount } = render(
            <MemoryRouter initialEntries={['/admin']}>
                <TitleUpdater />
            </MemoryRouter>
        );

        expect(document.title).toBe('Habitus [DEV-ADMIN]');
        unmount();
    });

    it('should set title to "Habitus" in production environment on non-admin page', () => {
        // Mock PROD environment
        const env = (globalThis as any).import?.meta?.env;
        if (env) {
            env.DEV = false;
        }

        const { unmount } = render(
            <MemoryRouter initialEntries={['/trackings']}>
                <TitleUpdater />
            </MemoryRouter>
        );

        expect(document.title).toBe('Habitus');
        unmount();
    });

    it('should set title to "Habitus [PROD-ADMIN]" in production environment on admin page', () => {
        // Mock PROD environment
        const env = (globalThis as any).import?.meta?.env;
        if (env) {
            env.DEV = false;
        }

        const { unmount } = render(
            <MemoryRouter initialEntries={['/admin']}>
                <TitleUpdater />
            </MemoryRouter>
        );

        expect(document.title).toBe('Habitus [PROD-ADMIN]');
        unmount();
    });

    it('should handle different routes correctly', () => {
        // Mock DEV environment
        const env = (globalThis as any).import?.meta?.env;
        if (env) {
            env.DEV = true;
        }

        const routes = ['/trackings', '/reminders', '/profile'];

        routes.forEach((route) => {
            const { unmount } = render(
                <MemoryRouter initialEntries={[route]}>
                    <TitleUpdater />
                </MemoryRouter>
            );

            expect(document.title).toBe('Habitus [DEV]');
            unmount();
        });
    });
});

