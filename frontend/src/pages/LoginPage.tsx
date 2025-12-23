import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AuthForm } from '../components/AuthForm';
import { Message } from '../components/Message';
import { getDailyCitation } from '../utils/citations';

export function LoginPage() {
    const { requestLoginMagicLink, requestRegisterMagicLink } = useAuth();
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const dailyCitation = getDailyCitation();

    const handleRequestLoginMagicLink = async (email: string) => {
        try {
            const response = await requestLoginMagicLink(email);
            setMessage({
                text: response.message,
                type: response.cooldown ? 'error' : 'success',
            });
            return response;
        } catch (error) {
            setMessage({
                text: error instanceof Error ? error.message : 'Error requesting login link',
                type: 'error',
            });
            throw error;
        }
    };

    const handleRequestRegisterMagicLink = async (name: string, email: string, profilePicture?: File) => {
        try {
            await requestRegisterMagicLink(name, email, profilePicture);
            // Clear message when email is sent - the AuthForm will show "Check your email!" screen
            setMessage(null);
        } catch (error) {
            setMessage({
                text: error instanceof Error ? error.message : 'Error requesting registration link',
                type: 'error',
            });
            throw error;
        }
    };

    return (
        <div className="container">
            <header>
                <h1>
                    <img
                        src="/assets/images/te-verde.png"
                        alt="🌱"
                        className="habitus-icon"
                        style={{ height: '1em', width: 'auto', verticalAlign: 'baseline', marginRight: '0.4em', display: 'inline-block' }}
                        title={dailyCitation}
                    />
                    Habitus
                </h1>
            </header>

            {message && (
                <Message
                    text={message.text}
                    type={message.type}
                    onHide={() => setMessage(null)}
                />
            )}

            <main>
                <AuthForm
                    onRequestLoginMagicLink={handleRequestLoginMagicLink}
                    onRequestRegisterMagicLink={handleRequestRegisterMagicLink}
                    onError={(msg) => setMessage({ text: msg, type: 'error' })}
                    onCooldown={(msg) => setMessage({ text: msg, type: 'error' })}
                />
            </main>
        </div>
    );
}
