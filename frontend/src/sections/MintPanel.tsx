import { useState } from 'react';
import { MonoLabel } from '../components/MonoLabel';
import { Readout } from '../components/Readout';
import { useAuctionState } from '../hooks/useAuctionState';
import { useMintNft } from '../hooks/useMintNft';

/**
 * Mint onboarding (US5 — frontend-ui.md §1 "pre-start onboarding").
 *
 * Renders only in NOT_STARTED — once the auction starts, a fresh token can
 * no longer be auctioned by this instance, so the panel disappears with the
 * phase flip. URIs are validated up front (spec scenario 2 — "the app warns
 * before spending gas"); on success the minted token id is confirmed inline
 * (spec scenario 1 / FR-008) and the seller proceeds to <StartPanel>.
 */
export function MintPanel() {
  const { phase } = useAuctionState();
  const { validate, submit, tx, mintedTokenId } = useMintNft();
  const [uri, setUri] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (phase !== 'NOT_STARTED') return null;

  const inFlight = tx.status === 'awaiting_confirmation' || tx.status === 'pending';
  const showTokenId = tx.status === 'success' && mintedTokenId !== null;

  function onClick() {
    const problem = validate(uri);
    setMessage(problem);
    if (problem === null) submit(uri);
  }

  return (
    <section
      aria-label="mint nft"
      className="flex flex-col gap-4 border border-surface-3 bg-surface-1 p-6"
    >
      <div className="flex items-center justify-between">
        <MonoLabel className="text-white">mint collectible</MonoLabel>
        <MonoLabel className="text-signal">optional — own an nft already? skip to start</MonoLabel>
      </div>

      <p className="font-mono text-sm text-paper">
        No NFT yet? Mint one to yourself, then auction it — supply the off-chain
        metadata JSON URI.
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor="mint-uri">
          <MonoLabel className="text-signal">metadata uri</MonoLabel>
        </label>
        <input
          id="mint-uri"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={uri}
          disabled={inFlight}
          placeholder="https://… | ipfs://… | data:…"
          onChange={(event) => {
            setUri(event.target.value);
            if (message !== null) setMessage(null);
          }}
          className="border border-surface-3 bg-surface-2 px-3 py-2 font-mono text-sm text-paper placeholder:text-signal focus:border-white focus:outline-none disabled:opacity-50"
        />
      </div>

      {message !== null ? (
        <p role="alert" className="font-mono text-sm text-white">
          {message}
        </p>
      ) : null}

      {showTokenId ? (
        <Readout
          label="token id"
          value={(mintedTokenId as bigint).toString()}
          hint="minted — ready to auction"
        />
      ) : null}

      <button
        type="button"
        onClick={onClick}
        disabled={inFlight}
        className="border-2 border-white bg-white px-4 py-2 text-void transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <MonoLabel className="text-void">mint</MonoLabel>
      </button>
    </section>
  );
}
