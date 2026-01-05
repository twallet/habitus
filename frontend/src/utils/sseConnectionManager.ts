/**
 * Configuration for SSE connection retry behavior.
 * @public
 */
export interface SseRetryConfig {
    /** Maximum number of retry attempts before giving up */
    maxRetryAttempts: number;
    /** Initial retry delay in milliseconds */
    initialRetryDelay: number;
    /** Maximum retry delay in milliseconds */
    maxRetryDelay: number;
    /** Heartbeat timeout in milliseconds (connection considered dead if no heartbeat received) */
    heartbeatTimeout: number;
    /** Heartbeat check interval in milliseconds */
    heartbeatCheckInterval: number;
}

/**
 * Default retry configuration.
 * @public
 */
export const DEFAULT_RETRY_CONFIG: SseRetryConfig = {
    maxRetryAttempts: 10,
    initialRetryDelay: 1000, // 1 second
    maxRetryDelay: 30000, // 30 seconds
    heartbeatTimeout: 90000, // 90 seconds (3 missed heartbeats at 30s interval)
    heartbeatCheckInterval: 30000, // 30 seconds (same as server heartbeat interval)
};

/**
 * SSE event handler callbacks.
 * @public
 */
export interface SseEventHandlers {
    /** Called when SSE connection is established */
    onConnected?: (data: any) => void;
    /** Called when Telegram connection is detected */
    onTelegramConnected?: (data: { chatId: string; username?: string; timestamp: string }) => void;
    /** Called when heartbeat is received */
    onHeartbeat?: () => void;
    /** Called when connection error occurs */
    onError?: (error: Error) => void;
    /** Called when max retry attempts are reached */
    onMaxRetriesReached?: () => void;
}

/**
 * Manages Server-Sent Events (SSE) connection with robust retry and error handling.
 * Follows OOP principles by encapsulating connection logic in a class.
 * @public
 */
export class SseConnectionManager {
    private eventSource: EventSource | null = null;
    private retryCount: number = 0;
    private retryTimeout: NodeJS.Timeout | null = null;
    private heartbeatCheckInterval: NodeJS.Timeout | null = null;
    private lastHeartbeat: Date | null = null;
    private isConnected: boolean = false;
    private hasReceivedInitialConnection: boolean = false;
    private config: SseRetryConfig;
    private url: string;
    private handlers: SseEventHandlers;
    private shouldConnect: () => boolean;

    /**
     * Create a new SSE connection manager.
     * @param url - SSE endpoint URL
     * @param handlers - Event handler callbacks
     * @param shouldConnect - Function that returns true if connection should be maintained
     * @param config - Optional retry configuration (uses defaults if not provided)
     * @public
     */
    constructor(
        url: string,
        handlers: SseEventHandlers,
        shouldConnect: () => boolean,
        config: Partial<SseRetryConfig> = {}
    ) {
        this.url = url;
        this.handlers = handlers;
        this.shouldConnect = shouldConnect;
        this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    }

    /**
     * Calculate exponential backoff delay for retry.
     * @param attempt - Current retry attempt number (0-indexed)
     * @returns Delay in milliseconds
     * @private
     */
    private calculateRetryDelay(attempt: number): number {
        const delay = Math.min(
            this.config.initialRetryDelay * Math.pow(2, attempt),
            this.config.maxRetryDelay
        );
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.3 * delay;
        return delay + jitter;
    }

    /**
     * Check if SSE connection is healthy based on heartbeat.
     * @private
     */
    private checkConnectionHealth(): void {
        if (!this.eventSource || !this.shouldConnect()) {
            return;
        }

        const now = new Date();
        const lastHeartbeat = this.lastHeartbeat;

        // If we have a last heartbeat, check if it's too old
        if (lastHeartbeat) {
            const timeSinceLastHeartbeat = now.getTime() - lastHeartbeat.getTime();
            if (timeSinceLastHeartbeat > this.config.heartbeatTimeout) {
                console.warn('[SseConnectionManager] SSE heartbeat timeout, reconnecting...');
                // Connection appears dead, force reconnect
                this.disconnect();
                // Reset retry count for fresh connection attempt
                this.retryCount = 0;
                this.connect();
            }
        }
    }

    /**
     * Start heartbeat health check monitoring.
     * @private
     */
    private startHeartbeatMonitoring(): void {
        this.stopHeartbeatMonitoring();
        this.heartbeatCheckInterval = setInterval(() => {
            this.checkConnectionHealth();
        }, this.config.heartbeatCheckInterval);
    }

    /**
     * Stop heartbeat health check monitoring.
     * @private
     */
    private stopHeartbeatMonitoring(): void {
        if (this.heartbeatCheckInterval) {
            clearInterval(this.heartbeatCheckInterval);
            this.heartbeatCheckInterval = null;
        }
    }

