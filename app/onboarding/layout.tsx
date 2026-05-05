import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/login");
  }

  // If the user already has projects, send them to the dashboard
  const projectCount = await prisma.project.count({
    where: { userId: session.user!.id! },
  });

  if (projectCount > 0) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
