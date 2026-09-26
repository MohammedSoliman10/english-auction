import { describe, expect, it } from 'vitest';
import { formatAddress, formatCountdown, formatEth, parseEth } from './format';

describe('formatEth / parseEth (wei ↔ ETH)', () => {
  it('formats whole and fractional ETH', () => {
    expect(formatEth(0n)).toBe('0');
    expect(formatEth(10n ** 18n)).toBe('1');
    expect(formatEth(1_500_000_000_000_000_000n)).toBe('1.5');
    expect(formatEth(123_456_789_000_000_000n)).toBe('0.123456789');
  });

  it('truncates to maxDecimals without rounding over', () => {
    expect(formatEth(1_999_999_999_999_999_999n, { maxDecimals: 3 })).toBe('1.999');
    expect(formatEth(1_999_999_999_999_999_999n, { maxDecimals: 0 })).toBe('1');
    expect(formatEth(5n, { maxDecimals: 18 })).toBe('0.000000000000000005');
  });

  it('parses ETH strings to exact wei', () => {
    expect(parseEth('1')).toBe(10n ** 18n);
    expect(parseEth('1.5')).toBe(1_500_000_000_000_000_000n);
    expect(parseEth('0.1')).toBe(100_000_000_000_000_000n);
    expect(parseEth(' 0.000000000000000001 ')).toBe(1n);
  });

  it('rejects invalid or over-precise input', () => {
    expect(() => parseEth('')).toThrow();
    expect(() => parseEth('abc')).toThrow();
    expect(() => parseEth('-1')).toThrow();
    expect(() => parseEth('1.1234567890123456789')).toThrow(); // 19 decimals
  });

  it('round-trips parse/format exactly', () => {
    const samples = [0n, 1n, 999_999_999_999_999_999n, 12_345_678_901_234_567_890n];
    for (const wei of samples) {
      expect(parseEth(formatEth(wei))).toBe(wei);
    }
  });
});

describe('formatCountdown', () => {
  it('formats mm:ss below one hour', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(45)).toBe('00:45');
    expect(formatCountdown(600)).toBe('10:00');
    expect(formatCountdown(3599)).toBe('59:59');
  });

  it('formats h:mm:ss at one hour and above', () => {
    expect(formatCountdown(3600)).toBe('1:00:00');
    expect(formatCountdown(3661)).toBe('1:01:01');
    expect(formatCountdown(86_399)).toBe('23:59:59');
  });

  it('clamps negative time to zero', () => {
    expect(formatCountdown(-5)).toBe('00:00');
    expect(formatCountdown(-0.4)).toBe('00:00');
  });
});

describe('formatAddress', () => {
  it('shortens to 0x1234…abcd', () => {
    expect(formatAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234…5678');
    expect(formatAddress('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')).toBe('0xabcd…abcd');
  });

  it('returns short strings untouched', () => {
    expect(formatAddress('n/a')).toBe('n/a');
  });
});
