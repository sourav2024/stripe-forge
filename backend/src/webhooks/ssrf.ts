import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { env } from '../config/env';
import { BadRequestError } from '../utils/AppError';

// SSRF guard for merchant-supplied webhook URLs. A webhook URL is fully
// attacker-controlled, so without this a merchant could point an endpoint at
// internal infrastructure (the DB, Redis, cloud metadata) and coerce our server
// into making requests to it.
//
// WHY this is called in TWO places (registerEndpoint/updateEndpoint AND at
// delivery time): registration-time validation alone is defeated by DNS
// rebinding / re-pointing DNS after registration — a host that resolved to a
// public IP when registered can later resolve to 169.254.169.254. Re-checking
// immediately before the fetch closes that window.

// Hostnames that are never allowed regardless of DNS resolution.
const BLOCKED_HOST_NAMES = new Set([
  'localhost',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // cloud instance metadata (AWS/GCP/Azure/OpenStack)
  'metadata.google.internal',
]);

function isBlockedHostName(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOST_NAMES.has(h)) return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  return false;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable -> treat as unsafe
  const inRange = (base: string, bits: number): boolean => {
    const baseInt = ipv4ToInt(base);
    if (baseInt === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (baseInt & mask);
  };
  return (
    inRange('0.0.0.0', 8) || // "this" network
    inRange('10.0.0.0', 8) || // private
    inRange('100.64.0.0', 10) || // carrier-grade NAT
    inRange('127.0.0.0', 8) || // loopback
    inRange('169.254.0.0', 16) || // link-local (incl. metadata)
    inRange('172.16.0.0', 12) || // private
    inRange('192.168.0.0', 16) // private
  );
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0]; // strip zone id
  if (addr === '::1' || addr === '::') return true;

  // IPv4-mapped (::ffff:a.b.c.d) — the effective destination is the mapped v4,
  // so validate that instead.
  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIPv4(mapped[1]);

  const firstHextet = parseInt(addr.split(':')[0] || '0', 16);
  // fc00::/7 unique local address
  if ((firstHextet & 0xfe00) === 0xfc00) return true;
  // fe80::/10 link-local
  if ((firstHextet & 0xffc0) === 0xfe80) return true;
  return false;
}

function isPrivateIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // not a valid IP literal -> unsafe
}

export async function assertSafeWebhookUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestError('webhook_url_not_allowed');
  }

  const protocol = url.protocol;
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new BadRequestError('webhook_url_not_allowed');
  }
  // Plaintext http is forbidden in production — a signed webhook over http can
  // be read/altered in transit.
  if (env.isProd && protocol !== 'https:') {
    throw new BadRequestError('webhook_url_not_allowed');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  if (isBlockedHostName(hostname)) {
    throw new BadRequestError('webhook_url_not_allowed');
  }

  // If the host is already an IP literal, validate it directly (DNS lookup on a
  // literal still works but this avoids a needless resolve).
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new BadRequestError('webhook_url_not_allowed');
    return;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new BadRequestError('webhook_url_unresolvable');
  }

  if (addresses.length === 0) {
    throw new BadRequestError('webhook_url_unresolvable');
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new BadRequestError('webhook_url_not_allowed');
    }
  }
}
