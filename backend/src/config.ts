/** Runtime configuration loaded from environment (contracts/backend-api.md §2). */

export interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

export interface AppConfig {
  port: number;
  /** Upstream Anvil RPC URL — node is localhost-bound; browser never sees this. */
  anvilUrl: string;
  chainId: number;
  chainName: string;
  /** Always '/rpc' — proxied path exposed to the browser. */
  rpcUrl: string;
  nativeCurrency: NativeCurrency;
  auctionAddress: string;
  nftAddress: string;
  deployedAt: string;
}

/** Read config from an environment-like object (defaults to process.env). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    anvilUrl: env.ANVIL_URL ?? 'http://127.0.0.1:8545',
    chainId: Number(env.CHAIN_ID ?? 2026),
    chainName: env.CHAIN_NAME ?? 'English Auction Chain',
    rpcUrl: '/rpc',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    auctionAddress: env.AUCTION_ADDRESS ?? '',
    nftAddress: env.NFT_ADDRESS ?? '',
    deployedAt: env.DEPLOYED_AT ?? '',
  };
}

/** True when deployment addresses are present (config endpoint readiness gate). */
export function isDeployed(config: AppConfig): boolean {
  return config.auctionAddress !== '' && config.nftAddress !== '';
}
