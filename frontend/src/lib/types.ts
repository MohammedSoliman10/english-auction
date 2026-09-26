/** Shared frontend domain types (contracts/frontend-ui.md §2). */

export type AuctionPhase =
  | 'NOT_STARTED'
  | 'OPEN_FOR_BIDS'
  | 'AWAITING_SETTLEMENT'
  | 'SETTLED';

/** FR-010 — unified write-transaction lifecycle. */
export type TxLifecycle = {
  status: 'idle' | 'awaiting_confirmation' | 'pending' | 'success' | 'rejected' | 'reverted';
  hash?: `0x${string}`;
  message?: string;
};

/** Runtime config served by GET /api/config (backend contract §2). */
export interface RuntimeConfig {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  auctionAddress: `0x${string}`;
  nftAddress: `0x${string}`;
  deployedAt: string;
}
