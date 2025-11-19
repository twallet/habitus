import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserForm } from '../UserForm';

describe('UserForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render form elements', () => {
    render(<UserForm onSubmit={mockOnSubmit} onError={mockOnError} />);

    expect(screen.getByLabelText(/user name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
    expect(screen.getByText((_content, element) => {
      return element?.textContent === '0/30 characters';
    })).toBeInTheDocument();
  });

  it('should update character count as user types', async () => {
    const user = userEvent.setup();
    render(<UserForm onSubmit={mockOnSubmit} onError={mockOnError} />);

    const input = screen.getByLabelText(/user name/i);
    await user.type(input, 'John');

    expect(screen.getByText((_content, element) => {
      return element?.textContent === '4/30 characters';
    })).toBeInTheDocument();
  });

  it('should call onSubmit with trimmed name when form is submitted', async () => {
    const user = userEvent.setup();
    render(<UserForm onSubmit={mockOnSubmit} onError={mockOnError} />);

    const input = screen.getByLabelText(/user name/i);
    await user.type(input, '  John Doe  ');
    await user.click(screen.getByRole('button', { name: /create user/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith('John Doe');
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });

  it('should call onError when name is empty', async () => {
    const user = userEvent.setup();
    render(<UserForm onSubmit={mockOnSubmit} onError={mockOnError} />);

    const input = screen.getByLabelText(/user name/i);
    await user.type(input, '   ');
    await user.click(screen.getByRole('button', { name: /create user/i }));

    expect(mockOnError).toHaveBeenCalledWith('User name must not be empty');
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should call onError when name exceeds max length', async () => {
    const user = userEvent.setup();
    render(<UserForm onSubmit={mockOnSubmit} onError={mockOnError} />);

    const input = screen.getByLabelText(/user name/i) as HTMLInputElement;
    // Since maxLength prevents typing, we need to set the value directly and trigger validation
    const longName = 'a'.repeat(31);
    await user.clear(input);
    // Use fireEvent to bypass maxLength restriction for testing
    fireEvent.change(input, { target: { value: longName } });
    await user.click(screen.getByRole('button', { name: /create user/i }));

    expect(mockOnError).toHaveBeenCalled();
    expect(mockOnError.mock.calls[0][0]).toContain('smaller than 30 characters');
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should clear form after successful submission', async () => {
    const user = userEvent.setup();
    render(<UserForm onSubmit={mockOnSubmit} onError={mockOnError} />);

    const input = screen.getByLabelText(/user name/i) as HTMLInputElement;
    await user.type(input, 'John Doe');
    await user.click(screen.getByRole('button', { name: /create user/i }));

    await waitFor(() => {
      expect(input.value).toBe('');
    });
    expect(screen.getByText((_content, element) => {
      return element?.textContent === '0/30 characters';
    })).toBeInTheDocument();
  });

  it('should handle Enter key submission', async () => {
    const user = userEvent.setup();
    render(<UserForm onSubmit={mockOnSubmit} onError={mockOnError} />);

    const input = screen.getByLabelText(/user name/i);
    await user.type(input, 'John Doe{Enter}');

    expect(mockOnSubmit).toHaveBeenCalledWith('John Doe');
  });

  it('should have correct maxLength attribute', () => {
    render(<UserForm onSubmit={mockOnSubmit} onError={mockOnError} />);

    const input = screen.getByLabelText(/user name/i) as HTMLInputElement;
    expect(input.maxLength).toBe(30);
  });
});

