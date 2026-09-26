import { useAccount, useChainId } from 'wagmi';
import { EnglishAuctionAbi } from '../lib/abi/EnglishAuction';
import { useRuntimeConfig } from '../lib/config';
import {
  ALREADY_SETTLED_MESSAGE,
  NOT_CONNECTED_MESSAGE,
  REVERT_MESSAGES,
  wrongNetworkMessage,
} from '../lib/errors';
import type { TxLifecycle } from '../lib/types';
import { useAuctionState } from './useAuctionState';
import { useTxLifecycle } from './useTxLifecycle';

export interface UseSettleAuctionResult {
  /** Revert-cat. message — or null when settling is valid. */
  validate: () => string | null;
  /** Permissionless end() — winner takes the NFT, seller takes the bid. */
  submit: () => void;
  tx: TxLifecycle;
}

/**
 * US4 / FR-007 — settle the finished auction.
 *
 * `end()` is permissionless (any connected account) but strictly bounded:
 * only once the clock passes `endAt` and only once. The phase matrix drives
 * validation (FR-004 — blocked actions produce their message before any
 * wallet prompt):
 *   NOT_STARTED      → "Auction has not started yet"
 *   OPEN_FOR_BIDS    → "Auction is still in progress"  (scenario 3)
 *   AWAITING_SETTLEMENT → null                          (the settle window)
 *   SETTLED          → "Auction already settled"        (scenario 4)
 */
export function useSettleAuction(): UseSettleAuctionResult {
  const config = useRuntimeConfig();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { phase } = useAuctionState();
  const { tx, write } = useTxLifecycle();

  const validate = (): string | null => {
    if (!isConnected || address === undefined) return NOT_CONNECTED_MESSAGE;
    if (chainId !== config.chainId) return wrongNetworkMessage(config.chainName);
    if (phase === 'NOT_STARTED') return REVERT_MESSAGES['not started'];
    if (phase === 'OPEN_FOR_BIDS') return REVERT_MESSAGES['not ended'];
    if (phase === 'SETTLED') return ALREADY_SETTLED_MESSAGE;
    return null; // AWAITING_SETTLEMENT
  };

  const submit = (): void => {
    if (validate() !== null) return; // FR-004 — never prompt the wallet
    void write({
      address: config.auctionAddress,
      abi: EnglishAuctionAbi,
      functionName: 'end',
    });
  };

  return { validate, submit, tx };
}
