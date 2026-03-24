"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Moon, Sun, UserCircle2 } from "lucide-react";
import { useTheme } from "next-themes";
import {
  clearAuthSession,
  getAuthSession,
  type AuthSession,
} from "@/lib/auth-client";
import { Logo } from "@/components/logo";

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Blueprint", href: "/Dashboard/blueprint" },
  { name: "Studio", href: "/Dashboard/canvas" },
  { name: "Audit", href: "/Dashboard/audit" },
];

export function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const { setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    setSession(getAuthSession());

    const onStorage = () => setSession(getAuthSession());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const initials = useMemo(() => {
    const base = session?.user?.displayName || session?.user?.email || "U";
    const parts = base.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return base.slice(0, 2).toUpperCase();
  }, [session]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // fall through and clear local session anyway
    }
    clearAuthSession();
    setSession(null);
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-background/70 py-3 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/95 px-4 shadow-sm sm:px-5">
          <Link href="/" aria-label="EasySchema home" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-5 md:flex lg:gap-7">
            {navLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={
                    active
                      ? "text-foreground text-sm font-medium"
                      : "text-muted-foreground text-sm hover:text-foreground"
                  }
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {mounted && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Toggle theme"
                    className="h-9 w-9 rounded-full"
                  >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTheme("light")}>
                    Light
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")}>
                    Dark
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")}>
                    System
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {!session && (
              <>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="hidden rounded-full sm:inline-flex"
                >
                  <Link href="/login">Log In</Link>
                </Button>
                <Button asChild size="sm" className="rounded-full px-4">
                  <Link href="/register">Start Free</Link>
                </Button>
              </>
            )}

            {session && (
              <>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="hidden rounded-full sm:inline-flex"
                >
                  <Link href="/Dashboard/blueprint">New Blueprint</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="hidden rounded-full sm:inline-flex"
                >
                  <Link href="/Dashboard/canvas">Open Studio</Link>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-xs font-semibold"
                      aria-label="Account menu"
                    >
                      {initials}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <UserCircle2 className="h-4 w-4" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {session.user.displayName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {session.user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/account/settings">Account Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/Dashboard/blueprint">Blueprint</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/Dashboard/canvas">Studio</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/Dashboard/audit">Audit</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
