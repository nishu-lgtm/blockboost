import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SocialOpportunityStatus } from "@prisma/client";
import { z } from "zod";

const patchSchema = z.object({
  status: z.nativeEnum(SocialOpportunityStatus).optional(),
  snoozeDays: z.number().min(1).max(30).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { opportunityId } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Verify ownership
  const opp = await prisma.socialOpportunity.findFirst({
    where: {
      id: opportunityId,
      project: { userId: session.user.id },
    },
  });
  if (!opp) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status) {
    updateData.status = parsed.data.status;
    if (parsed.data.status === "REPLIED") {
      updateData.repliedAt = new Date();
    }
  }
  if (parsed.data.snoozeDays) {
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + parsed.data.snoozeDays);
    updateData.status = "SNOOZED";
    updateData.snoozedUntil = snoozedUntil;
  }

  const updated = await prisma.socialOpportunity.update({
    where: { id: opportunityId },
    data: updateData,
  });

  return NextResponse.json(updated);
}
