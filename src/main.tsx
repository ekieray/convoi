import { createRoot } from 'react-dom/client';
import { APIProvider } from '@vis.gl/react-google-maps';
import App from './App.tsx';
import { FirestoreErrorBoundary } from './components/FirestoreErrorBoundary';
import './index.css';

// Tier 1: Global Google Maps Platform quota & auth failure listener
(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  origConsoleError.apply(console, args);
  const msg = args.map((a) => String(a)).join(' ');
  if (
    msg.includes('OverQuotaMapError') ||
    msg.includes('QuotaExceededError')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

createRoot(document.getElementById('root')!).render(
  <FirestoreErrorBoundary>
    {MAPS_API_KEY ? (
      <APIProvider
        apiKey={MAPS_API_KEY}
        language="id"
        region="ID"
        libraries={['routes', 'places', 'marker']}
      >
        <App />
      </APIProvider>
    ) : (
      <App />
    )}
  </FirestoreErrorBoundary>
);
