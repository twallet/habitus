import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import './App.css';

/**
 * Main application component acting as the Router provider.
 * @public
 */
function App() {
  useEffect(() => {
    // Set window title based on environment
    if (import.meta.env.DEV) {
      document.title = '🌱 Habitus [DEV]';
    } else {
      document.title = 'Habitus';
    }
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
