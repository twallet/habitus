import { vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthForm } from '../AuthForm';

describe('AuthForm', () => {
    const mockRequestLoginMagicLink = vi.fn();
    const mockRequestRegisterMagicLink = vi.fn();
    const mockOnError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Login mode', () => {
        it('should render login form', () => {
            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
            expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /send login link/i })).toBeInTheDocument();
        });

        it('should request login magic link', async () => {
            const user = userEvent.setup();
            mockRequestLoginMagicLink.mockResolvedValue(undefined);

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            const emailInput = screen.getByLabelText(/email/i);
            await user.type(emailInput, 'test@example.com');
            await user.click(screen.getByRole('button', { name: /send login link/i }));

            await waitFor(() => {
                expect(mockRequestLoginMagicLink).toHaveBeenCalledWith('test@example.com');
            });
        });

        it('should show magic link sent message after successful request', async () => {
            const user = userEvent.setup();
            mockRequestLoginMagicLink.mockResolvedValue({});

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            const emailInput = screen.getByLabelText(/email/i);
            await user.type(emailInput, 'test@example.com');
            await user.click(screen.getByRole('button', { name: /send login link/i }));

            await waitFor(() => {
                expect(screen.getByText(/check your email/i)).toBeInTheDocument();
            });

            expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
        });

        it('should allow sending another link in login mode', async () => {
            const user = userEvent.setup();
            mockRequestLoginMagicLink.mockResolvedValue({});

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            const emailInput = screen.getByLabelText(/email/i);
            await user.type(emailInput, 'test@example.com');
            await user.click(screen.getByRole('button', { name: /send login link/i }));

            await waitFor(() => {
                expect(screen.getByText(/check your email/i)).toBeInTheDocument();
            });

            expect(mockRequestLoginMagicLink).toHaveBeenCalledTimes(1);
            expect(mockRequestLoginMagicLink).toHaveBeenCalledWith('test@example.com');

            const sendAnotherButton = screen.getByRole('button', { name: /send another link/i });
            await user.click(sendAnotherButton);

            // Wait for the magic link to be sent again
            await waitFor(() => {
                expect(mockRequestLoginMagicLink).toHaveBeenCalledTimes(2);
            });

            // After sending, should still show the success message
            expect(screen.getByText(/check your email/i)).toBeInTheDocument();
            expect(mockRequestLoginMagicLink).toHaveBeenLastCalledWith('test@example.com');
        });

        it('should show error when email is empty', async () => {
            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            // Find form by finding submit button's parent form
            const submitButton = screen.getByRole('button', { name: /send login link/i });
            const form = submitButton.closest('form');
            if (form) {
                fireEvent.submit(form);
            } else {
                // Fallback: trigger submit event manually
                fireEvent.click(submitButton);
            }

            await waitFor(() => {
                expect(mockOnError).toHaveBeenCalledWith('Email is required');
            });
        });
    });

    describe('Register mode', () => {
        it('should toggle to register mode', async () => {
            const user = userEvent.setup();

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

            expect(screen.getByText(/register/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^name \*$/i)).toBeInTheDocument();
        });

        it('should request registration magic link', async () => {
            const user = userEvent.setup();
            mockRequestRegisterMagicLink.mockResolvedValue(undefined);

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

            const nameInput = screen.getByLabelText(/^name \*$/i);
            const emailInput = screen.getByLabelText(/email/i);
            await user.type(nameInput, 'John Doe');
            await user.type(emailInput, 'john@example.com');
            await user.click(screen.getByRole('button', { name: /send registration link/i }));

            await waitFor(() => {
                expect(mockRequestRegisterMagicLink).toHaveBeenCalledWith(
                    'John Doe',
                    'john@example.com',
                    undefined
                );
            });
        });

        it('should request registration with profile picture', async () => {
            const user = userEvent.setup();
            mockRequestRegisterMagicLink.mockResolvedValue(undefined);

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

            const nameInput = screen.getByLabelText(/^name \*$/i);
            const emailInput = screen.getByLabelText(/email/i);

            await user.type(nameInput, 'John Doe');
            await user.type(emailInput, 'john@example.com');

            // Create a mock file
            const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
            const fileInput = screen.getByLabelText(/profile picture/i).closest('div')?.querySelector('input[type="file"]') as HTMLInputElement;

            if (fileInput) {
                await user.upload(fileInput, file);
            }

            await user.click(screen.getByRole('button', { name: /send registration link/i }));

            await waitFor(() => {
                expect(mockRequestRegisterMagicLink).toHaveBeenCalledWith(
                    'John Doe',
                    'john@example.com',
                    expect.any(File)
                );
            });
        });

        it('should show error when name is empty', async () => {
            const user = userEvent.setup();

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/^name \*$/i)).toBeInTheDocument();
            });

            const nameInput = screen.getByLabelText(/^name \*$/i);
            const emailInput = screen.getByLabelText(/email/i);

            // Type email but leave name empty
            await user.type(emailInput, 'john@example.com');

            // Get the form element and submit it directly to bypass HTML5 validation
            const form = nameInput.closest('form');
            if (form) {
                // Remove required attribute temporarily to test JS validation
                nameInput.removeAttribute('required');

                // Submit form directly to trigger handleSubmit
                fireEvent.submit(form);

                await waitFor(() => {
                    expect(mockOnError).toHaveBeenCalledWith('Name is required');
                }, { timeout: 2000 });
            }
        });

        it('should handle profile picture upload', async () => {
            const user = userEvent.setup();
            mockRequestRegisterMagicLink.mockResolvedValue(undefined);

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

            const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
            const fileInput = screen.getByLabelText(/profile picture/i) as HTMLInputElement;

            await user.upload(fileInput, file);

            await waitFor(() => {
                expect(fileInput.files?.[0]).toBe(file);
            });
        });

        it('should show error for invalid file type', async () => {
            const user = userEvent.setup();

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/profile picture/i)).toBeInTheDocument();
            });

            const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
            const fileInput = screen.getByLabelText(/profile picture/i) as HTMLInputElement;

            // Create a proper FileList-like object
            Object.defineProperty(fileInput, 'files', {
                value: [file],
                writable: false,
            });

            // Use fireEvent to properly trigger onChange with invalid file type
            fireEvent.change(fileInput);

            await waitFor(() => {
                expect(mockOnError).toHaveBeenCalledWith('Please select an image file');
            }, { timeout: 2000 });
        });

        it('should show error for file size exceeding 5MB', async () => {
            const user = userEvent.setup();

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

            // Create a file larger than 5MB
            const largeContent = new Array(6 * 1024 * 1024).fill('a').join('');
            const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
            const fileInput = screen.getByLabelText(/profile picture/i) as HTMLInputElement;

            await user.upload(fileInput, file);

            await waitFor(() => {
                expect(mockOnError).toHaveBeenCalledWith('Image size must be less than 5MB');
            });
        });

        it('should show profile picture preview', async () => {
            const user = userEvent.setup();

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

            const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
            const fileInput = screen.getByLabelText(/profile picture/i) as HTMLInputElement;

            // Mock FileReader
            const mockFileReader = {
                readAsDataURL: vi.fn(),
                result: 'data:image/jpeg;base64,content',
                onloadend: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null,
            };

            vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

            await user.upload(fileInput, file);

            // Trigger onloadend manually
            if (mockFileReader.onloadend) {
                const event = new ProgressEvent('loadend') as ProgressEvent<FileReader>;
                mockFileReader.onloadend.call(mockFileReader as any, event);
            }

            await waitFor(() => {
                expect(screen.getByAltText(/profile preview/i)).toBeInTheDocument();
            });
        });

        it('should remove profile picture', async () => {
            const user = userEvent.setup();

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

            const file = new File(['content'], 'profile.jpg', { type: 'image/jpeg' });
            const fileInput = screen.getByLabelText(/profile picture/i) as HTMLInputElement;

            const mockFileReader = {
                readAsDataURL: vi.fn(),
                result: 'data:image/jpeg;base64,content',
                onloadend: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null,
            };

            vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

            await user.upload(fileInput, file);

            if (mockFileReader.onloadend) {
                const event = new ProgressEvent('loadend') as ProgressEvent<FileReader>;
                mockFileReader.onloadend.call(mockFileReader as any, event);
            }

            await waitFor(() => {
                expect(screen.getByAltText(/profile preview/i)).toBeInTheDocument();
            });

            const removeButton = screen.getByRole('button', { name: /remove/i });
            await user.click(removeButton);

            await waitFor(() => {
                expect(screen.queryByAltText(/profile preview/i)).not.toBeInTheDocument();
            });
        });

        it('should show magic link sent message after successful registration', async () => {
            const user = userEvent.setup();
            mockRequestRegisterMagicLink.mockResolvedValue(undefined);

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

            const nameInput = screen.getByLabelText(/^name \*$/i);
            const emailInput = screen.getByLabelText(/email/i);
            await user.type(nameInput, 'John Doe');
            await user.type(emailInput, 'john@example.com');
            await user.click(screen.getByRole('button', { name: /send registration link/i }));

            await waitFor(() => {
                expect(screen.getByText(/check your email/i)).toBeInTheDocument();
            });
        });

        it('should allow sending another link', async () => {
            const user = userEvent.setup();
            mockRequestRegisterMagicLink.mockResolvedValue(undefined);

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            await user.click(screen.getByRole('button', { name: /don't have an account\? register/i }));

            const nameInput = screen.getByLabelText(/^name \*$/i);
            const emailInput = screen.getByLabelText(/email/i);
            await user.type(nameInput, 'John Doe');
            await user.type(emailInput, 'john@example.com');
            await user.click(screen.getByRole('button', { name: /send registration link/i }));

            await waitFor(() => {
                expect(screen.getByText(/check your email/i)).toBeInTheDocument();
            });

            expect(mockRequestRegisterMagicLink).toHaveBeenCalledTimes(1);

            const sendAnotherButton = screen.getByRole('button', { name: /send another link/i });
            await user.click(sendAnotherButton);

            // Wait for the magic link to be sent again
            await waitFor(() => {
                expect(mockRequestRegisterMagicLink).toHaveBeenCalledTimes(2);
            });

            // After sending, should still show the success message
            expect(screen.getByText(/check your email/i)).toBeInTheDocument();
            expect(mockRequestRegisterMagicLink).toHaveBeenLastCalledWith('John Doe', 'john@example.com', undefined);
        });
    });

    describe('Form state', () => {
        it('should disable form during submission', async () => {
            const user = userEvent.setup();
            let resolvePromise: (value: {}) => void;
            const promise = new Promise<{}>((resolve) => {
                resolvePromise = resolve;
            });
            mockRequestLoginMagicLink.mockReturnValue(promise);

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onError={mockOnError}
                />
            );

            const emailInput = screen.getByLabelText(/email/i);
            const submitButton = screen.getByRole('button', { name: /send login link/i });

            await user.type(emailInput, 'test@example.com');
            await user.click(submitButton);

            // Wait for submission to start
            await waitFor(() => {
                expect(submitButton).toBeDisabled();
            });
            expect(emailInput).toBeDisabled();

            resolvePromise!({});
            // After promise resolves, magic link sent message should appear
            await waitFor(() => {
                expect(screen.getByText(/check your email/i)).toBeInTheDocument();
            }, { timeout: 2000 });
        });
    });
});

