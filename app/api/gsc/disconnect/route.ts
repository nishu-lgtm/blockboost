import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        gscAccessToken: null,
        gscRefreshToken: null,
        gscTokenExpiry: null,
        gscConnected: false,
        gscProperty: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[gsc/disconnect] error:", error);
    return NextResponse.json({ error: "Failed to disconnect GSC" }, { status: 500 });
  }
}
