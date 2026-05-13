import dns from 'dns/promises';
import net from 'net';

const INTERNAL_PATTERNS = [
  /^localhost$/i, /^127\./, /^0\.0\.0\.0$/, /^::1$/,
  /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./,
  /^f[cd][0-9a-f]{2}:/i, /^fe80:/i, /^::ffff:(127|10|192\.168|172\.(1[6-9]|2\d|3[01])|169\.254)\./i,
];

export function isInternalHost(hostname) {
  return INTERNAL_PATTERNS.some((pattern) => pattern.test(hostname));
}

export async function isSafeFetchUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  if (isInternalHost(parsed.hostname)) return false;

  const ipVersion = net.isIP(parsed.hostname);
  if (ipVersion) return !isInternalHost(parsed.hostname);

  try {
    const addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: false });
    return addresses.length > 0 && addresses.every(({ address }) => !isInternalHost(address));
  } catch {
    return false;
  }
}
