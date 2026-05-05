import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  const projectCount = await prisma.project.count({
    where: { userId: session.user!.id! },
  });

  if (projectCount === 0) {
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen overflow-auto">
        {children}
      </div>
    </div>
  );
}
