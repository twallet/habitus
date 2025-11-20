import { useState, FormEvent, useEffect } from 'react';
import { UserData } from '../models/User';
import { User } from '../models/User';
import './EditProfileModal.css';

interface EditProfileModalProps {
    user: UserData;
    onClose: () => void;
    onSave: (
        name: string,
        nickname: string | undefined,
        email: string,
        profilePicture: File | null
    ) => Promise<void>;
}

/**
 * Modal component for editing user profile.
 * Allows editing name, nickname, email, and profile picture.
 * @param props - Component props
 * @param props.user - The current user's data
 * @param props.onClose - Callback when modal is closed
 * @param props.onSave - Callback when profile is saved
 * @public
 */
export function EditProfileModal({
    user,
    onClose,
    onSave,
}: EditProfileModalProps) {
    const [name, setName] = useState(user.name);
    const [nickname, setNickname] = useState(user.nickname || '');
    const [email, setEmail] = useState(user.email);
    const [profilePicture, setProfilePicture] = useState<File | null>(null);
    const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(
        user.profile_picture_url || null
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Handle profile picture file selection.
     * @param e - File input change event
     * @internal
     */
    const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file');
                return;
            }

            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError('Image size must be less than 5MB');
                return;
            }

            setProfilePicture(file);
            setError(null);

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePicturePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setProfilePicture(null);
        }
    };

    /**
     * Remove profile picture.
     * @internal
     */
    const handleRemovePicture = () => {
        setProfilePicture(null);
        setProfilePicturePreview(null);
        const fileInput = document.getElementById('edit-profile-picture') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    /**
     * Handle form submission.
     * @param e - Form submission event
     * @internal
     */
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Validate name
            const validatedName = User.validateName(name.trim());
            const validatedNickname = User.validateNickname(nickname.trim() || undefined);

            // Basic email validation
            if (!email.trim()) {
                setError('Email is required');
                setIsSubmitting(false);
                return;
            }

            await onSave(
                validatedName,
                validatedNickname,
                email.trim(),
                profilePicture
            );
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error updating profile');
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Handle escape key to close modal.
     * @internal
     */
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edit Profile</h2>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="edit-profile-form">
                    {error && (
                        <div className="message error show">
                            <span className="message-text">{error}</span>
                            <button
                                type="button"
                                className="message-close"
                                onClick={() => setError(null)}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="edit-name">Name *</label>
                        <input
                            type="text"
                            id="edit-name"
                            name="name"
                            placeholder="Enter your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            disabled={isSubmitting}
                            maxLength={User.MAX_NAME_LENGTH}
                        />
                        <span className="char-count">
                            {name.length}/{User.MAX_NAME_LENGTH}
                        </span>
                    </div>

                    <div className="form-group">
                        <label htmlFor="edit-nickname">Nickname (Optional)</label>
                        <input
                            type="text"
                            id="edit-nickname"
                            name="nickname"
                            placeholder="Enter a nickname"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            disabled={isSubmitting}
                            maxLength={User.MAX_NICKNAME_LENGTH}
                        />
                        <span className="char-count">
                            {nickname.length}/{User.MAX_NICKNAME_LENGTH}
                        </span>
                    </div>

                    <div className="form-group">
                        <label htmlFor="edit-email">Email *</label>
                        <input
                            type="email"
                            id="edit-email"
                            name="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="edit-profile-picture">Profile Picture (Optional)</label>
                        <input
                            type="file"
                            id="edit-profile-picture"
                            name="profilePicture"
                            accept="image/*"
                            onChange={handleProfilePictureChange}
                            disabled={isSubmitting}
                        />
                        {profilePicturePreview && (
                            <div className="profile-picture-preview">
                                <img
                                    src={profilePicturePreview}
                                    alt="Profile preview"
                                    className="preview-image"
                                />
                                <button
                                    type="button"
                                    onClick={handleRemovePicture}
                                    className="remove-image-btn"
                                    disabled={isSubmitting}
                                >
                                    Remove
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

