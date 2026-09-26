import { useEffect, useState } from 'react';
import { useAccount, useReadContracts, useWatchContractEvent } from 'wagmi';
import { zeroAddress, type Address } from 'viem';
import { EnglishAuctionAbi } from '../lib/abi/EnglishAuction';
import { useRuntimeConfig } from '../lib/config';
import type { AuctionPhase } from '../lib/types';

/**
 * FR-002 / data-model §1 — derived read model over one batched read.
 * Slot order must match the `contracts` array below (pinned by tests).
 */
export const READ_INDEX = {
  started: 0,
  ended: 1,
  endAt: 2,
  highestBid: 3,
  highestBidder: 4,
  seller: 5,
  startingBid: 6,
  nft: 7,
  nftId: 8,
  bids: 9,
} as const;

/** FR-002 "on mount + poll" — safety-net refresh of the read model. */
const POLL_MS = 4000;
/** FR-002 "on event" — re-read as soon as an auction event is observed. */
const EVENT_POLL_MS = 1000;
/** Local countdown tick (seconds) — SC-005 without extra RPC load. */
const CLOCK_TICK_MS = 1000;

export interface UseAuctionStateResult {
  phase: AuctionPhase;
  seller: Address;
  nft: Address;
  nftId: bigint;
  startingBid: bigint;
  highestBid: bigint;
  highestBidder: Address;
  endAt: bigint;
  timeRemaining: bigint;
  myRefundable: bigint;
  isHighestBidder: boolean;
  isSeller: boolean;
  isLoading: boolean;
  error?: string;
}

const sameAddress = (a: Address, b: Address): boolean =>
  a.toLowerCase() === b.toLowerCase();

/**
 * Derived auction state (contracts/frontend-ui.md §2).
 *
 * - One batched read of the auction getters, pinned to the auction chain so
 *   wallet network never changes what the UI displays (SC-008).
 * - `allowFailure: false` keeps results flat; any read failure collapses to
 *   the single `chain_unreachable` error state (data-model §1).
 * - Re-fetches on mount, on a 4s poll, and whenever an auction event lands.
 */
export function useAuctionState(): UseAuctionStateResult {
  const config = useRuntimeConfig();
  const { address } = useAccount();
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(
      () => setNowSec(Math.floor(Date.now() / 1000)),
      CLOCK_TICK_MS,
    );
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, error, refetch } = useReadContracts({
    chainId: config.chainId,
    contracts: [
      { address: config.auctionAddress, abi: EnglishAuctionAbi, functionName: 'started' },
      { address: config.auctionAddress, abi: EnglishAuctionAbi, functionName: 'ended' },
      { address: config.auctionAddress, abi: EnglishAuctionAbi, functionName: 'endAt' },
      { address: config.auctionAddress, abi: EnglishAuctionAbi, functionName: 'highestBid' },
      { address: config.auctionAddress, abi: EnglishAuctionAbi, functionName: 'highestBidder' },
      { address: config.auctionAddress, abi: EnglishAuctionAbi, functionName: 'seller' },
      { address: config.auctionAddress, abi: EnglishAuctionAbi, functionName: 'startingBid' },
      { address: config.auctionAddress, abi: EnglishAuctionAbi, functionName: 'nft' },
      { address: config.auctionAddress, abi: EnglishAuctionAbi, functionName: 'nftId' },
      {
        address: config.auctionAddress,
        abi: EnglishAuctionAbi,
        functionName: 'bids',
        args: [address ?? zeroAddress],
      },
    ],
    allowFailure: false,
    query: { refetchInterval: POLL_MS },
  });

  // FR-002 "on event" — any auction event ⇒ immediate re-read (writes included).
  useWatchContractEvent({
    address: config.auctionAddress,
    abi: EnglishAuctionAbi,
    chainId: config.chainId,
    pollingInterval: EVENT_POLL_MS,
    onLogs: () => {
      void refetch();
    },
  });

  const started = data?.[READ_INDEX.started] ?? false;
  const ended = data?.[READ_INDEX.ended] ?? false;
  const endAt = data?.[READ_INDEX.endAt] ?? 0n;
  const highestBid = data?.[READ_INDEX.highestBid] ?? 0n;
  const highestBidder = data?.[READ_INDEX.highestBidder] ?? zeroAddress;
  const seller = data?.[READ_INDEX.seller] ?? zeroAddress;
  const startingBid = data?.[READ_INDEX.startingBid] ?? 0n;
  const nft = data?.[READ_INDEX.nft] ?? zeroAddress;
  const nftId = data?.[READ_INDEX.nftId] ?? 0n;
  const bidsForAccount = data?.[READ_INDEX.bids] ?? 0n;

  // SETTLED wins over the clock: end() is authoritative once mined.
  const phase: AuctionPhase = !started
    ? 'NOT_STARTED'
    : ended
      ? 'SETTLED'
      : BigInt(nowSec) < endAt
        ? 'OPEN_FOR_BIDS'
        : 'AWAITING_SETTLEMENT';

  const timeRemaining = endAt > BigInt(nowSec) ? endAt - BigInt(nowSec) : 0n;

  return {
    phase,
    seller,
    nft,
    nftId,
    startingBid,
    highestBid,
    highestBidder,
    endAt,
    timeRemaining,
    myRefundable: address ? bidsForAccount : 0n,
    isHighestBidder: address !== undefined && sameAddress(highestBidder, address),
    isSeller: address !== undefined && sameAddress(seller, address),
    isLoading,
    error: error ? 'chain_unreachable' : undefined,
  };
}
