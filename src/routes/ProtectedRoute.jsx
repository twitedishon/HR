// src/routes/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

const AUTH_KEY = "HRMSS_AUTH_SESSION";

function readAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ProtectedRoute({ allow = [], redirectTo = "/login", children }) {
  const sess = readAuth();
  const role = String(sess?.loginRole || sess?.role || "").trim().toLowerCase();

  const isLoggedIn = Boolean(sess?.isLoggedIn || sess?.loggedIn || sess?.loginOk);

  const ok = isLoggedIn && (allow.length ? allow.includes(role) : true);

  if (!ok) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
