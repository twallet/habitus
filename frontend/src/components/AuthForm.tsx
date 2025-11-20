import { useState, FormEvent } from "react";

interface AuthFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (name: string, email: string, password: string) => Promise<void>;
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
export function AuthForm({ onLogin, onRegister, onError }: AuthFormProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

        await onRegister(name.trim(), email.trim(), password);
      }

      // Reset form on success
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
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
    </div>
  );
}

