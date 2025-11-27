import { vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { Message } from '../Message';

describe('Message', () => {
  const mockOnHide = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Run all pending timers to completion
    vi.runAllTimers();
    // Clear all timers
    vi.clearAllTimers();
    // Cleanup React components (this will trigger cleanup functions)
    cleanup();
    // Run timers one more time after cleanup to catch any cleanup timers
    vi.runAllTimers();
    // Clear again
    vi.clearAllTimers();
    // Switch back to real timers
    vi.useRealTimers();
  });

  it('should not render when text is empty', () => {
    const { container } = render(
      <Message text="" type="success" onHide={mockOnHide} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render success message', () => {
    const { unmount } = render(
      <Message text="User created successfully" type="success" onHide={mockOnHide} />
    );

    const message = screen.getByRole('alert');
    expect(message).toBeInTheDocument();
    expect(message).toHaveTextContent('User created successfully');
    expect(message).toHaveClass('message', 'success', 'show');

    // Cleanup
    unmount();
    vi.runOnlyPendingTimers();
  });

  it('should render error message', () => {
    const { unmount } = render(
      <Message text="Error creating user" type="error" onHide={mockOnHide} />
    );

    const message = screen.getByRole('alert');
    expect(message).toBeInTheDocument();
    expect(message).toHaveTextContent('Error creating user');
    expect(message).toHaveClass('message', 'error', 'show');

    // Cleanup
    unmount();
    vi.runOnlyPendingTimers();
  });

  it('should auto-hide success message after 5 seconds', async () => {
    const { unmount } = render(
      <Message text="Success message" type="success" onHide={mockOnHide} />
    );

    expect(mockOnHide).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(mockOnHide).toHaveBeenCalledTimes(1);
    }, { timeout: 100 });

    // Cleanup
    unmount();
    vi.runOnlyPendingTimers();
  });

  it('should not auto-hide error messages', () => {
    const { unmount } = render(
      <Message text="Error message" type="error" onHide={mockOnHide} />
    );

    vi.advanceTimersByTime(10000);

    expect(mockOnHide).not.toHaveBeenCalled();

    // Cleanup
    unmount();
    vi.runOnlyPendingTimers();
  });

  it('should cleanup timer on unmount', () => {
    const { unmount } = render(
      <Message text="Success message" type="success" onHide={mockOnHide} />
    );

    expect(mockOnHide).not.toHaveBeenCalled();

    unmount();

    // Advance timers after unmount - callback should not be called
    vi.advanceTimersByTime(5000);

    expect(mockOnHide).not.toHaveBeenCalled();
  });
});