    /**
     * Handle SSE connection error and schedule retry if needed.
     * @private
     */
    private handleError(): void {
        console.error('[SseConnectionManager] SSE error occurred');

        // Close the current connection
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        this.isConnected = false;

        // Only retry if we should still be connected
        if (!this.shouldConnect()) {
            console.log('[SseConnectionManager] Not retrying - shouldConnect returned false');
            return;
        }

        const currentAttempt = this.retryCount;
        this.retryCount = currentAttempt + 1;

        if (currentAttempt < this.config.maxRetryAttempts) {
            const delay = this.calculateRetryDelay(currentAttempt);
            console.log(
                `[SseConnectionManager] Scheduling retry ${currentAttempt + 1}/${this.config.maxRetryAttempts} in ${delay}ms`
            );

            this.retryTimeout = setTimeout(() => {
                this.retryTimeout = null;
                // Only retry if still should connect
                if (this.shouldConnect()) {
                    this.connect();
                }
            }, delay);
        } else {
            console.error('[SseConnectionManager] Max retry attempts reached');
            if (this.handlers.onMaxRetriesReached) {
                this.handlers.onMaxRetriesReached();
            }
            if (this.handlers.onError) {
                this.handlers.onError(
                    new Error('Connection failed after multiple attempts. Please try again or refresh the page.')
                );
            }
        }
    }

    /**
     * Connect to SSE endpoint with retry mechanism.
     * @public
     */
    connect(): void {
        // Clear any pending retry timeout
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }

        // Don't connect if already connected
        if (this.eventSource) {
            console.log('[SseConnectionManager] Already connected, skipping');
            return;
        }

        // Don't connect if shouldConnect returns false
        if (!this.shouldConnect()) {
            console.log('[SseConnectionManager] Not connecting - shouldConnect returned false');
            return;
        }

        // Check retry limit
        if (this.retryCount >= this.config.maxRetryAttempts) {
            console.error('[SseConnectionManager] Max retry attempts reached, giving up');
            if (this.handlers.onMaxRetriesReached) {
                this.handlers.onMaxRetriesReached();
            }
            return;
        }

        console.log(
            `[SseConnectionManager] Connecting to SSE (attempt ${this.retryCount + 1}/${this.config.maxRetryAttempts}):`,
            this.url
        );

        try {
            // EventSource automatically sends cookies
            const eventSource = new EventSource(this.url, { withCredentials: true });

            // Set up event listeners
            eventSource.addEventListener('connected', (e: MessageEvent) => {
                console.log('[SseConnectionManager] SSE connected:', e.data);
                this.isConnected = true;
                this.hasReceivedInitialConnection = true;
                // Reset retry count on successful connection
                this.retryCount = 0;
                this.lastHeartbeat = new Date();
                // Start heartbeat monitoring
                this.startHeartbeatMonitoring();
                if (this.handlers.onConnected) {
                    try {
                        const data = e.data ? JSON.parse(e.data) : {};
                        this.handlers.onConnected(data);
                    } catch (err) {
                        this.handlers.onConnected({});
                    }
                }
            });

            eventSource.addEventListener('telegram-connected', (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data);
                    console.log('[SseConnectionManager] Telegram connected via SSE:', data);
                    if (this.handlers.onTelegramConnected) {
                        this.handlers.onTelegramConnected(data);
                    }
                } catch (err) {
                    console.error('[SseConnectionManager] Error parsing telegram-connected event:', err);
                }
            });

            eventSource.addEventListener('heartbeat', () => {
                // Update last heartbeat timestamp
                this.lastHeartbeat = new Date();
                // Reset retry count on successful heartbeat
                if (this.hasReceivedInitialConnection) {
                    this.retryCount = 0;
                }
                if (this.handlers.onHeartbeat) {
                    this.handlers.onHeartbeat();
                }
            });

            eventSource.onopen = () => {
                console.log('[SseConnectionManager] SSE connection opened');
                this.isConnected = true;
                // Reset retry count on successful open
                this.retryCount = 0;
            };

            eventSource.onerror = () => {
                // Check connection state
                const readyState = eventSource.readyState;
                console.log('[SseConnectionManager] SSE readyState:', readyState);

                // EventSource.readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
                if (readyState === EventSource.CLOSED) {
                    console.log('[SseConnectionManager] SSE connection closed');
                } else if (readyState === EventSource.CONNECTING) {
                    console.log('[SseConnectionManager] SSE connection failed, will retry...');
                }

                this.handleError();
            };

            this.eventSource = eventSource;
        } catch (error) {
            console.error('[SseConnectionManager] Error creating SSE connection:', error);
            // Handle synchronous errors
            this.handleError();
        }
    }

    /**
     * Disconnect from SSE and clean up all resources.
     * @public
     */
    disconnect(): void {
        // Clear retry timeout
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }

        // Stop heartbeat monitoring
        this.stopHeartbeatMonitoring();

        // Close SSE connection
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        // Reset state
        this.retryCount = 0;
        this.lastHeartbeat = null;
        this.isConnected = false;
        this.hasReceivedInitialConnection = false;

        console.log('[SseConnectionManager] Disconnected and cleaned up');
    }

    /**
     * Check if currently connected.
     * @returns True if connected, false otherwise
     * @public
     */
    isCurrentlyConnected(): boolean {
        return this.isConnected && this.eventSource !== null;
    }

    /**
     * Reset retry count (useful after successful connection).
     * @public
     */
    resetRetryCount(): void {
        this.retryCount = 0;
    }
}

