import { useAuth } from '../hooks/useAuth';
// Profile is currently handled via Modals in MainLayout, but we can expose a dedicated page if needed.
// For now, this could be a simple status page or redirect.

export function ProfilePage() {
    const { user } = useAuth();

    if (!user) return null;

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <h1>My Profile</h1>
            <div className="card">
                <p><strong>Name:</strong> {user.name}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p className="text-muted">Profile editing is currently handled via the User Menu.</p>
            </div>
        </div>
    );
}
