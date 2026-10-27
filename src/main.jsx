import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import { locales } from './marketing/locales.js';
import './styles/marketing.css';

const locale = document.documentElement.lang;
if (!Object.hasOwn(locales, locale)) throw new Error('Unsupported marketing locale');
const root = document.getElementById('root');
const app = <StrictMode><App locale={locale}/></StrictMode>;
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);

// Update only the known legacy registration. New visitors acquire no worker.
if ('serviceWorker' in navigator) window.addEventListener('load', async () => {
  try {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      const worker = registration.active || registration.waiting || registration.installing;
      if (worker && new URL(worker.scriptURL).origin === location.origin && new URL(worker.scriptURL).pathname === '/sw.js' && registration.scope === `${location.origin}/`) await registration.update();
    }
  } catch { /* The browser retries retirement through its normal update lifecycle. */ }
}, { once: true });
