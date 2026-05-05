import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  status: z.enum(["PENDING", "GENERATED", "PUBLISHED"]),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ briefId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { briefId } = await params;

    const brief = await prisma.contentBrief.findFirst({
      where: { id: briefId },
      include: { project: { select: { userId: true } } },
    });
    if (!brief || brief.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updated = await prisma.contentBrief.update({
      where: { id: briefId },
      data: { status: parsed.data.status },
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error) {
    console.error("Brief status update error:", error);
    return NextResponse.json({ error: "Failed to update status." }, { status: 500 });
  }
}
