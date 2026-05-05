import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/alerts/[alertId]/read — mark single alert as read

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { alertId } = await params;

    await prisma.alert.updateMany({
      where: {
        id: alertId,
        userId: session.user.id, // ensure ownership
      },
      data: { read: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[alerts/read] PATCH error:", error);
    return NextResponse.json({ error: "Failed to mark alert as read" }, { status: 500 });
  }
}
