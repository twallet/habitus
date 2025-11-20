import { useState, FormEvent } from "react";

interface AuthFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (name: string, email: string, password: string, profilePicture?: File) => Promise<void>;
  onGoogleLogin: () => void;
  onError: (message: string) => void;
}

/**
 * Form component for user authentication (login/register).
 * Toggles between login and register modes.
 * @param props - Component props
 * @param props.onLogin - Callback function called when login form is submitted
 * @param props.onRegister - Callback function called when register form is submitted
 * @param props.onError - Callback function called when validation fails or error occurs
 * @public
 */
export function AuthForm({ onLogin, onRegister, onGoogleLogin, onError }: AuthFormProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle form submission.
   * Validates inputs and calls appropriate callback based on mode.
   * @param e - Form submission event
   * @internal
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Basic validation
      if (!email.trim()) {
        onError("Email is required");
        setIsSubmitting(false);
        return;
      }

      if (!password.trim()) {
        onError("Password is required");
        setIsSubmitting(false);
        return;
      }

      if (isLoginMode) {
        await onLogin(email.trim(), password);
      } else {
        // Register mode validation
        if (!name.trim()) {
          onError("Name is required");
          setIsSubmitting(false);
          return;
        }

        if (password !== confirmPassword) {
          onError("Passwords do not match");
          setIsSubmitting(false);
          return;
        }

        if (password.length < 8) {
          onError("Password must be at least 8 characters long");
          setIsSubmitting(false);
          return;
        }

        await onRegister(name.trim(), email.trim(), password, profilePicture || undefined);
      }

      // Reset form on success
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setProfilePicture(null);
      setProfilePicturePreview(null);
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
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
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
          <div className="form-group">
            <label htmlFor="name">Name</label>
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
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email</label>
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

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isLoginMode ? "current-password" : "new-password"}
            disabled={isSubmitting}
          />
        </div>

        {!isLoginMode && (
          <>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={isSubmitting}
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

        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Processing..."
            : isLoginMode
            ? "Login"
            : "Register"}
        </button>
      </form>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <button
        type="button"
        onClick={onGoogleLogin}
        className="btn-google"
        disabled={isSubmitting}
      >
        <svg
          className="google-icon"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g fill="#000" fillRule="evenodd">
            <path
              d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"
              fill="#EA4335"
            />
            <path
              d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.21 1.18-.84 2.18-1.79 2.91l2.84 2.2c1.7-1.57 2.68-3.88 2.63-6.61z"
              fill="#4285F4"
            />
            <path
              d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"
              fill="#FBBC05"
            />
            <path
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.96 13.04C2.45 15.98 5.48 18 9 18z"
              fill="#34A853"
            />
          </g>
        </svg>
        Continue with Google
      </button>
      <p className="google-help-text">
        {isLoginMode
          ? "Sign in or create an account with Google"
          : "Register or sign in with Google"}
      </p>
    </div>
  );
}

