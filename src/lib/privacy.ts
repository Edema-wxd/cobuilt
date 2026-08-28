/**
 * NDPA data-minimisation helpers (§11).
 *
 * Analytics needs coarse geography, not identity, so addresses are truncated
 * before they are ever written: the final IPv4 octet (or the last 80 bits of
 * an IPv6 address) is zeroed, which keeps the network-level signal while
 * removing the identifier.
 */

export function truncateIp(ip: string | null | undefined): string | null {
  if (!ip) return null;

  const address = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  if (address.includes('.') && !address.includes(':')) {
    const parts = address.split('.');
    if (parts.length !== 4) return null;
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  if (address.includes(':')) {
    // Keep the /48 routing prefix, discard the rest.
    const groups = address.split(':').filter(Boolean).slice(0, 3);
    if (groups.length === 0) return null;
    return `${groups.join(':')}::`;
  }

  return null;
}

/** Masks an address for display in an admin list: `f****s@cobuilt.com`. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';

  const local = email.slice(0, at);
  const domain = email.slice(at);

  if (local.length <= 2) return `${local[0] ?? '*'}***${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(6, local.length - 2))}${local.at(-1)}${domain}`;
}

/** Keeps the last four digits only, for the same reason. */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}
