import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import './App.css';

/**
 * Main application component acting as the Router provider.
 * @public
 */
function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
