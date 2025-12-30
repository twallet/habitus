import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import './App.css';

/**
 * Component that updates the document title based on environment and current route.
 * @internal
 */
function TitleUpdater() {
  const location = useLocation();
  const isAdminPage = location.pathname === '/admin';

  useEffect(() => {
    // Set window title based on environment and page
    if (isAdminPage) {
      if (import.meta.env.DEV) {
        document.title = 'Habitus [DEV-ADMIN]';
      } else {
        document.title = 'Habitus [PROD-ADMIN]';
      }
    } else {
      if (import.meta.env.DEV) {
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
