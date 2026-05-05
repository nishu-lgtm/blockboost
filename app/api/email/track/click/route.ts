import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const url = searchParams.get("url");

  if (id) {
    try {
      await prisma.emailSent.updateMany({
        where: { id, clickedAt: null },
        data: { clickedAt: new Date() },
      });
    } catch {
      // Best-effort
    }
  }

  const destination = url ?? "/";

  // Basic allowlist: only redirect to our own domain or relative paths
  const APP_URL = process.env.NEXTAUTH_URL ?? "https://blockboost.co";
  const safeUrl = (() => {
    try {
      const parsed = new URL(destination, APP_URL);
      const appHost = new URL(APP_URL).hostname;
      if (parsed.hostname === appHost) return parsed.toString();
    } catch {
      // fall through
    }
    return APP_URL;
  })();

  return NextResponse.redirect(safeUrl, { status: 302 });
}
