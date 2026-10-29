import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// hales.ai/cupcake/robyn: standalone read-only coach view (viewer token only, no Cupcake password).
// It renders outside App so it never mounts the owner app, chat, or unlock flow.
const isRobynView = /^\/cupcake\/robyn\/?$/.test(window.location.pathname);
const RobynPage = lazy(() => import('./pages/cupcake/robyn/page.tsx'));
// App is loaded only off the Robyn route, so the coach view never downloads the public site (framer-motion, three.js).
const App = lazy(() => import('./App.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{isRobynView ? <RobynPage /> : <App />}</Suspense>
  </StrictMode>
);
