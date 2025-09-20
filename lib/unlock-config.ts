// Shared unlock interval configuration.
// Reads from environment variables (minutes) with fallbacks:
// 1. NEXT_PUBLIC_UNLOCK_INTERVAL_MINUTES (exposed to client & server)
// 2. UNLOCK_INTERVAL_MINUTES (server-only)
// 3. Default: 30
// Ensures value is a positive integer between 1 and 720 (12 hours) for safety.

function readIntervalMinutes(): number {
	const raw = process.env.NEXT_PUBLIC_UNLOCK_INTERVAL_MINUTES || process.env.UNLOCK_INTERVAL_MINUTES || '30'
	const n = Number(raw)
	if (!Number.isFinite(n) || n <= 0) return 30
	if (n > 720) return 720
	return Math.floor(n)
}

export const UNLOCK_INTERVAL_MINUTES = readIntervalMinutes()
export const UNLOCK_INTERVAL_MS = UNLOCK_INTERVAL_MINUTES * 60 * 1000

// Helper for debugging (avoid logging in production automatically)
// console.debug('[unlock-config] interval minutes =', UNLOCK_INTERVAL_MINUTES)
