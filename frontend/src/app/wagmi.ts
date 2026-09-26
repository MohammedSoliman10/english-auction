import { createConfig, http } from 'wagmi';
import { defineChain } from 'viem';
import { injected } from 'wagmi/connectors';
import type { RuntimeConfig } from '../lib/types';

/** Build the hosted demo chain definition from /api/config (addresses never hardcoded). */
export function buildChain(config: RuntimeConfig) {
  return defineChain({
    id: config.chainId,
    name: config.chainName,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
}

/**
 * wagmi v3 config: single hosted chain, same-origin `/rpc` transport
 * (browser only ever talks to the backend proxy), injected wallet connector.
 */
export function createWagmiConfig(config: RuntimeConfig) {
  const chain = buildChain(config);
  return createConfig({
    chains: [chain],
    connectors: [injected()],
    transports: { [chain.id]: http(config.rpcUrl) },
  });
}
