import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// hales.ai/cupcake/robyn: standalone read-only coach view (viewer token only, no Cupcake password).
// It renders outside App so it never mounts the owner app, chat, or unlock flow.
const isRobynView = /^\/cupcake\/robyn\/?$/.test(window.location.pathname);
const RobynPage = lazy(() => import('./pages/cupcake/robyn/page.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isRobynView ? <Suspense fallback={null}><RobynPage /></Suspense> : <App />}
  </StrictMode>
);
