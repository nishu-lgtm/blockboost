/**
 * POST /api/track/visit  (preferred — fetch from track.js or server-side call)
 * GET  /api/track/visit  (pixel fallback for CSP-strict browsers)
 *
 * Public unauthenticated endpoint. Accepts visits from:
 *   a) track.js JS snippet running in JS-rendering AI bots (ChatGPT browsing, etc.)
 *   b) customer's own server middleware forwarding the real request UA + URL
 *      (recommended — captures non-JS crawlers like GPTBot, ClaudeBot, CCBot)
 *
 * The server re-classifies the UA regardless of source. Dedupes by
 * (projectId, botName, url, day) and inserts one AiBotVisit row.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { classifyUserAgent, buildDedupeKey, hashIp } from "@/lib/bot-detector";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logSafeError } from "@/lib/safe-error";

const bodySchema = z.object({
  projectId: z.string().min(1).max(64),
  url: z.string().min(1).max(2048),
});

const IP_SALT = process.env.IP_HASH_SALT ?? "blockboost-dev-salt-2026";

// CORS: this endpoint is called cross-origin from customer sites and their
// server middleware. Wildcard origin is safe — we store no cookies, never
// read session data, and all writes are keyed to a projectId we validate.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const dynamic = "force-dynamic";

// Preflight — browsers send this before the actual POST from track.js.
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function handle(projectId: string, url: string, req: Request): Promise<Response> {
  const ua = req.headers.get("user-agent") ?? "";
  const botName = classifyUserAgent(ua);

  if (!botName) return new NextResponse(null, { status: 204, headers: CORS_HEADERS });

  const ip = clientIp(req);
  const limited = rateLimit(`track-visit:${ip}`, 600, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter), ...CORS_HEADERS } }
    );
  }

  const projectExists = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!projectExists) return new NextResponse(null, { status: 204, headers: CORS_HEADERS });

  const dedupeKey = buildDedupeKey({ projectId, botName, url });

  try {
    await prisma.aiBotVisit.createMany({
      data: [
        {
          projectId,
          botName,
          userAgent: ua.slice(0, 2000),
          url: url.slice(0, 2048),
          ipHash: hashIp(ip, IP_SALT),
          dedupeKey,
        },
      ],
      skipDuplicates: true,
    });
  } catch (err) {
    logSafeError("[track/visit] insert failed", err);
  }

  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: CORS_HEADERS });
  }
  return handle(parsed.data.projectId, parsed.data.url, req);
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const projectId = u.searchParams.get("p") ?? "";
  const url = u.searchParams.get("u") ?? "";
  const parsed = bodySchema.safeParse({ projectId, url });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400, headers: CORS_HEADERS });
  }
  return handle(parsed.data.projectId, parsed.data.url, req);
}
