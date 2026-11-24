/**
 * Normalizes a WhatsApp phone number to a canonical digits-only key (7-15 digits).
 * Strips spaces, +, dashes, and parentheses. Normalizes 977XXXXXXXXXX to 10-digit local
 * when applicable so +977 9841234567 and 9841234567 share the same loyalty account.
 */
export function normalizePhoneKey(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('977')) {
    return digits.slice(3);
  }
  return digits.slice(0, 15);
}

/**
 * Computes a deterministic SHA-256 hex digest for PII-free customer loyalty progress lookups.
 */
export async function hashPhoneKey(phoneKey: string): Promise<string> {
  const data = new TextEncoder().encode(`modern-bhatti-loyalty:${phoneKey}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
