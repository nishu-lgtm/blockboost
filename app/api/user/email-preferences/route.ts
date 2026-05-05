import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  emailPrefWeeklyReport: z.boolean().optional(),
  emailPrefMonthlySummary: z.boolean().optional(),
  emailPrefFeatureNews: z.boolean().optional(),
  emailPrefAlerts: z.boolean().optional(),
  emailPrefTips: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: {
      emailPrefWeeklyReport: true,
      emailPrefMonthlySummary: true,
      emailPrefFeatureNews: true,
      emailPrefAlerts: true,
      emailPrefTips: true,
    },
  });

  return NextResponse.json(updated);
}
