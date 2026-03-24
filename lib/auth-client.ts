export const AUTH_STORAGE_KEY = "easyschema_auth";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  createdAt?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed?.token || !parsed.user?.email) {
      return null;
    }

    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
