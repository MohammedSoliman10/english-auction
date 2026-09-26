import { useAccount, useChainId, useWaitForTransactionReceipt } from 'wagmi';
import { decodeEventLog } from 'viem';
import { SolimanWeb3Abi } from '../lib/abi/SolimanWeb3';
import { useRuntimeConfig } from '../lib/config';
import {
  EMPTY_URI_MESSAGE,
  INVALID_URI_MESSAGE,
  NOT_CONNECTED_MESSAGE,
  wrongNetworkMessage,
} from '../lib/errors';
import type { TxLifecycle } from '../lib/types';
import { useTxLifecycle } from './useTxLifecycle';

/** Spec US5 scenario 2 — the four fetchable metadata URI schemes. */
const VALID_URI_SCHEME = /^(https?:\/\/|ipfs:\/\/|data:)/i;

export interface UseMintNftResult {
  /** Revert-cat. message — or null when the URI and wallet are ready. */
  validate: (uri: string) => string | null;
  /** mintNFT(uri) on the SolimanWeb3 collection (no value). */
  submit: (uri: string) => void;
  tx: TxLifecycle;
  /**
   * FR-008 — token id minted by the last successful submit, decoded from the
   * receipt's `Transfer(0x0 → minter, id)` log; null until then. Transactions
   * cannot return values, so the event is the source of truth.
   */
  mintedTokenId: bigint | null;
}

/**
 * US5 — mint a collectible with a metadata JSON URI.
 *
 * Wallet/network guards follow the shared pre-check pattern (FR-004: no
 * wallet prompt when blocked). There is deliberately **no phase guard**: the
 * collection is independent of the auction lifecycle — the pre-start
 * placement is a panel concern (frontend-ui.md §1 "pre-start onboarding").
 *
 * Scenario 2 ("warns before spending gas"): an empty or obviously wrong URI
 * (not http(s)://, ipfs://, or data:) is refused in `validate()` before any
 * transaction is built.
 */
export function useMintNft(): UseMintNftResult {
  const config = useRuntimeConfig();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { tx, write } = useTxLifecycle();

  // Same receipt the lifecycle already awaits — wagmi dedupes the identical
  // query key, so decoding the mint event costs no extra RPC round trip.
  const receipt = useWaitForTransactionReceipt({ hash: tx.hash });

  const validate = (uri: string): string | null => {
    if (!isConnected || address === undefined) return NOT_CONNECTED_MESSAGE;
    if (chainId !== config.chainId) return wrongNetworkMessage(config.chainName);
    const trimmed = uri.trim();
    if (trimmed === '') return EMPTY_URI_MESSAGE;
    if (!VALID_URI_SCHEME.test(trimmed)) return INVALID_URI_MESSAGE;
    return null;
  };

  const submit = (uri: string): void => {
    const trimmed = uri.trim();
    if (validate(trimmed) !== null) return; // never spend gas on a dud
    void write({
      address: config.nftAddress,
      abi: SolimanWeb3Abi,
      functionName: 'mintNFT',
      args: [trimmed],
    });
  };

  let mintedTokenId: bigint | null = null;
  const mined = receipt.data;
  if (
    tx.status === 'success' &&
    tx.hash !== undefined &&
    mined !== undefined &&
    mined.transactionHash.toLowerCase() === tx.hash.toLowerCase()
  ) {
    for (const log of mined.logs) {
      if (log.address.toLowerCase() !== config.nftAddress.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: SolimanWeb3Abi,
          data: log.data,
          topics: log.topics,
        }) as { eventName: string; args: { tokenId?: bigint } };
        if (decoded.eventName === 'Transfer' && decoded.args.tokenId !== undefined) {
          mintedTokenId = decoded.args.tokenId;
          break;
        }
      } catch {
        // log is not a decodable SolimanWeb3 event — keep scanning
      }
    }
  }

  return { validate, submit, tx, mintedTokenId };
}
