import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { verifyPassword, signToken, AUTH_COOKIE_NAME } from "@/lib/utils/auth";
import {
  validateEmail,
  validatePassword,
  collectErrors,
} from "@/lib/utils/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Validate inputs
    const errors = collectErrors(
      validateEmail(email),
      validatePassword(password),
    );
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Look up user
    const user = await queryOne<{
      id: string;
      email: string;
      password_hash: string;
      display_name: string;
      created_at: string;
    }>(
      "SELECT id, email, password_hash, display_name, created_at FROM users WHERE email = $1",
      [email.toLowerCase().trim()],
    );

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    // Sign JWT
    const token = signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        createdAt: user.created_at,
      },
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
