// Service Worker Registration and Management

export interface ServiceWorkerMessage {
  type: string;
  data?: any;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  async register(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('Service Worker registered successfully');

      // Handle service worker updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration?.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is available
              this.notifyUpdate();
            }
          });
        }
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleMessage(event.data);
      });

      // Check if there's a waiting service worker
      if (this.registration.waiting) {
        this.notifyUpdate();
      }

      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const result = await this.registration.unregister();
      this.registration = null;
      console.log('Service Worker unregistered');
      return result;
    } catch (error) {
      console.error('Service Worker unregistration failed:', error);
      return false;
    }
  }

  // Send message to service worker
  postMessage(message: ServiceWorkerMessage): void {
    if (!navigator.serviceWorker.controller) {
      console.warn('No active service worker to send message to');
      return;
    }

    navigator.serviceWorker.controller.postMessage(message);
  }

  // Register message handler
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  // Remove message handler
  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  // Handle incoming messages from service worker
  private handleMessage(message: ServiceWorkerMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data);
    }
  }

  // Notify about service worker update
  private notifyUpdate(): void {
    const handler = this.messageHandlers.get('UPDATE_AVAILABLE');
    if (handler) {
      handler({});
    }
  }

  // Skip waiting and activate new service worker
  skipWaiting(): void {
    if (this.registration?.waiting) {
      this.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  // Request background sync
  async requestSync(tag: string): Promise<void> {
    if (!this.registration) {
      throw new Error('Service Worker not registered');
    }

    if ('sync' in this.registration) {
      try {
        await (this.registration as any).sync.register(tag);
        console.log('Background sync registered:', tag);
      } catch (error) {
        console.error('Background sync registration failed:', error);
        throw error;
      }
    } else {
      console.warn('Background sync not supported');
    }
  }

  // Cache additional URLs
  cacheUrls(urls: string[]): void {
    this.postMessage({
      type: 'CACHE_URLS',
      data: { urls }
    });
  }

  // Clear cache
  clearCache(cacheName: string): void {
    this.postMessage({
      type: 'CLEAR_CACHE',
      data: { cacheName }
    });
  }

  // Check if app is running in standalone mode (PWA)
  isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  // Check if service worker is supported
  isSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  // Get registration status
  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }
}

// Create singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Utility functions
export const registerServiceWorker = () => serviceWorkerManager.register();
export const unregisterServiceWorker = () => serviceWorkerManager.unregister();

// Hook for React components
export const useServiceWorker = () => {
  return {
    register: registerServiceWorker,
    unregister: unregisterServiceWorker,
    postMessage: (message: ServiceWorkerMessage) => serviceWorkerManager.postMessage(message),
    onMessage: (type: string, handler: (data: any) => void) => serviceWorkerManager.onMessage(type, handler),
    offMessage: (type: string) => serviceWorkerManager.offMessage(type),
    skipWaiting: () => serviceWorkerManager.skipWaiting(),
    requestSync: (tag: string) => serviceWorkerManager.requestSync(tag),
    cacheUrls: (urls: string[]) => serviceWorkerManager.cacheUrls(urls),
    clearCache: (cacheName: string) => serviceWorkerManager.clearCache(cacheName),
    isStandalone: () => serviceWorkerManager.isStandalone(),
    isSupported: () => serviceWorkerManager.isSupported(),
    getRegistration: () => serviceWorkerManager.getRegistration(),
  };
};