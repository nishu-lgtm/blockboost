import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, brandName: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Projects list error:", error);
    return NextResponse.json({ error: "Failed to load projects." }, { status: 500 });
  }
}
