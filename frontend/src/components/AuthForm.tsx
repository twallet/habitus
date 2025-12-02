import { useState, FormEvent, useRef } from "react";
import { User } from "../models/User";

interface AuthFormProps {
  onRequestLoginMagicLink: (
    email: string
  ) => Promise<{ message: string; cooldown?: boolean }>;
  onRequestRegisterMagicLink: (
    name: string,
    email: string,
    profilePicture?: File
  ) => Promise<void>;
  onError: (message: string) => void;
  onCooldown?: (message: string) => void;
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
  onCooldown,
}: AuthFormProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const response = await onRequestLoginMagicLink(email.trim());
        // Check if there's a cooldown - if so, show cooldown message instead of success
        if (response.cooldown && onCooldown) {
          onCooldown(response.message);
          // Don't set magicLinkSent to true - show the form so user can try again later
        } else {
          setMagicLinkSent(true);
        }
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
          profilePicture || undefined
        );
        setMagicLinkSent(true);
      }

      // Don't reset form fields - we need them to resend the magic link
    } catch (error) {
      // Error handling is done in parent component via onError
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle resending magic link.
   * Resends the magic link with the same email and form data.
   * @internal
   */
  const handleResendMagicLink = async () => {
    if (!email.trim()) {
      // If email is somehow missing, just show the form
      setMagicLinkSent(false);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLoginMode) {
        const response = await onRequestLoginMagicLink(email.trim());
        // Check if there's a cooldown - if so, show cooldown message instead of success
        if (response.cooldown && onCooldown) {
          onCooldown(response.message);
          setMagicLinkSent(false); // Don't show "email sent" message
        } else {
          setMagicLinkSent(true);
        }
      } else {
        if (!name.trim()) {
          // If name is missing, show the form
          setMagicLinkSent(false);
          setIsSubmitting(false);
          return;
        }
        await onRequestRegisterMagicLink(
          name.trim(),
          email.trim(),
          profilePicture || undefined
        );
        setMagicLinkSent(true);
      }
    } catch (error) {
      // Error handling is done in parent component via onError
      // Show the form so user can try again
      setMagicLinkSent(false);
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
          {isLoginMode ? (
            <>
              <p>
                If an account exists for <strong>{email}</strong>, a login link has been sent. Click the link in the email to log in.</p>
              <p className="magic-link-help">
                The link will expire in 15 minutes. If you don't see the email, check your spam folder. If you don't have an account, please register first.
              </p>
            </>
          ) : (
            <>
              <p>
                We've sent a registration link to <strong>{email}</strong>. Click the link in the email to complete your registration.</p>
              <p className="magic-link-help">
                The link will expire in 15 minutes. If you don't see the email, check your spam folder.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={handleResendMagicLink}
            className="btn-primary"
            disabled={isSubmitting}
            style={{ marginTop: "2rem", display: "inline-block", width: "auto" }}
          >
            {isSubmitting ? "Sending..." : "Send another link"}
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
              <div className="form-label-row">
                <label htmlFor="name">
                  Name <span className="required-asterisk">*</span>{" "}
                  <button
                    type="button"
                    className="field-help"
                    aria-label="Name help"
                    title={`Your display name (max ${User.MAX_NAME_LENGTH} characters)`}
                  >
                    ?
                  </button>
                </label>
              </div>
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
                maxLength={User.MAX_NAME_LENGTH}
              />
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="email">
                  Email <span className="required-asterisk">*</span>{" "}
                  <button
                    type="button"
                    className="field-help"
                    aria-label="Email help"
                    title="Your email address. A verification link will be sent to this address."
                  >
                    ?
                  </button>
                </label>
              </div>
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
              <div className="form-label-row">
                <label htmlFor="profilePicture">
                  Profile picture{" "}
                  <button
                    type="button"
                    className="field-help"
                    aria-label="Profile Picture help"
                    title="Upload an image file (max 5MB). JPG, PNG, or GIF formats are supported."
                  >
                    ?
                  </button>
                </label>
              </div>
              <div className="file-input-wrapper">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="profilePicture"
                  name="profilePicture"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  disabled={isSubmitting}
                  className="file-input-hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="file-input-button"
                >
                  Choose File
                </button>
                <span className="file-input-text">
                  {profilePicture ? profilePicture.name : "No file chosen"}
                </span>
              </div>
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
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
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

        {isLoginMode && (
          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="email">
                Email <span className="required-asterisk">*</span>{" "}
                <button
                  type="button"
                  className="field-help"
                  aria-label="Email help"
                  title="Enter your email address. A login link will be sent to this address."
                >
                  ?
                </button>
              </label>
            </div>
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
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Processing..."
            : isLoginMode
              ? "Send Login Link"
              : "Send Registration Link"}
        </button>
      </form>
    </div>
  );
}
