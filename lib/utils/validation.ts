// ─── Input validation utilities ─────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export function validateEmail(email: unknown): ValidationError | null {
  if (typeof email !== "string" || !email.trim()) {
    return { field: "email", message: "Email is required" };
  }
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) {
    return { field: "email", message: "Invalid email format" };
  }
  if (email.length > 255) {
    return { field: "email", message: "Email must be ≤ 255 characters" };
  }
  return null;
}

export function validatePassword(password: unknown): ValidationError | null {
  if (typeof password !== "string" || !password) {
    return { field: "password", message: "Password is required" };
  }
  if (password.length < 6) {
    return {
      field: "password",
      message: "Password must be at least 6 characters",
    };
  }
  if (password.length > 128) {
    return { field: "password", message: "Password must be ≤ 128 characters" };
  }
  return null;
}

export function validateDisplayName(name: unknown): ValidationError | null {
  if (typeof name !== "string" || !name.trim()) {
    return { field: "displayName", message: "Display name is required" };
  }
  if (name.trim().length < 2) {
    return {
      field: "displayName",
      message: "Display name must be at least 2 characters",
    };
  }
  if (name.length > 100) {
    return {
      field: "displayName",
      message: "Display name must be ≤ 100 characters",
    };
  }
  return null;
}

export function validateProjectName(name: unknown): ValidationError | null {
  if (typeof name !== "string" || !name.trim()) {
    return { field: "name", message: "Project name is required" };
  }
  if (name.trim().length < 1) {
    return { field: "name", message: "Project name cannot be empty" };
  }
  if (name.length > 200) {
    return { field: "name", message: "Project name must be ≤ 200 characters" };
  }
  return null;
}

export function validateUUID(
  value: unknown,
  field: string,
): ValidationError | null {
  if (typeof value !== "string") {
    return { field, message: `${field} must be a string` };
  }
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!re.test(value)) {
    return { field, message: `${field} must be a valid UUID` };
  }
  return null;
}

/** Collect all non-null errors from a list of validation checks */
export function collectErrors(
  ...checks: (ValidationError | null)[]
): ValidationError[] {
  return checks.filter((e): e is ValidationError => e !== null);
}
