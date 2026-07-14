import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";
import { SignOutButton } from "@/components/SignOutButton";
import type { Role } from "@/lib/types/db";

const HOME_BY_ROLE: Record<Role, string> = {
  admin: "/admin",
  teacher: "/teacher/dashboard",
  student: "/student/dashboard",
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const home = HOME_BY_ROLE[session.profile.role] ?? "/";

  return (
    <div className="flex min-h-full flex-1 flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href={home} className="font-semibold text-gray-900">
            과제 채점 도우미
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{session.profile.display_name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
