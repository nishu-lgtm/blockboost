import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const GET = adminRoute("VIEWER", async () => {
  const banners = await prisma.appBanner.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ banners });
});

export const POST = adminRoute("SUPPORT", async (req: NextRequest, { admin }) => {
  const body = (await req.json()) as {
    id?: string;
    message: string;
    type: string;
    ctaText?: string;
    ctaUrl?: string;
    audience: string;
    dismissable: boolean;
    active: boolean;
    startsAt?: string;
    endsAt?: string;
  };

  let banner;
  if (body.id) {
    banner = await prisma.appBanner.update({
      where: { id: body.id },
      data: {
        message: body.message,
        type: body.type,
        ctaText: body.ctaText,
        ctaUrl: body.ctaUrl,
        audience: body.audience,
        dismissable: body.dismissable,
        active: body.active,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      },
    });
    await logAudit({ adminUserId: admin.id, action: "UPDATE_BANNER", targetId: body.id });
  } else {
    banner = await prisma.appBanner.create({
      data: {
        message: body.message,
        type: body.type,
        ctaText: body.ctaText,
        ctaUrl: body.ctaUrl,
        audience: body.audience,
        dismissable: body.dismissable,
        active: body.active,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        createdBy: admin.id,
      },
    });
    await logAudit({ adminUserId: admin.id, action: "CREATE_BANNER", targetId: banner.id });
  }
  return NextResponse.json({ banner });
});
