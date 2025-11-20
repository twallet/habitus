import { useState, FormEvent } from "react";

interface AuthFormProps {
  onRequestLoginMagicLink: (email: string) => Promise<void>;
  onRequestRegisterMagicLink: (
    name: string,
    email: string,
    nickname?: string,
    profilePicture?: File
  ) => Promise<void>;
  onError: (message: string) => void;
}

/**
 * Form component for user authentication (passwordless with magic links).
 * Toggles between login and register modes.
 * @param props - Component props
 * @param props.onRequestLoginMagicLink - Callback for requesting login magic link
 * @param props.onRequestRegisterMagicLink - Callback for requesting registration magic link
 * @param props.onError - Callback function called when validation fails or error occurs
 * @public
 */
export function AuthForm({
  onRequestLoginMagicLink,
  onRequestRegisterMagicLink,
  onError,
}: AuthFormProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  /**
   * Handle form submission.
   * Validates inputs and calls appropriate callback based on mode.
   * @param e - Form submission event
   * @internal
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMagicLinkSent(false);

    try {
      // Basic validation
      if (!email.trim()) {
        onError("Email is required");
        setIsSubmitting(false);
        return;
      }

      if (isLoginMode) {
        // Magic link login
        await onRequestLoginMagicLink(email.trim());
        setMagicLinkSent(true);
      } else {
        // Register mode validation
        if (!name.trim()) {
          onError("Name is required");
          setIsSubmitting(false);
          return;
        }

        await onRequestRegisterMagicLink(
          name.trim(),
          email.trim(),
          nickname.trim() || undefined,
          profilePicture || undefined
        );
        setMagicLinkSent(true);
      }

      // Reset form on success (but keep email for magic link sent message)
      if (!magicLinkSent) {
        setName("");
        setNickname("");
        setProfilePicture(null);
        setProfilePicturePreview(null);
      }
    } catch (error) {
      // Error handling is done in parent component via onError
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Toggle between login and register modes.
   * @internal
   */
  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setMagicLinkSent(false);
    setName("");
    setNickname("");
    setEmail("");
    setProfilePicture(null);
    setProfilePicturePreview(null);
  };

  /**
   * Handle profile picture file selection.
   * @param e - File input change event
   * @internal
   */
  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        onError("Please select an image file");
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        onError("Image size must be less than 5MB");
        return;
      }

      setProfilePicture(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setProfilePicture(null);
      setProfilePicturePreview(null);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="auth-form-container">
        <div className="magic-link-sent">
          <h2>Check your email!</h2>
          <p>
            We've sent a magic link to <strong>{email}</strong>
          </p>
          <p>Click the link in the email to {isLoginMode ? "log in" : "complete your registration"}.</p>
          <p className="magic-link-help">
            The link will expire in 15 minutes. If you don't see the email, check your spam folder.
          </p>
          <button
            type="button"
            onClick={() => {
              setMagicLinkSent(false);
              setEmail("");
            }}
            className="btn-primary"
          >
            Send another link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-form-container">
      <div className="auth-form-header">
        <h2>{isLoginMode ? "Login" : "Register"}</h2>
        <button
          type="button"
          onClick={toggleMode}
          className="btn-link"
          disabled={isSubmitting}
        >
          {isLoginMode
            ? "Don't have an account? Register"
            : "Already have an account? Login"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {!isLoginMode && (
          <>
            <div className="form-group">
              <label htmlFor="name">Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                disabled={isSubmitting}
                maxLength={30}
              />
            </div>

            <div className="form-group">
              <label htmlFor="nickname">Nickname (Optional)</label>
              <input
                type="text"
                id="nickname"
                name="nickname"
                placeholder="Enter a nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="nickname"
                disabled={isSubmitting}
                maxLength={30}
              />
            </div>

            <div className="form-group">
              <label htmlFor="profilePicture">Profile Picture (Optional)</label>
              <input
                type="file"
                id="profilePicture"
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
                    onClick={() => {
                      setProfilePicture(null);
                      setProfilePicturePreview(null);
                      const fileInput = document.getElementById("profilePicture") as HTMLInputElement;
                      if (fileInput) fileInput.value = "";
                    }}
                    className="remove-image-btn"
                    disabled={isSubmitting}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <div className="form-group">
          <label htmlFor="email">Email *</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Processing..."
            : isLoginMode
              ? "Send Magic Link"
              : "Send Registration Link"}
        </button>
      </form>
    </div>
  );
}
