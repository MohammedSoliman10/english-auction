import { useAccount, useChainId } from 'wagmi';
import { EnglishAuctionAbi } from '../lib/abi/EnglishAuction';
import { useRuntimeConfig } from '../lib/config';
import {
  NOT_CONNECTED_MESSAGE,
  REVERT_MESSAGES,
  wrongNetworkMessage,
} from '../lib/errors';
import type { TxLifecycle } from '../lib/types';
import { useAuctionState } from './useAuctionState';
import { useTxLifecycle } from './useTxLifecycle';

export interface UsePlaceBidResult {
  /** Revert-cat. message (or pre-check message) — or null when the bid is valid. */
  validate: (amount: bigint) => string | null;
  /** Fire `bid()` with `value = amount` — only after validate() passes. */
  submit: (amount: bigint) => void;
  tx: TxLifecycle;
}

/**
 * FR-003 / FR-004 — place a bid: client pre-validation BEFORE any wallet
 * prompt, then the shared write state machine (data-model §6).
 *
 * A validation failure never enters the tx state machine (the state-machine
 * edge reads "user action (validated)"): `submit` simply returns without
 * prompting the wallet, and the caller shows `validate()`'s message inline
 * (contracts §3). Guard order matches the spec's acceptance tests:
 * connected → network → started → ended → amount.
 */
export function usePlaceBid(): UsePlaceBidResult {
  const config = useRuntimeConfig();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const auction = useAuctionState();
  const { tx, write } = useTxLifecycle();

  const validate = (amount: bigint): string | null => {
    if (!isConnected || address === undefined) return NOT_CONNECTED_MESSAGE;
    if (chainId !== config.chainId) return wrongNetworkMessage(config.chainName);
    if (auction.phase === 'NOT_STARTED') return REVERT_MESSAGES['not started'];
    if (auction.phase === 'AWAITING_SETTLEMENT' || auction.phase === 'SETTLED') {
      return REVERT_MESSAGES.ended;
    }
    if (amount <= auction.highestBid) return REVERT_MESSAGES['value < highest'];
    return null;
  };

  const submit = (amount: bigint): void => {
    if (validate(amount) !== null) return; // FR-004 — never prompt the wallet
    void write({
      address: config.auctionAddress,
      abi: EnglishAuctionAbi,
      functionName: 'bid',
      value: amount,
    });
  };

  return { validate, submit, tx };
}
