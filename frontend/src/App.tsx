import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import './App.css';

/**
 * Component that updates the document title based on environment and current route.
 * @internal
 */
export function TitleUpdater() {
  const location = useLocation();
  const isAdminPage = location.pathname === '/admin';

  useEffect(() => {
    // Set window title based on environment and page
    // Check globalThis first for test compatibility, then fall back to import.meta.env
    const isDev = (globalThis as any).import?.meta?.env?.DEV ?? import.meta.env.DEV;

    if (isAdminPage) {
      if (isDev) {
        document.title = 'Habitus [DEV-ADMIN]';
      } else {
        document.title = 'Habitus [PROD-ADMIN]';
      }
    } else {
      if (isDev) {
        document.title = 'Habitus [DEV]';
      } else {
        document.title = 'Habitus';
      }
    }
  }, [isAdminPage]);

  return null;
}

/**
 * Main application component acting as the Router provider.
 * @public
 */
function App() {
  return (
    <BrowserRouter>
      <TitleUpdater />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
