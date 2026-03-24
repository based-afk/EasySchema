import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { hashPassword, signToken, AUTH_COOKIE_NAME } from "@/lib/utils/auth";
import {
  validateEmail,
  validatePassword,
  validateDisplayName,
  collectErrors,
} from "@/lib/utils/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, displayName } = body;

    // Validate inputs
    const errors = collectErrors(
      validateEmail(email),
      validatePassword(password),
      validateDisplayName(displayName),
    );
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Check if email already exists
    const existing = await queryOne("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase().trim(),
    ]);
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const user = await queryOne<{
      id: string;
      email: string;
      display_name: string;
      created_at: string;
    }>(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, created_at`,
      [email.toLowerCase().trim(), passwordHash, displayName.trim()],
    );

    if (!user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 },
      );
    }

    // Sign JWT
    const token = signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json(
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          createdAt: user.created_at,
        },
      },
      { status: 201 },
    );

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
