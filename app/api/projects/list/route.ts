import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        plan: true,
        projects: {
          select: { id: true, name: true, brandName: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const projects = (user?.projects ?? []).map((p) => ({
      ...p,
      userPlan: user?.plan ?? "FREE",
    }));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Projects list error:", error);
    return NextResponse.json({ error: "Failed to load projects." }, { status: 500 });
  }
}
