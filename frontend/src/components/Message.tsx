import { useEffect } from 'react';

interface MessageProps {
  text: string;
  type: 'success' | 'error';
  onHide: () => void;
}

/**
 * Message component for displaying success and error messages.
 * Success messages auto-hide after 5 seconds, error messages remain until manually dismissed.
 * @param props - Component props
 * @param props.text - Message text to display
 * @param props.type - Message type ('success' or 'error')
 * @param props.onHide - Callback function called when message should be hidden
 * @public
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
    // Error messages don't auto-hide
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

