import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Topbar from "@/components/dashboard/topbar";
import { EntityList } from "@/components/entities/entity-list";

export default async function EntitiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const project = await prisma.project.findFirst({
    where: { userId: session.user.id as string },
    orderBy: { createdAt: "desc" },
    select: { id: true, brandName: true },
  });

  return (
    <div className="flex flex-col flex-1">
      <Topbar
        title="Brand Knowledge"
        description="Extract and view brand entities — products, people, features, and their relationships"
      />
      <main className="flex-1 p-4 md:p-6">
        {!project ? (
          <div className="text-center py-20 text-slate-500">
            <p>No project found. Create a project to get started.</p>
          </div>
        ) : (
          <div className="max-w-2xl">
            <EntityList projectId={project.id} />
          </div>
        )}
      </main>
    </div>
  );
}
