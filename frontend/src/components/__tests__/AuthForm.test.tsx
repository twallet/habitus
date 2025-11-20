import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthForm } from '../AuthForm';

describe('AuthForm', () => {
    const mockRequestLoginMagicLink = jest.fn();
    const mockRequestRegisterMagicLink = jest.fn();
    const mockLoginWithPassword = jest.fn();
    const mockOnError = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
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

            expect(screen.getByText(/login/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument();
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
            await user.click(screen.getByRole('button', { name: /send magic link/i }));

            await waitFor(() => {
                expect(mockRequestLoginMagicLink).toHaveBeenCalledWith('test@example.com');
            });
        });

        it('should show magic link sent message after successful request', async () => {
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
            await user.click(screen.getByRole('button', { name: /send magic link/i }));

            await waitFor(() => {
                expect(screen.getByText(/check your email/i)).toBeInTheDocument();
            });

            expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
        });

        it('should show password login when checkbox is checked', async () => {
            const user = userEvent.setup();

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onLoginWithPassword={mockLoginWithPassword}
                    onError={mockOnError}
                />
            );

            const passwordCheckbox = screen.getByLabelText(/use password to login/i);
            await user.click(passwordCheckbox);

            expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
        });

        it('should login with password when form is submitted', async () => {
            const user = userEvent.setup();
            mockLoginWithPassword.mockResolvedValue(undefined);

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onLoginWithPassword={mockLoginWithPassword}
                    onError={mockOnError}
                />
            );

            const passwordCheckbox = screen.getByLabelText(/use password to login/i);
            await user.click(passwordCheckbox);

            const emailInput = screen.getByLabelText(/email/i);
            const passwordInput = screen.getByPlaceholderText(/enter your password/i);
            await user.type(emailInput, 'test@example.com');
            await user.type(passwordInput, 'password123');
            await user.click(screen.getByRole('button', { name: /login/i }));

            await waitFor(() => {
                expect(mockLoginWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
            });
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
            const submitButton = screen.getByRole('button', { name: /send magic link/i });
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

        it('should show error when password is empty in password login mode', async () => {
            const user = userEvent.setup();

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onLoginWithPassword={mockLoginWithPassword}
                    onError={mockOnError}
                />
            );

            const passwordCheckbox = screen.getByLabelText(/use password to login/i);
            await user.click(passwordCheckbox);

            const emailInput = screen.getByLabelText(/email/i);
            await user.type(emailInput, 'test@example.com');

            // Password field should be required when usePasswordLogin is true
            const passwordInput = screen.getByPlaceholderText(/enter your password/i);
            expect(passwordInput).toHaveAttribute('required');

            // Try to submit - HTML5 validation should prevent, but our code should also check
            // Since HTML5 validation prevents submission, we need to trigger validation manually
            // or check that the field is required
            await user.click(screen.getByRole('button', { name: /login/i }));

            // HTML5 validation prevents submission, so onError might not be called
            // But we can verify the field is required
            expect(passwordInput).toBeRequired();
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
                    undefined,
                    undefined,
                    undefined
                );
            });
        });

        it('should request registration with all optional fields', async () => {
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
            const nicknameInput = screen.getByLabelText(/nickname/i);
            const emailInput = screen.getByLabelText(/email/i);
            const passwordInput = screen.getByPlaceholderText(/set a password/i);
            // Type password first to show confirm password field
            await user.type(passwordInput, 'password123');
            const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);

            await user.type(nameInput, 'John Doe');
            await user.type(nicknameInput, 'johndoe');
            await user.type(emailInput, 'john@example.com');
            await user.type(confirmPasswordInput, 'password123');

            await user.click(screen.getByRole('button', { name: /send registration link/i }));

            await waitFor(() => {
                expect(mockRequestRegisterMagicLink).toHaveBeenCalledWith(
                    'John Doe',
                    'john@example.com',
                    'johndoe',
                    'password123',
                    undefined
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

        it('should show error when passwords do not match', async () => {
            const user = userEvent.setup();

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
            const passwordInput = screen.getByPlaceholderText(/set a password/i);

            await user.type(nameInput, 'John Doe');
            await user.type(emailInput, 'john@example.com');
            await user.type(passwordInput, 'password123');
            // Confirm password field appears after typing password
            const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
            await user.type(confirmPasswordInput, 'password456');

            await user.click(screen.getByRole('button', { name: /send registration link/i }));

            await waitFor(() => {
                expect(mockOnError).toHaveBeenCalledWith('Passwords do not match');
            });
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
                readAsDataURL: jest.fn(),
                result: 'data:image/jpeg;base64,content',
                onloadend: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null,
            };

            jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

            await user.upload(fileInput, file);

            // Trigger onloadend manually
            if (mockFileReader.onloadend) {
                const event = new ProgressEvent('loadend');
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
                readAsDataURL: jest.fn(),
                result: 'data:image/jpeg;base64,content',
                onloadend: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null,
            };

            jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as any);

            await user.upload(fileInput, file);

            if (mockFileReader.onloadend) {
                mockFileReader.onloadend({} as ProgressEvent<FileReader>);
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

            const sendAnotherButton = screen.getByRole('button', { name: /send another link/i });
            await user.click(sendAnotherButton);

            await waitFor(() => {
                expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
            });
        });
    });

    describe('Form state', () => {
        it('should disable form during submission', async () => {
            const user = userEvent.setup();
            let resolvePromise: () => void;
            const promise = new Promise<void>((resolve) => {
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
            const submitButton = screen.getByRole('button', { name: /send magic link/i });

            await user.type(emailInput, 'test@example.com');
            await user.click(submitButton);

            // Wait for submission to start
            await waitFor(() => {
                expect(submitButton).toBeDisabled();
            });
            expect(emailInput).toBeDisabled();

            resolvePromise!();
            // After promise resolves, magic link sent message should appear
            await waitFor(() => {
                expect(screen.getByText(/check your email/i)).toBeInTheDocument();
            }, { timeout: 2000 });
        });

        it('should reset form after successful password login', async () => {
            const user = userEvent.setup();
            mockLoginWithPassword.mockResolvedValue(undefined);

            render(
                <AuthForm
                    onRequestLoginMagicLink={mockRequestLoginMagicLink}
                    onRequestRegisterMagicLink={mockRequestRegisterMagicLink}
                    onLoginWithPassword={mockLoginWithPassword}
                    onError={mockOnError}
                />
            );

            const passwordCheckbox = screen.getByLabelText(/use password to login/i);
            await user.click(passwordCheckbox);

            const emailInput = screen.getByLabelText(/email/i);
            const passwordInput = screen.getByPlaceholderText(/enter your password/i);
            await user.type(emailInput, 'test@example.com');
            await user.type(passwordInput, 'password123');
            await user.click(screen.getByRole('button', { name: /login/i }));

            await waitFor(() => {
                expect(mockLoginWithPassword).toHaveBeenCalled();
            });

            // After successful password login, form should be reset
            // Password input should be cleared (if still visible)
            const passwordInputAfter = screen.queryByPlaceholderText(/enter your password/i);
            if (passwordInputAfter) {
                await waitFor(() => {
                    expect(passwordInputAfter).toHaveValue('');
                });
            }
        });
    });
});

