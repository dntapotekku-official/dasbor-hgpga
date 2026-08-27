"use client";

import { createContext, useContext, useMemo } from "react";

import { normalizeRole } from "@/lib/role";

const AuthContext = createContext(null);

export function AuthProvider({ user, children }) {
  const value = useMemo(() => {
    const current_user = user ?? null;

    return {
      user: current_user,
      role: normalizeRole(current_user?.role ?? ""),
      is_authenticated: Boolean(current_user),
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
