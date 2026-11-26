import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

registerSW({ immediate: true });

if (typeof window !== 'undefined' && 'orientation' in window.screen) {
  const orientation = window.screen.orientation as ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>;
  };
  orientation.lock?.('portrait').catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);
