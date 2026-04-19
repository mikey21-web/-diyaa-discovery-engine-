import type { NextApiRequest } from 'next'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

type RateLimitResult = { allowed: boolean; remaining: number }

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

async function rateLimitWithUpstash(
  key: string,
  options: { limit: number; windowMs: number }
): Promise<RateLimitResult | null> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null

  const endpoint = `${UPSTASH_URL}/pipeline`
  const commands = [
    ['INCR', key],
    ['PEXPIRE', key, options.windowMs, 'NX'],
  ]

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as Array<{ result?: number }>
  const count = Number(payload?.[0]?.result || 0)

  if (!count) return null

  if (count > options.limit) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: options.limit - count }
}

export async function rateLimit(
  ip: string,
  options: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  const upstashKey = `ratelimit:${ip}:${options.windowMs}`
  const distributed = await rateLimitWithUpstash(upstashKey, options)

  if (distributed) {
    return distributed
  }

  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1 };
  }

  if (record.count >= options.limit) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: options.limit - record.count };
}

export function getIP(req: NextApiRequest): string {
  const forwardedFor = req.headers['x-forwarded-for']
  const forwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  const realIp = req.headers['x-real-ip']
  const real = Array.isArray(realIp) ? realIp[0] : realIp

  return (
    forwarded?.split(',')[0]?.trim() ||
    real ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}
