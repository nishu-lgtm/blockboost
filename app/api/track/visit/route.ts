/**
 * POST /api/track/visit
 *
 * Public unauthenticated endpoint. Called by public/track.js after the user
 * has installed the snippet on their site. We re-validate the originating
 * User-Agent server-side (the client snippet can lie — never trust its
 * self-reported botName), dedupe by (projectId, botName, url, day), and
 * insert one AiBotVisit row.
 *
 * Returns 204 No Content on success — no body, no CORS preflight needed
 * for image-pixel fallback. We support both POST (preferred, fetch) and
 * GET (image-pixel fallback for CSP-strict sites).
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

// One process-shared salt so hashes are stable across requests but not
// derivable by callers. Falls back to a constant in dev — never the
// empty string (which would let an attacker rainbow-table the IP space).
const IP_SALT = process.env.IP_HASH_SALT ?? "blockboost-dev-salt-2026";

export const dynamic = "force-dynamic"; // never cache visit ingest

async function handle(projectId: string, url: string, req: Request): Promise<Response> {
  const ua = req.headers.get("user-agent") ?? "";
  const botName = classifyUserAgent(ua);

  // Drop non-bot traffic at the door — never persist a row for it.
  if (!botName) return new NextResponse(null, { status: 204 });

  // Rate limit per IP — protects against a malicious site spamming our
  // ingest with fabricated visits. 600/IP/hour is generous for any real
  // crawler workload but kills spammers.
  const ip = clientIp(req);
  const limited = rateLimit(`track-visit:${ip}`, 600, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  // Verify project exists. Cheap because projectId is the PK; fail-soft
  // (no error to client — never leak project existence).
  const projectExists = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!projectExists) return new NextResponse(null, { status: 204 });

  const dedupeKey = buildDedupeKey({ projectId, botName, url });

  // Upsert via createMany({skipDuplicates}) leveraging the @@unique
  // constraint. This is the cleanest race-free insert pattern Prisma offers.
  try {
    await prisma.aiBotVisit.createMany({
      data: [
        {
          projectId,
          botName,
          userAgent: ua.slice(0, 2000), // hard cap on stored UA size
          url: url.slice(0, 2048),
          ipHash: hashIp(ip, IP_SALT),
          dedupeKey,
        },
      ],
      skipDuplicates: true,
    });
  } catch (err) {
    logSafeError("[track/visit] insert failed", err);
    // Still return 204 — never let a 5xx propagate to the customer's site
    // where it would appear in their browser console.
  }

  return new NextResponse(null, { status: 204 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  return handle(parsed.data.projectId, parsed.data.url, req);
}

// Image-pixel fallback: GET /api/track/visit?p=<projectId>&u=<url>
// For sites with strict CSP that block fetch but allow <img>.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const projectId = u.searchParams.get("p") ?? "";
  const url = u.searchParams.get("u") ?? "";
  const parsed = bodySchema.safeParse({ projectId, url });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }
  return handle(parsed.data.projectId, parsed.data.url, req);
}
