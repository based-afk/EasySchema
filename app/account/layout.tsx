import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/utils/auth";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    verifyToken(token);
  } catch {
    redirect("/login");
  }

  return <>{children}</>;
}
