"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAuthSession } from "@/lib/auth-client";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as {
        token?: string;
        user?: {
          id: string;
          email: string;
          displayName: string;
          createdAt: string;
        };
        error?: string;
        errors?: string[];
      };

      if (!res.ok || !data.token || !data.user) {
        setError(data.error ?? data.errors?.[0] ?? "Login failed");
        return;
      }

      setAuthSession({ token: data.token, user: data.user });
      router.push("/Dashboard/blueprint");
      router.refresh();
    } catch {
      setError("Unable to sign in right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex min-h-[calc(100vh-4rem)] bg-zinc-50 px-4 py-16 md:py-24 dark:bg-transparent">
      <form
        onSubmit={onSubmit}
        className="bg-card m-auto h-fit w-full max-w-sm rounded-[calc(var(--radius)+.125rem)] border p-0.5 shadow-md dark:[--color-muted:var(--color-zinc-900)]"
      >
        <div className="p-8 pb-6">
          <div>
            <Link href="/" aria-label="go home">
              <LogoIcon />
            </Link>
            <h1 className="mb-1 mt-4 text-xl font-semibold">
              Sign In to EasySchema
            </h1>
            <p className="text-sm">Welcome back! Sign in to continue</p>
          </div>

          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="block text-sm">
                Email
              </Label>
              <Input
                type="email"
                required
                name="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-0.5">
              <Label htmlFor="pwd" className="text-sm">
                Password
              </Label>
              <Input
                type="password"
                required
                name="pwd"
                id="pwd"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full" disabled={loading}>
              {loading ? "Signing In..." : "Sign In"}
            </Button>
          </div>
        </div>

        <div className="bg-muted rounded-(--radius) border p-3">
          <p className="text-accent-foreground text-center text-sm">
            Don&apos;t have an account?
            <Button asChild variant="link" className="px-2">
              <Link href="/register">Create account</Link>
            </Button>
          </p>
        </div>
      </form>
    </section>
  );
}
