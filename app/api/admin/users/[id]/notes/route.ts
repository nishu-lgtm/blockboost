import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const POST = adminRoute("VIEWER", async (req: NextRequest, { admin, params }) => {
  const { id } = await params!;
  const { content } = (await req.json()) as { content: string };
  if (!content?.trim()) return NextResponse.json({ error: "Empty note" }, { status: 400 });

  const note = await prisma.adminNote.create({
    data: { userId: id, adminId: admin.id, content: content.trim() },
    include: { admin: { select: { name: true, email: true } } },
  });

  await logAudit({ adminUserId: admin.id, action: "ADD_NOTE", targetType: "user", targetId: id });
  return NextResponse.json({ note });
});
