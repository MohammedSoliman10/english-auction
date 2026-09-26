import { useEffect, useRef } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { EnglishAuctionAbi } from '../lib/abi/EnglishAuction';
import { IERC721Abi } from '../lib/abi/IERC721';
import { useRuntimeConfig } from '../lib/config';
import {
  NOT_CONNECTED_MESSAGE,
  NOT_OWNER_MESSAGE,
  REVERT_MESSAGES,
  wrongNetworkMessage,
} from '../lib/errors';
import type { TxLifecycle } from '../lib/types';
import { useAuctionState } from './useAuctionState';
import { useTxLifecycle } from './useTxLifecycle';

export interface UseStartAuctionResult {
  /** Revert-cat. message — or null when starting is valid. */
  validate: () => string | null;
  /** Run the escrow sequence: ERC-721 `approve` → `start()` (FR-004). */
  submit: () => void;
  tx: TxLifecycle;
}

/**
 * US2 / FR-004 — seller starts the auction.
 *
 * Escrow step (T043, spec: "click start, approve the wallet prompts"):
 * clicking start opens the wallet for the ERC-721 `approve(auction, nftId)`
 * first (idempotent), then — once that receipt is mined — for `start()`.
 * The two prompts are sequenced by this hook; each walks the shared write
 * state machine (data-model §6) into the global toast.
 *
 * Guard order mirrors the contract's `start()` check order (already-started
 * before not-seller) plus the spec §7 ownership prerequisite, so a failing
 * guard surfaces the message the chain would have produced — without ever
 * reaching the wallet.
 */
export function useStartAuction(): UseStartAuctionResult {
  const config = useRuntimeConfig();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const auction = useAuctionState();
  const { tx, write } = useTxLifecycle();

  // Spec §7: the seller must still hold the escrowed NFT (ownerOf reverts
  // when the token is missing → isError also fails the guard).
  const ownerRead = useReadContract({
    address: auction.nft,
    abi: IERC721Abi,
    functionName: 'ownerOf',
    args: [auction.nftId],
  });

  /** True while the approve receipt is awaited and start() must follow. */
  const startAfterApprove = useRef(false);

  const validate = (): string | null => {
    if (!isConnected || address === undefined) return NOT_CONNECTED_MESSAGE;
    if (chainId !== config.chainId) return wrongNetworkMessage(config.chainName);
    if (auction.phase !== 'NOT_STARTED') return REVERT_MESSAGES.started;
    if (!auction.isSeller) return REVERT_MESSAGES['not seller'];
    if (ownerRead.isError) return NOT_OWNER_MESSAGE;
    const owner = ownerRead.data;
    if (owner !== undefined && owner.toLowerCase() !== address.toLowerCase()) {
      return NOT_OWNER_MESSAGE;
    }
    return null;
  };

  const submit = (): void => {
    if (validate() !== null) return; // FR-004 — never prompt the wallet
    startAfterApprove.current = true;
    void write({
      address: auction.nft,
      abi: IERC721Abi,
      functionName: 'approve',
      args: [config.auctionAddress, auction.nftId],
    });
  };

  // Step 2: once the approval is mined, open escrow via start().
  // A rejected/reverted approval cancels the sequence.
  useEffect(() => {
    if (tx.status === 'success' && startAfterApprove.current) {
      startAfterApprove.current = false;
      void write({
        address: config.auctionAddress,
        abi: EnglishAuctionAbi,
        functionName: 'start',
      });
      return;
    }
    if (tx.status === 'rejected' || tx.status === 'reverted') {
      startAfterApprove.current = false;
    }
  }, [tx, write, config.auctionAddress]);

  return { validate, submit, tx };
}
