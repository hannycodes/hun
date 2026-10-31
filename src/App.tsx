import { Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import MenuPage from './pages/MenuPage';
import CheckoutPage from './pages/CheckoutPage';
import PayPage from './pages/PayPage';
import OrderStatusPage from './pages/OrderStatusPage';
import SignInPage from './pages/SignInPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/pay/:token" element={<PayPage />} />
      <Route path="/order/:token" element={<OrderStatusPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}
