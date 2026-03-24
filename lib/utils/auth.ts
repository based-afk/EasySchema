import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback_dev_secret";
const SALT_ROUNDS = 10;
export const AUTH_COOKIE_NAME = "easyschema_token";

// ─── Token payload ──────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  email: string;
}

// ─── Password helpers ───────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── JWT helpers ────────────────────────────────────────────────────────────

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// ─── Extract token from Authorization header ────────────────────────────────

export function extractToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function extractTokenFromCookie(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const tokenPair = parts.find((part) =>
    part.startsWith(`${AUTH_COOKIE_NAME}=`),
  );
  if (!tokenPair) return null;
  return decodeURIComponent(tokenPair.slice(`${AUTH_COOKIE_NAME}=`.length));
}

// ─── Single helper: parse + verify from request ─────────────────────────────

export function authenticateRequest(
  authHeader: string | null,
  cookieHeader?: string | null,
): JwtPayload | null {
  const token =
    extractToken(authHeader) ?? extractTokenFromCookie(cookieHeader ?? null);
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}
