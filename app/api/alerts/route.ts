import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AlertType } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/alerts — list alerts with optional filters
// Query params:
//   limit    = number (default 50, max 100)
//   unread   = "true" to filter unread only
//   type     = AlertType enum value
//   projectId = filter by project
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
    const unreadOnly = searchParams.get("unread") === "true";
    const typeFilter = searchParams.get("type") as AlertType | null;
    const projectId = searchParams.get("projectId");

    const alerts = await prisma.alert.findMany({
      where: {
        userId: session.user.id,
        ...(unreadOnly ? { read: false } : {}),
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: { select: { id: true, name: true, brandName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("[alerts] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/alerts — mark all as read (optional: filter by projectId)
// ---------------------------------------------------------------------------

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = await req.json().catch(() => ({}));
    const projectId = typeof raw?.projectId === "string" && /^c[a-z0-9]{20,}$/.test(raw.projectId)
      ? raw.projectId : undefined;

    await prisma.alert.updateMany({
      where: {
        userId: session.user.id,
        read: false,
        ...(projectId ? { projectId } : {}),
      },
      data: { read: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[alerts] PATCH error:", error);
    return NextResponse.json({ error: "Failed to mark alerts as read" }, { status: 500 });
  }
}
