// Simple in-memory rate limiter
// Stores IP/session -> request count + reset time
// Auto-cleans expired entries every 5 minutes

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

export function getIP(req: any): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

export async function rateLimit(
  identifier: string,
  options: { limit: number; windowMs: number }
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now()
  const entry = store.get(identifier)

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(identifier, {
      count: 1,
      resetAt: now + options.windowMs,
    })
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetAt: now + options.windowMs,
    }
  }

  // Within window
  const allowed = entry.count < options.limit
  if (allowed) {
    entry.count++
  }

  return {
    allowed,
    remaining: Math.max(0, options.limit - entry.count),
    resetAt: entry.resetAt,
  }
}
