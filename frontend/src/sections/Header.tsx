import { useCallback, useEffect, useRef, useState } from 'react';
import { numberToHex } from 'viem';
import { useAccount, useConnect, useSwitchChain } from 'wagmi';
import { DisplayHeading } from '../components/DisplayHeading';
import { MonoLabel } from '../components/MonoLabel';
import { useRuntimeConfig } from '../lib/config';
import { formatAddress } from '../lib/format';

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown }): Promise<unknown>;
    };
  }
}

const WALLET_CHAIN_NOT_FOUND = 4902;
const WALLET_REJECTED = 4001;

/**
 * App header (contract §1): brand display, wallet connect, address +
 * network badge with guided add/switch for the hosted chain (FR-001).
 */
export function Header() {
  const config = useRuntimeConfig();
  // The wallet's ACTUAL chain rides on the account/connection state —
  // `useChainId()` only tracks the app-selected chain (config default) and
  // would never reveal a wallet sitting on a foreign network (V1/FR-001).
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const [notice, setNotice] = useState<string | null>(null);
  const promptedRef = useRef(false);

  const wrongNetwork =
    isConnected && walletChainId !== undefined && walletChainId !== config.chainId;

  /** Guided switch: switch → (4902) add chain → (4001) decline notice. */
  const promptSwitch = useCallback(async () => {
    try {
      await switchChainAsync({
        chainId: config.chainId,
        // T069 — wagmi's injected connector raises wallet_addEthereumChain
        // itself from these parameters when the wallet reports 4902 (the
        // wallet doesn't know the chain yet). Relative config.rpcUrl ("/rpc")
        // is rejected by wallets, so the add flow gets the absolute
        // same-origin URL; the transport keeps the relative path.
        addEthereumChainParameter: {
          rpcUrls: [new URL(config.rpcUrl, window.location.origin).toString()],
        },
      });
      setNotice(null);
    } catch (err) {
      const code = (err as { code?: number } | null)?.code;
      if (code === WALLET_CHAIN_NOT_FOUND) {
        try {
          await window.ethereum?.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: numberToHex(config.chainId),
                chainName: config.chainName,
                nativeCurrency: config.nativeCurrency,
                rpcUrls: [new URL(config.rpcUrl, window.location.origin).toString()],
              },
            ],
          });
          setNotice(null);
        } catch {
          setNotice('Could not add the network — add it manually in your wallet.');
        }
      } else if (code === WALLET_REJECTED) {
        setNotice('Network switch declined — use the switch button to retry.');
      } else {
        setNotice('Network switch failed — use the switch button to retry.');
      }
    }
  }, [switchChainAsync, config]);

  // Prompt once per mount when connected to the wrong network (FR-001 / V1).
  useEffect(() => {
    if (wrongNetwork && !promptedRef.current) {
      promptedRef.current = true;
      void promptSwitch();
    }
  }, [wrongNetwork, promptSwitch]);

  return (
    <header className="relative z-10 border-b border-surface-3 bg-surface-1 px-4 py-4 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <DisplayHeading className="text-2xl sm:text-3xl">ENGLISH AUCTION.</DisplayHeading>

        <div className="flex flex-wrap items-center gap-3">
          {isConnected ? (
            <>
              <MonoLabel className="text-paper">{formatAddress(address ?? '')}</MonoLabel>
              {wrongNetwork ? (
                <MonoLabel className="text-white">
                  wrong network — expected {config.chainName}
                </MonoLabel>
              ) : (
                <MonoLabel className="text-signal">{config.chainName}</MonoLabel>
              )}
            </>
          ) : null}

          {isConnected && wrongNetwork ? (
            <button
              type="button"
              onClick={() => void promptSwitch()}
              className="border-2 border-white bg-white px-3 py-1 text-void transition-opacity hover:opacity-80"
            >
              <MonoLabel className="text-void">switch network</MonoLabel>
            </button>
          ) : null}

          {!isConnected ? (
            <button
              type="button"
              disabled={connectors.length === 0}
              onClick={() => connect({ connector: connectors[0] })}
              className="border-2 border-white bg-white px-4 py-2 text-void transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MonoLabel className="text-void">
                {connectors.length === 0 ? 'connect — no wallet' : 'connect wallet'}
              </MonoLabel>
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div className="mx-auto mt-3 max-w-6xl">
          <MonoLabel className="text-paper">{notice}</MonoLabel>
        </div>
      ) : null}
    </header>
  );
}
