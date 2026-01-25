// src/components/GlobalLoader.jsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Preloader from "./Preloader";

/**
 * Global page transition loader
 * Shows a brief loading animation when navigating between routes
 */
export default function GlobalLoader() {
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Show loader on route change
    setLoading(true);

    // Hide loader after a brief delay (simulates page load)
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300); // Adjust timing as needed

    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (!loading) return null;

  return <Preloader variant="page" message="Loading" />;
}
