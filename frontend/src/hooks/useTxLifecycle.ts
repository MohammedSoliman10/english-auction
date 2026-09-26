import { useCallback, useEffect, useRef, useState } from 'react';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import type {
  Abi,
  Account,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  WriteContractParameters,
} from 'viem';
import { EnglishAuctionAbi } from '../lib/abi/EnglishAuction';
import { IERC721Abi } from '../lib/abi/IERC721';
import { SolimanWeb3Abi } from '../lib/abi/SolimanWeb3';
import { friendlyMessage } from '../lib/errors';
import { useTxStore } from '../app/TxProvider';
import type { TxLifecycle } from '../lib/types';

type WriteNames<abi extends Abi> = ContractFunctionName<
  abi,
  'nonpayable' | 'payable'
>;

/**
 * One precise parameter type per contract function. `chain`/`account` are
 * pinned to wagmi's own instantiation so both stay optional (viem's defaults
 * make them required); payable functions then carry a typed `value: bigint`.
 */
type OneWrite<abi extends Abi, K extends WriteNames<abi>> =
  WriteContractParameters<
    abi,
    K,
    ContractFunctionArgs<abi, 'nonpayable' | 'payable', K>,
    Chain,
    Account,
    Chain
  >;

type WritesOf<abi extends Abi> = {
  [K in WriteNames<abi>]: OneWrite<abi, K>;
}[WriteNames<abi>];

/**
 * Parameters accepted by `writeContractAsync` — the per-function union over
 * the writable contracts (auction + SolimanWeb3 + the ERC-721 the seller
 * escrows into), so every hook gets exact `functionName`/`args`/`value`
 * checking (e.g. `bid()` must send value, `mintNFT()` must not).
 *
 * Deriving via `Parameters<writeContractAsync>` degrades the generic ABI
 * mutability and collapses `value` to `undefined` — hence this explicit union.
 */
export type TxWriteParams =
  | WritesOf<typeof EnglishAuctionAbi>
  | WritesOf<typeof SolimanWeb3Abi>
  | WritesOf<typeof IERC721Abi>;

/** Raw generic instantiation writeContractAsync accepts (see `write`). */
type RawWriteParams = Parameters<
  ReturnType<typeof useWriteContract>['writeContractAsync']
>[0];

/** viem/wagmi errors carry the useful text in shortMessage or message. */
function errorText(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { shortMessage?: string; message?: string; details?: string };
    return e.shortMessage ?? e.details ?? e.message ?? '';
  }
  return String(err);
}

/** Wallet rejection: EIP-1197 code 4001 or viem UserRejectedRequestError. */
function isRejection(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as { code?: number | string; name?: string };
    if (e.code === 4001 || e.code === 'ACTION_REJECTED') return true;
    if (e.name === 'UserRejectedRequestError') return true;
  }
  return /user rejected|user denied/i.test(errorText(err));
}

const REJECTED_MESSAGE = 'Transaction rejected in wallet — no changes were made.';
const MINED_REVERT_MESSAGE = 'Transaction reverted on-chain — no state change.';

export interface UseTxLifecycleResult {
  tx: TxLifecycle;
  /** Submit a contract write through the state machine. Never throws. */
  write: (params: TxWriteParams) => Promise<void>;
  /** Return to idle (e.g. when a toast is dismissed). */
  reset: () => void;
}

/**
 * FR-010 / data-model §6 write-transaction state machine:
 *
 *   idle → awaiting_confirmation → pending(hash) → success
 *                                        ├→ rejected   (wallet 4001)
 *                                        └→ reverted   (catalogue message)
 *
 * Composes wagmi `useWriteContract` + `useWaitForTransactionReceipt`.
 * Receipts are only applied when their hash matches the current tx hash,
 * so a stale receipt from an earlier write can never flip state.
 */
export function useTxLifecycle(): UseTxLifecycleResult {
  const [tx, setTx] = useState<TxLifecycle>({ status: 'idle' });
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const { writeContractAsync } = useWriteContract();
  const store = useTxStore();

  // Complete lifecycles that outlive the panel which started them: a phase
  // flip unmounts the writing panel (StartPanel → BidForm right after
  // start()), so every surviving mounted instance also watches the store's
  // pending hash — wagmi dedupes the identical receipt query (quickstart V3).
  const storePendingHash = store?.tx.status === 'pending' ? store.tx.hash : undefined;
  const watchHash = hash ?? storePendingHash;
  const receipt = useWaitForTransactionReceipt({ hash: watchHash });

  // FR-010 global surface: mirror every transition into the TxProvider store
  // when mounted inside the app tree. Depends only on the *stable* `publish`
  // callback (not the context value), so an external reset() from the toast's
  // dismiss control is never immediately republished — and standalone usage
  // without a provider keeps its own state (T037 store tests).
  // The *initial* idle is never published: a freshly mounted hook (BidForm
  // mounting at the phase flip) must not wipe a live or finished toast with
  // its own idle state. Only real transitions and reset() reach the store.
  const publish = store?.publish;
  const hadTransition = useRef(false);
  useEffect(() => {
    if (tx.status === 'idle' && !hadTransition.current) return;
    hadTransition.current = true;
    publish?.(tx);
  }, [publish, tx]);

  const write = useCallback(
    async (params: TxWriteParams): Promise<void> => {
      setTx({ status: 'awaiting_confirmation' });
      try {
        // TxWriteParams is a per-function union; wagmi's generic signature
        // cannot infer a union argument (its mutability conditional collapses
        // `value`), so re-widen at this single pass-through boundary — each
        // member is valid on its own and wagmi validates the object at runtime.
        const submitted = await writeContractAsync(params as RawWriteParams);
        setHash(submitted);
        setTx({ status: 'pending', hash: submitted });
      } catch (err) {
        if (isRejection(err)) {
          setTx({ status: 'rejected', message: REJECTED_MESSAGE });
        } else {
          setTx({ status: 'reverted', message: friendlyMessage(errorText(err)) });
        }
      }
    },
    [writeContractAsync],
  );

  const reset = useCallback(() => {
    setHash(undefined);
    setTx({ status: 'idle' });
  }, []);

  // Apply the mined receipt: success / reverted (only for the watched hash —
  // own write, or a store pending tx whose starting panel already unmounted).
  useEffect(() => {
    if (!watchHash) return;
    if (receipt.isError) {
      setTx({ status: 'reverted', hash: watchHash, message: friendlyMessage(errorText(receipt.error)) });
      return;
    }
    const mined = receipt.data;
    if (!mined) return;
    if (mined.transactionHash.toLowerCase() !== watchHash.toLowerCase()) return;
    if (mined.status === 'success') {
      setTx({ status: 'success', hash: watchHash });
    } else {
      setTx({ status: 'reverted', hash: watchHash, message: friendlyMessage(MINED_REVERT_MESSAGE) });
    }
  }, [watchHash, receipt.data, receipt.isError, receipt.error]);

  return { tx, write, reset };
}
