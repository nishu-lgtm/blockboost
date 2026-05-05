import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const GET = adminRoute("ADMIN", async () => {
  const admins = await prisma.user.findMany({
    where: { adminRole: { not: "NONE" } },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      adminRole: true,
      updatedAt: true,
      totpEnabled: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ admins });
});
