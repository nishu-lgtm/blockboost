import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/dashboard/sidebar";
import { EmailVerificationBanner } from "@/components/dashboard/email-verification-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  const userId = session.user!.id!;

  const [projectCount, user] = await Promise.all([
    prisma.project.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    }),
  ]);

  if (projectCount === 0) {
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen overflow-auto">
        <EmailVerificationBanner emailVerified={!!user?.emailVerified} />
        {children}
      </div>
    </div>
  );
}
