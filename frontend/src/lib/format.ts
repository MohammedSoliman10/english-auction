/** Exact wei ↔ ETH conversion and display formatting (contract §4 / US1). */

const WEI_PER_ETH = 10n ** 18n;

export interface FormatEthOptions {
  /** Truncate (never round over) to at most this many decimals. */
  maxDecimals?: number;
}

/** Format wei as an exact ETH decimal string, trimming trailing zeros. */
export function formatEth(wei: bigint, options: FormatEthOptions = {}): string {
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const whole = abs / WEI_PER_ETH;
  let fraction = (abs % WEI_PER_ETH).toString().padStart(18, '0');

  if (options.maxDecimals !== undefined) {
    fraction = fraction.slice(0, Math.max(0, options.maxDecimals));
  }
  fraction = fraction.replace(/0+$/, '');

  const body = fraction.length > 0 ? `${whole}.${fraction}` : `${whole.toString()}`;
  return negative ? `-${body}` : body;
}

/**
 * Parse a user-entered ETH amount to wei — exact, no floating point.
 * Throws on empty/invalid/negative input or >18 decimals.
 */
export function parseEth(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '' || trimmed === '.') {
    throw new Error(`Invalid ETH amount: "${input}"`);
  }
  const [whole = '0', fraction = ''] = trimmed.split('.');
  if (fraction.length > 18) {
    throw new Error(`Too many decimals (max 18): "${input}"`);
  }
  const padded = fraction.padEnd(18, '0');
  return BigInt(whole || '0') * WEI_PER_ETH + BigInt(padded || '0');
}

/** Format a seconds countdown: mm:ss below one hour, h:mm:ss above. */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mmss = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

/** Shorten an address to `0x1234…abcd`; short strings pass through. */
export function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
