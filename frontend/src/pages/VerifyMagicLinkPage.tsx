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
    const { verifyMagicLink, isAuthenticated } = useAuth();
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [isVerifying, setIsVerifying] = useState(true);
    const [verificationComplete, setVerificationComplete] = useState(false);

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
                    `[${new Date().toISOString()}] VERIFY_MAGIC_LINK | Token verified successfully, waiting for auth state update`
                );
                setMessage({
                    text: 'Email verified successfully! Redirecting...',
                    type: 'success',
                });
                setIsVerifying(false);
                setVerificationComplete(true);
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

    /**
     * Navigate to trackings once authentication state is confirmed.
     * This ensures the auth state has been properly updated before navigation.
     * @internal
     */
    useEffect(() => {
        if (verificationComplete && isAuthenticated) {
            console.log(
                `[${new Date().toISOString()}] VERIFY_MAGIC_LINK | Auth state confirmed, redirecting to trackings`
            );
            // Small delay to ensure UI shows success message
            const timer = setTimeout(() => {
                navigate('/trackings', { replace: true });
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [verificationComplete, isAuthenticated, navigate]);

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

