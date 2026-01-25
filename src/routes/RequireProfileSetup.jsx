import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const AUTH_KEY = "HRMSS_AUTH_SESSION";
const COMPLETION_KEY = (role) => `hrmss.signin.completed.${role}`;

function readSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function RequireProfileSetup({ children }) {
  const location = useLocation();
  const session = readSession();

  // no login
  if (!session) return <Navigate to="/login" replace />;

  const role = session.role || session.loginRole || "employee";
  const done = localStorage.getItem(COMPLETION_KEY(role)) === "true";

  // profile not completed -> force sign-in setup
  if (!done) {
    const empId =
      role === "employee"
        ? (session.employee_id || session.identifier || session.id || "").trim()
        : "";

    return (
      <Navigate
        to="/sign-in"
        replace
        state={{
          role,
          redirectTo: location.pathname, // after finish, come back here
          empId,
        }}
      />
    );
  }

  return children;
}
