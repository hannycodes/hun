import { useEffect, useRef } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import MenuPage from './pages/MenuPage';
import CheckoutPage from './pages/CheckoutPage';
import PayPage from './pages/PayPage';
import OrderStatusPage from './pages/OrderStatusPage';
import SignInPage from './pages/SignInPage';

/**
 * React Router's client-side navigation does not scroll by itself: hash links
 * such as "/#story" would change the URL but leave the viewport where it was.
 * This follows the hash once the destination page has rendered, and otherwise
 * returns to the top on a route change.
 */
function ScrollToHash() {
  const { pathname, hash } = useLocation();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    const pathChanged = previousPath.current !== pathname;
    previousPath.current = pathname;

    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      return;
    }

    const id = decodeURIComponent(hash.slice(1));
    const align = (behavior: ScrollBehavior) => {
      document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' });
    };

    // Two frames let the newly routed page mount before we measure it. A new
    // page lands directly on the section; the same page glides to it.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => align(pathChanged ? 'instant' : 'smooth'));
    });

    // Content above the anchor can gain height after the first paint (the
    // featured menu is fetched asynchronously). Re-pin the target whenever the
    // document grows, then stop once the layout has been quiet for a moment.
    let lastHeight = document.documentElement.scrollHeight;
    let lastChange = performance.now();
    const watch = window.setInterval(() => {
      const height = document.documentElement.scrollHeight;
      if (Math.abs(height - lastHeight) > 2) {
        lastHeight = height;
        lastChange = performance.now();
        align('instant');
      } else if (performance.now() - lastChange > 1200) {
        window.clearInterval(watch);
      }
    }, 150);
    const stopWatching = window.setTimeout(() => window.clearInterval(watch), 10000);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(watch);
      window.clearTimeout(stopWatching);
    };
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <>
      <ScrollToHash />
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
    </>
  );
}
