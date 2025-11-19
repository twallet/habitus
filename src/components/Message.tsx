import { useEffect } from 'react';

interface MessageProps {
  text: string;
  type: 'success' | 'error';
  onHide: () => void;
}

/**
 * Message component for displaying success and error messages
 */
export function Message({ text, type, onHide }: MessageProps) {
  useEffect(() => {
    if (type === 'success') {
      const timer = setTimeout(() => {
        onHide();
      }, 5000);
      return () => {
        clearTimeout(timer);
      };
    }
    // Explicit return for error type
    return undefined;
  }, [type, onHide]);

  if (!text) {
    return null;
  }

  return (
    <div className={`message ${type} show`} role="alert" aria-live="polite">
      {text}
    </div>
  );
}

