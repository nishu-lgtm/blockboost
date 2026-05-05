import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getGSCProperties,
  refreshAccessToken,
  isTokenExpired,
} from "@/lib/google-search-console";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        gscConnected: true,
        gscAccessToken: true,
        gscRefreshToken: true,
        gscTokenExpiry: true,
      },
    });

    if (!user?.gscConnected || !user.gscAccessToken) {
      return NextResponse.json({ error: "GSC not connected" }, { status: 400 });
    }

    let accessToken = user.gscAccessToken;

    // Auto-refresh if expired
    if (isTokenExpired(user.gscTokenExpiry) && user.gscRefreshToken) {
      const refreshed = await refreshAccessToken(user.gscRefreshToken);
      accessToken = refreshed.accessToken;
      await prisma.user.update({
        where: { id: session.user.id },
        data: { gscAccessToken: accessToken, gscTokenExpiry: refreshed.expiresAt },
      });
    }

    const properties = await getGSCProperties(accessToken);
    return NextResponse.json(properties);
  } catch (error) {
    console.error("[gsc/properties] error:", error);
    return NextResponse.json({ error: "Failed to fetch GSC properties" }, { status: 500 });
  }
}
