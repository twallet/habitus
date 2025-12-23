import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Lazy load layout components
const AuthLayout = lazy(() => import('./components/layouts/AuthLayout').then(m => ({ default: m.AuthLayout })));
const MainLayout = lazy(() => import('./components/layouts/MainLayout').then(m => ({ default: m.MainLayout })));

// Lazy load page components
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const VerifyMagicLinkPage = lazy(() => import('./pages/VerifyMagicLinkPage').then(m => ({ default: m.VerifyMagicLinkPage })));
const TrackingsPage = lazy(() => import('./pages/TrackingsPage').then(m => ({ default: m.TrackingsPage })));
const RemindersPage = lazy(() => import('./pages/RemindersPage').then(m => ({ default: m.RemindersPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));

/**
 * Defines the application route structure with lazy-loaded components.
 * Components are loaded on-demand to improve initial load performance.
 */
export function AppRoutes() {
    return (
        <Suspense fallback={<div className="container"><div className="loading">Loading...</div></div>}>
            <Routes>
                {/* Public Routes (Login/Register) */}
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<Navigate to="/login" replace />} />
                </Route>

                {/* Magic Link Verification - Public route that authenticates user */}
                <Route path="/auth/verify-magic-link" element={<VerifyMagicLinkPage />} />

                {/* Protected Routes (Main App) */}
                <Route element={<MainLayout />}>
                    <Route path="/" element={<Navigate to="/trackings" replace />} />
                    <Route path="/trackings" element={<TrackingsPage />} />
                    <Route path="/reminders" element={<RemindersPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                </Route>

                {/* Catch all - redirect to trackings */}
                <Route path="*" element={<Navigate to="/trackings" replace />} />
            </Routes>
        </Suspense>
    );
}
