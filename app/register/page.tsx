"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAuthSession } from "@/lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
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
        setError(data.error ?? data.errors?.[0] ?? "Registration failed");
        return;
      }

      setAuthSession({ token: data.token, user: data.user });
      router.push("/Dashboard/blueprint");
      router.refresh();
    } catch {
      setError("Unable to register right now.");
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
              Create your EasySchema account
            </h1>
            <p className="text-sm">Sign up to start building in Studio</p>
          </div>

          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="block text-sm">
                Display Name
              </Label>
              <Input
                type="text"
                required
                name="displayName"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

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
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </div>
        </div>

        <div className="bg-muted rounded-(--radius) border p-3">
          <p className="text-accent-foreground text-center text-sm">
            Already have an account?
            <Button asChild variant="link" className="px-2">
              <Link href="/login">Sign in</Link>
            </Button>
          </p>
        </div>
      </form>
    </section>
  );
}
