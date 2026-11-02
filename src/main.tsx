import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { CartProvider } from './cart/CartContext';
import { isConfigured } from './lib/supabase';
import SetupNotice from './pages/SetupNotice';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CartProvider>
        {isConfigured ? <App /> : <SetupNotice />}
      </CartProvider>
    </BrowserRouter>
  </StrictMode>,
);
