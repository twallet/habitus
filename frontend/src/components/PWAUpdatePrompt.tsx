import { useRegisterSW } from 'virtual:pwa-register/react';
import './PWAUpdatePrompt.css';

/**
 * Component that displays a prompt when a new version of the app is available.
 * It uses the vite-plugin-pwa hook to manage service worker updates.
 * @public
 */
export function PWAUpdatePrompt() {
    // Defensive check for useRegisterSW which may be undefined in some test environments
    // due to virtual module resolution issues.
    const registerSW = typeof useRegisterSW === 'function' ? useRegisterSW : () => ({
        offlineReady: [false, (_val: boolean) => { }] as [boolean, (val: boolean) => void],
        needRefresh: [false, (_val: boolean) => { }] as [boolean, (val: boolean) => void],
        updateServiceWorker: async (_reload?: boolean) => { },
    });

    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = registerSW({
        onRegistered(r: ServiceWorkerRegistration | undefined) {
            console.log('SW Registered: ' + r);
        },
        onRegisterError(error: any) {
            console.log('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    /**
     * Only show the prompt if the app is ready for offline use or needs an update.
     */
    if (!offlineReady && !needRefresh) {
        return null;
    }

    return (
        <div className="pwa-toast" role="alert" aria-live="assertive">
            <div className="pwa-toast-message">
                {offlineReady ? (
                    <span>App ready to work offline</span>
                ) : (
                    <span>New content available, click on reload button to update.</span>
                )}
            </div>
            <div className="pwa-toast-buttons">
                {needRefresh && (
                    <button className="pwa-toast-button reload" onClick={() => updateServiceWorker(true)}>
                        Reload
                    </button>
                )}
                <button className="pwa-toast-button close" onClick={close}>
                    Close
                </button>
            </div>
        </div>
    );
}
