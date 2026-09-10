/**
 * One place to decide what an exception from the application/repository layer is allowed to tell
 * the client. Intentional, human-worded errors thrown by that layer (e.g. "That code is already
 * taken.") are safe to pass through; anything with an internal prefix — or a non-Error throw — is
 * logged server-side and replaced with a generic fallback so adapter/database detail never leaks.
 */
const INTERNAL_PREFIXES = ['[supabase adapter]']

export function clientErrorMessage(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : ''
  if (!message || INTERNAL_PREFIXES.some((prefix) => message.startsWith(prefix))) {
    console.error(err)
    return fallback
  }
  return message
}
