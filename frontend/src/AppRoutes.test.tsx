import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from './components/layouts/AuthLayout';
import { MainLayout } from './components/layouts/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { TrackingsPage } from './pages/TrackingsPage';
import { RemindersPage } from './pages/RemindersPage';
import { ProfilePage } from './pages/ProfilePage';

/**
 * Test-specific version of AppRoutes without lazy loading.
 * Lazy loading causes cleanup issues in the test environment.
 * @internal
 */
export function AppRoutesTest() {
    return (
        <Routes>
            {/* Public Routes (Login/Register) */}
            <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<Navigate to="/login" replace />} />
            </Route>

            {/* Protected Routes (Main App) */}
            <Route element={<MainLayout />}>
                <Route path="/" element={<TrackingsPage />} />
                <Route path="/reminders" element={<RemindersPage />} />
                <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* Catch all - redirect to root */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
