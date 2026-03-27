"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAuthSession,
  setAuthSession,
  type AuthSession,
} from "@/lib/auth-client";
import { getRtcDisplayNameOptional, setRtcDisplayName } from "@/lib/rtc/client";
import Link from "next/link";

export default function AccountSettingsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [rtcDisplayName, setRtcDisplayNameState] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rtcSaved, setRtcSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const current = getAuthSession();
    setSession(current);

    const hydrate = async () => {
      try {
        const res = await fetch("/api/account/settings", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          id: string;
          email: string;
          displayName: string;
          createdAt?: string;
        };

        const next: AuthSession | null = current
          ? {
              ...current,
              user: {
                ...current.user,
                id: data.id,
                email: data.email,
                displayName: data.displayName,
                createdAt: data.createdAt,
              },
            }
          : null;

        if (next) {
          setAuthSession(next);
          setSession(next);
          setDisplayName(next.user.displayName);
        }
      } catch {
        // no-op; local session fallback already set
      }
    };

    void hydrate();
    const rtcName = getRtcDisplayNameOptional();
    if (rtcName) setRtcDisplayNameState(rtcName);
  }, []);

  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session) return;

    setSaving(true);
    setSaved(false);
    setRtcSaved(false);
    setError(null);

    try {
      const res = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });

      const data = (await res.json()) as {
        id?: string;
        email?: string;
        displayName?: string;
        createdAt?: string;
        error?: string;
        errors?: string[];
      };

      if (!res.ok || !data.displayName || !data.email || !data.id) {
        setError(data.error ?? data.errors?.[0] ?? "Failed to update profile");
        return;
      }

      const nextSession: AuthSession = {
        ...session,
        user: {
          ...session.user,
          id: data.id,
          email: data.email,
          displayName: data.displayName,
          createdAt: data.createdAt ?? session.user.createdAt,
        },
      };

      setAuthSession(nextSession);
      setSession(nextSession);
      setSaved(true);
    } catch {
      setError("Unable to save profile right now.");
    } finally {
      setSaving(false);
    }
  };

  const onSaveRtcName = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = rtcDisplayName.trim();
    if (!next) return;
    setRtcDisplayName(next);
    window.dispatchEvent(new CustomEvent("rtc:name", { detail: next }));
    setRtcSaved(true);
    setTimeout(() => setRtcSaved(false), 2000);
  };

  if (!session) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center justify-center px-4">
        <div className="w-full rounded-xl border p-6 text-center">
          <h1 className="text-xl font-semibold">You are not logged in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access account settings.
          </p>
          <Button asChild className="mt-4">
            <Link href="/login">Go to Login</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-10">
      <div className="rounded-xl border bg-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile details used across EasySchema.
        </p>

        <form onSubmit={onSave} className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={session.user.email} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="memberSince">Member Since</Label>
            <Input
              id="memberSince"
              value={
                session.user.createdAt
                  ? new Date(session.user.createdAt).toLocaleDateString()
                  : "N/A"
              }
              disabled
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
            {saved && <span className="text-sm text-green-600">Saved</span>}
          </div>
        </form>

        <form onSubmit={onSaveRtcName} className="mt-8 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="rtcDisplayName">Collaboration Name</Label>
            <Input
              id="rtcDisplayName"
              value={rtcDisplayName}
              onChange={(e) => setRtcDisplayNameState(e.target.value)}
              placeholder="What should others see your name as?"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="outline">
              Save Collaboration Name
            </Button>
            {rtcSaved && <span className="text-sm text-green-600">Saved</span>}
          </div>
        </form>
      </div>
    </section>
  );
}
