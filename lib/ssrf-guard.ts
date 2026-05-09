/**
 * SSRF protection for endpoints that fetch user-supplied URLs.
 *
 * Used by:
 *   - /api/audit/public  (anonymous quick audit)
 *   - /api/audit/run     (authenticated full audit)
 *
 * Blocks requests to:
 *   - Private IP ranges (RFC 1918, loopback, link-local, ULA)
 *   - Cloud metadata endpoints (AWS, GCP, Azure)
 *   - Non-http(s) schemes
 *
 * Resolves the hostname to an IP and verifies it's not private. This
 * defends against DNS rebinding (use-once-then-redirect-to-internal) only
 * if combined with `redirect: "manual"` / per-redirect re-validation.
 */
import { lookup } from "dns/promises";

// IPv4 ranges
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  return (
    a === 10 || // 10.0.0.0/8
    a === 127 || // 127.0.0.0/8 loopback
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local + AWS metadata
    a === 0 || // 0.0.0.0/8
    a >= 224 // multicast + reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const lc = ip.toLowerCase();
  return (
    lc === "::1" ||
    lc.startsWith("fc") || // ULA
    lc.startsWith("fd") ||
    lc.startsWith("fe80") || // link-local
    lc.startsWith("::ffff:127.") ||
    lc.startsWith("::ffff:10.") ||
    lc.startsWith("::ffff:192.168.") ||
    lc.startsWith("::ffff:169.254.")
  );
}

// Cloud metadata endpoints — block by hostname even if they happen to be public
const METADATA_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.azure.com",
]);

export interface SsrfCheckResult {
  ok: boolean;
  reason?: string;
  resolvedIp?: string;
}

export async function checkSsrf(rawUrl: string): Promise<SsrfCheckResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Malformed URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http(s) URLs are allowed" };
  }

  const host = url.hostname.toLowerCase();
  if (METADATA_HOSTS.has(host)) {
    return { ok: false, reason: "Internal metadata endpoint is not reachable" };
  }
  if (host === "localhost") {
    return { ok: false, reason: "localhost is not reachable from this service" };
  }

  // If hostname is a literal IP, validate directly.
  if (/^[\d.]+$/.test(host) && isPrivateIPv4(host)) {
    return { ok: false, reason: "Private IPv4 address is not reachable" };
  }
  if (/[:]/.test(host) && isPrivateIPv6(host)) {
    return { ok: false, reason: "Private IPv6 address is not reachable" };
  }

  // Otherwise resolve DNS and check the resulting IP.
  try {
    const { address } = await lookup(host);
    if (METADATA_HOSTS.has(address)) {
      return { ok: false, reason: "URL resolves to a metadata endpoint" };
    }
    if (address.includes(".") && isPrivateIPv4(address)) {
      return { ok: false, reason: "URL resolves to a private IP" };
    }
    if (address.includes(":") && isPrivateIPv6(address)) {
      return { ok: false, reason: "URL resolves to a private IPv6" };
    }
    return { ok: true, resolvedIp: address };
  } catch (err) {
    return {
      ok: false,
      reason: `DNS lookup failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Wrapper around fetch() that performs an SSRF check first AND uses
 * `redirect: "manual"` so we re-validate any 30x redirect target. Use this
 * instead of bare fetch() for any user-supplied URL.
 */
export async function safeFetch(
  rawUrl: string,
  init?: RequestInit & { maxRedirects?: number }
): Promise<Response> {
  let currentUrl = rawUrl;
  const maxRedirects = init?.maxRedirects ?? 3;

  for (let i = 0; i <= maxRedirects; i++) {
    const check = await checkSsrf(currentUrl);
    if (!check.ok) {
      throw new Error(`SSRF blocked: ${check.reason}`);
    }

    const res = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return res;
      currentUrl = new URL(next, currentUrl).toString();
      continue;
    }
    return res;
  }
  throw new Error("SSRF blocked: too many redirects");
}
