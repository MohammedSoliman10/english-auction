import { useAccount, useChainId } from 'wagmi';
import { EnglishAuctionAbi } from '../lib/abi/EnglishAuction';
import { useRuntimeConfig } from '../lib/config';
import {
  NOT_CONNECTED_MESSAGE,
  NOTHING_TO_WITHDRAW_MESSAGE,
  wrongNetworkMessage,
} from '../lib/errors';
import type { TxLifecycle } from '../lib/types';
import { useAuctionState } from './useAuctionState';
import { useTxLifecycle } from './useTxLifecycle';

export interface UseWithdrawFundsResult {
  /** Revert-cat. message — or null when withdrawing is valid. */
  validate: () => string | null;
  /** Claim the caller's full credit in one action (FR-005). */
  submit: () => void;
  tx: TxLifecycle;
}

/**
 * US3 / FR-005 — outbid user reclaims their refund.
 *
 * The contract's `withdraw()` is deliberately unguarded (claims whatever the
 * caller's `bids` balance is, even zero), so the "nothing to withdraw" rule
 * (spec US3 scenario 2, FR-004) is enforced HERE — before any wallet prompt —
 * together with the standard connection/network guards. There is no phase
 * guard: a credit stays claimable at any time after being outbid.
 */
export function useWithdrawFunds(): UseWithdrawFundsResult {
  const config = useRuntimeConfig();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { myRefundable } = useAuctionState();
  const { tx, write } = useTxLifecycle();

  const validate = (): string | null => {
    if (!isConnected || address === undefined) return NOT_CONNECTED_MESSAGE;
    if (chainId !== config.chainId) return wrongNetworkMessage(config.chainName);
    if (myRefundable === 0n) return NOTHING_TO_WITHDRAW_MESSAGE;
    return null;
  };

  const submit = (): void => {
    if (validate() !== null) return; // FR-004 — never prompt the wallet
    void write({
      address: config.auctionAddress,
      abi: EnglishAuctionAbi,
      functionName: 'withdraw',
    });
  };

  return { validate, submit, tx };
}
