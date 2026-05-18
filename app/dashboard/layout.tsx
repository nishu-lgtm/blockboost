import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/dashboard/sidebar";
import { EmailVerificationBanner } from "@/components/dashboard/email-verification-banner";
import { ScanStatusBanner } from "@/components/dashboard/scan-status-banner";

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

  const [user, firstProject] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    }),
    // Single source of truth for "the current project" — first by createdAt
    // matches what the rest of the dashboard renders. Used by the scan
    // status banner so it tracks the same project the user sees.
    prisma.project.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
  ]);

  if (!firstProject) {
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen overflow-auto">
        <EmailVerificationBanner emailVerified={!!user?.emailVerified} />
        <div className="px-4 md:px-6 pt-4">
          <ScanStatusBanner projectId={firstProject.id} />
        </div>
        {children}
      </div>
    </div>
  );
}
