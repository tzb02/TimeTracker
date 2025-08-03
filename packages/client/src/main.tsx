import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { QueryProvider } from './providers/QueryProvider';
import { registerServiceWorker } from './utils/serviceWorker';
import { initIndexedDB } from './utils/indexedDB';
import './index.css';

// Initialize offline functionality
const initOfflineFeatures = async () => {
  try {
    // Initialize IndexedDB
    await initIndexedDB();
    console.log('IndexedDB initialized');

    // Register service worker
    const swRegistered = await registerServiceWorker();
    if (swRegistered) {
      console.log('Service Worker registered');
    } else {
      console.warn('Service Worker not supported or registration failed');
    }
  } catch (error) {
    console.error('Failed to initialize offline features:', error);
  }
};

// Initialize offline features
initOfflineFeatures();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </React.StrictMode>,
);