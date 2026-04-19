// ========================================
// diyaa.ai — Logger Utility
// No console.log in production.
// ========================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const isDev = process.env.NODE_ENV !== 'production'

function formatTimestamp(): string {
  return new Date().toISOString()
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (!isDev && level === 'debug') return

  const entry = {
    timestamp: formatTimestamp(),
    level,
    message,
    ...(data ? { data } : {}),
  }

  switch (level) {
    case 'error':
      console.error(JSON.stringify(entry))
      break
    case 'warn':
      console.warn(JSON.stringify(entry))
      break
    default:
      console.log(JSON.stringify(entry))
      break
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
  info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
  warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
  error: (message: string, data?: Record<string, unknown>) => log('error', message, data),
}
