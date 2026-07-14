import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/getSession";

export default async function HomePage() {
  const session = await getSession();

  if (!session) redirect("/login");
  if (session.profile.role === "admin") redirect("/admin");
  redirect(session.profile.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
}
