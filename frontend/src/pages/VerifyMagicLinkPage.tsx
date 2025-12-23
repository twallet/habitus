import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Message } from '../components/Message';

/**
 * Page component for verifying magic link tokens.
 * Extracts token from URL query parameters, verifies it, and logs the user in.
 * @public
 */
export function VerifyMagicLinkPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { verifyMagicLink } = useAuth();
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [isVerifying, setIsVerifying] = useState(true);

    useEffect(() => {
        /**
         * Verify magic link token from URL.
         * @internal
         */
        const handleVerification = async () => {
            const token = searchParams.get('token');

            if (!token) {
                setMessage({
                    text: 'Invalid verification link. Token is missing.',
                    type: 'error',
                });
                setIsVerifying(false);
                // Redirect to login after showing error
                setTimeout(() => {
                    navigate('/login', { replace: true });
                }, 3000);
                return;
            }

            try {
                // React Router's useSearchParams already decodes URL parameters,
                // but we decode again in case of double-encoding from email clients
                let decodedToken = token;
                try {
                    decodedToken = decodeURIComponent(token);
                } catch (e) {
                    // If decodeURIComponent fails, token might already be decoded, use original
                    decodedToken = token;
                }
                console.log(
                    `[${new Date().toISOString()}] VERIFY_MAGIC_LINK | Verifying token from URL (length: ${decodedToken.length}, original length: ${token.length})`
                );
                await verifyMagicLink(decodedToken);
                console.log(
                    `[${new Date().toISOString()}] VERIFY_MAGIC_LINK | Token verified successfully, redirecting to dashboard`
                );
                setMessage({
                    text: 'Email verified successfully! Redirecting...',
                    type: 'success',
                });
                // Redirect to dashboard after successful verification
                setTimeout(() => {
                    navigate('/', { replace: true });
                }, 1500);
            } catch (error) {
                console.error(
                    `[${new Date().toISOString()}] VERIFY_MAGIC_LINK | Token verification failed:`,
                    error
                );
                setMessage({
                    text: error instanceof Error ? error.message : 'Invalid or expired verification link',
                    type: 'error',
                });
                setIsVerifying(false);
                // Redirect to login after showing error
                setTimeout(() => {
                    navigate('/login', { replace: true });
                }, 3000);
            }
        };

        handleVerification();
    }, [searchParams, verifyMagicLink, navigate]);

    return (
        <div className="container">
            <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem' }}>
                {isVerifying && !message && (
                    <div className="loading">Verifying your email...</div>
                )}
                {message && (
                    <Message
                        text={message.text}
                        type={message.type}
                        onHide={() => {
                            // Don't hide message automatically, let redirect happen
                        }}
                    />
                )}
            </div>
        </div>
    );
}

