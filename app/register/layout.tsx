import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/utils/auth";

export default async function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (token) {
    try {
      verifyToken(token);
      redirect("/Dashboard/blueprint");
    } catch {
      // invalid token; allow register page
    }
  }

  return <>{children}</>;
}
