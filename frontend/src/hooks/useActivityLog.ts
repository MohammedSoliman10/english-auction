import { useCallback, useEffect, useState } from 'react';
import { usePublicClient, useWatchContractEvent } from 'wagmi';
import { decodeEventLog, type Address, type Log } from 'viem';
import { EnglishAuctionAbi } from '../lib/abi/EnglishAuction';
import { useRuntimeConfig } from '../lib/config';

/** FR-009 — the four on-chain event kinds of the auction contract. */
export type ActivityKind = 'Start' | 'Bid' | 'Withdraw' | 'End';

export interface ActivityEntry {
  /** Stable React key: `${blockNumber}-${logIndex}`. */
  id: string;
  kind: ActivityKind;
  /** Absent for `Start` (the event carries no actor). */
  actor?: Address;
  /** Absent for `Start` (the event carries no amount). */
  amount?: bigint;
  /** Block timestamp (seconds). */
  time: bigint;
}

export interface UseActivityLogResult {
  /** Newest-first (blockNumber desc, then logIndex desc). */
  entries: ActivityEntry[];
  isLoading: boolean;
  error?: string;
}

/** FR-009 safety-net poll; events trigger the snappy re-reads. */
const POLL_MS = 4000;

/**
 * eth_getLogs window (blocks). Free Sepolia endpoints cap log ranges —
 * Alchemy Free: 10, 1rpc: 50, drpc: 10 000, publicnode: 50 000 — so reads
 * page forward from the auction's deploy block in 5 000-block windows that
 * every supported provider accepts (T069 production verification).
 */
const LOG_PAGE_BLOCKS = 5_000n;

/**
 * FR-009 — activity log derived from on-chain Start/Bid/Withdraw/End logs.
 *
 * - Reads the auction's logs from its deploy block in provider-safe
 *   5 000-block pages (from genesis on the local demo chain) and decodes
 *   them with the synced ABI; block timestamps are fetched per unique block.
 * - Re-reads on mount, on a 4s poll, and whenever an auction event lands
 *   (contract §6 event → re-read rule).
 * - Any failure collapses to the single `chain_unreachable` error state
 *   (data-model §1) — never a raw error string.
 */
export function useActivityLog(): UseActivityLogResult {
  const config = useRuntimeConfig();
  const publicClient = usePublicClient({ chainId: config.chainId });
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const reload = useCallback(async (): Promise<void> => {
    if (!publicClient) {
      setEntries([]);
      setIsLoading(false);
      setError('chain_unreachable');
      return;
    }
    try {
      // Paged range: auction events only exist from its creation block
      // onward, and providers cap eth_getLogs windows (T069).
      const latest = await publicClient.getBlockNumber();
      const logs: Log[] = [];
      let start = BigInt(config.deployBlock ?? 0);
      while (start <= latest) {
        const end = start + LOG_PAGE_BLOCKS - 1n > latest ? latest : start + LOG_PAGE_BLOCKS - 1n;
        logs.push(
          ...(await publicClient.getLogs({
            address: config.auctionAddress,
            fromBlock: start,
            toBlock: end,
          })),
        );
        start = end + 1n;
      }

      // Newest-first: higher block first, ties broken by log index.
      const sorted = [...logs].sort((a, b) => {
        const bnA = a.blockNumber ?? 0n;
        const bnB = b.blockNumber ?? 0n;
        if (bnA !== bnB) return bnA > bnB ? -1 : 1;
        return (b.logIndex ?? 0) - (a.logIndex ?? 0);
      });

      const blockNumbers = [...new Set(sorted.map((log) => log.blockNumber ?? 0n))];
      const blocks = await Promise.all(
        blockNumbers.map((blockNumber) => publicClient.getBlock({ blockNumber })),
      );
      const timeByBlock = new Map<bigint, bigint>(
        blockNumbers.map((blockNumber, i) => [blockNumber, blocks[i].timestamp]),
      );

      const decoded: ActivityEntry[] = sorted.map((log) => {
        const event = decodeEventLog({
          abi: EnglishAuctionAbi,
          data: log.data,
          topics: log.topics,
        });
        const id = `${log.blockNumber ?? 0n}-${log.logIndex ?? 0}`;
        const time = timeByBlock.get(log.blockNumber ?? 0n) ?? 0n;

        switch (event.eventName) {
          case 'Bid': {
            const args = event.args as { sender: Address; amount: bigint };
            return { id, kind: 'Bid', actor: args.sender, amount: args.amount, time };
          }
          case 'Withdraw': {
            const args = event.args as { bidder: Address; amount: bigint };
            return { id, kind: 'Withdraw', actor: args.bidder, amount: args.amount, time };
          }
          case 'End': {
            const args = event.args as { winner: Address; amount: bigint };
            return { id, kind: 'End', actor: args.winner, amount: args.amount, time };
          }
          default:
            return { id, kind: 'Start', time };
        }
      });

      setEntries(decoded);
      setError(undefined);
    } catch {
      setEntries([]);
      setError('chain_unreachable');
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, config.auctionAddress, config.deployBlock]);

  // Initial read + safety-net poll.
  useEffect(() => {
    void reload();
    const interval = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(interval);
  }, [reload]);

  // Event → immediate re-read (contract §6).
  useWatchContractEvent({
    address: config.auctionAddress,
    abi: EnglishAuctionAbi,
    chainId: config.chainId,
    onLogs: () => void reload(),
  });

  return { entries, isLoading, error };
}
