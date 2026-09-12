import {
  findInvalidTrustedProxies,
  getIPFromHeader,
  isValidIP,
} from "@better-auth/core/utils/ip";

export function trustedProxiesFromEnv(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.TRUST_PROXY !== "true") return [];
  const proxies = (env.TRUSTED_PROXY_CIDRS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!proxies.length || findInvalidTrustedProxies(proxies).length)
    throw new Error(
      "TRUST_PROXY=true requires valid TRUSTED_PROXY_CIDRS (comma-separated ingress IPs/CIDRs)",
    );
  return proxies;
}
export function resolveClientIP(
  socketIP: string | undefined,
  forwarded: string | null,
  proxies: string[],
): string | null {
  if (!socketIP || !isValidIP(socketIP)) return null;
  if (!proxies.length) return getIPFromHeader(socketIP, { ipv6Subnet: 64 });
  // The actual socket peer anchors the chain. An untrusted direct caller's
  // forwarded headers are ignored, even when it spoofs a trusted proxy IP.
  return getIPFromHeader(`${forwarded ?? ""},${socketIP}`, {
    trustedProxies: proxies,
    ipv6Subnet: 64,
  });
}
