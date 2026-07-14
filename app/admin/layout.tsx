import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("admin");

  return (
    <div className="flex min-h-full flex-1 flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <nav className="flex items-center gap-6">
            <Link href="/admin" className="font-semibold text-gray-900">
              과제 채점 도우미 · 관리자
            </Link>
            <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
              교사 관리
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/account" className="text-sm text-gray-600 hover:text-gray-900">
              {session.profile.display_name} 관리자
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
