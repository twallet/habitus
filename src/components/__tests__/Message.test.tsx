import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { Message } from '../Message';

describe('Message', () => {
  const mockOnHide = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Run all pending timers to completion
    jest.runAllTimers();
    // Clear all timers
    jest.clearAllTimers();
    // Cleanup React components (this will trigger cleanup functions)
    cleanup();
    // Run timers one more time after cleanup to catch any cleanup timers
    jest.runAllTimers();
    // Clear again
    jest.clearAllTimers();
    // Switch back to real timers
    jest.useRealTimers();
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
    jest.runOnlyPendingTimers();
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
    jest.runOnlyPendingTimers();
  });

  it('should auto-hide success message after 5 seconds', async () => {
    const { unmount } = render(
      <Message text="Success message" type="success" onHide={mockOnHide} />
    );

    expect(mockOnHide).not.toHaveBeenCalled();

    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(mockOnHide).toHaveBeenCalledTimes(1);
    }, { timeout: 100 });

    // Cleanup
    unmount();
    jest.runOnlyPendingTimers();
  });

  it('should not auto-hide error messages', () => {
    const { unmount } = render(
      <Message text="Error message" type="error" onHide={mockOnHide} />
    );

    jest.advanceTimersByTime(10000);

    expect(mockOnHide).not.toHaveBeenCalled();

    // Cleanup
    unmount();
    jest.runOnlyPendingTimers();
  });

  it('should cleanup timer on unmount', () => {
    const { unmount } = render(
      <Message text="Success message" type="success" onHide={mockOnHide} />
    );

    expect(mockOnHide).not.toHaveBeenCalled();

    unmount();

    // Advance timers after unmount - callback should not be called
    jest.advanceTimersByTime(5000);

    expect(mockOnHide).not.toHaveBeenCalled();
  });
});

