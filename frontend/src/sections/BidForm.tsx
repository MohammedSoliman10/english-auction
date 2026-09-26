import { useState, type FormEvent } from 'react';
import { MonoLabel } from '../components/MonoLabel';
import { formatEth, parseEth } from '../lib/format';
import { useAuctionState } from '../hooks/useAuctionState';
import { usePlaceBid } from '../hooks/usePlaceBid';

/** Input-format message (catalogue §7 covers on-chain/semantic failures). */
const INVALID_AMOUNT_MESSAGE = 'Enter a valid ETH amount.';

/**
 * Bid entry (contract §1 + matrix §3): amount input + place-bid action.
 *
 * Every submit runs client pre-validation (FR-004) BEFORE `submit()` — a
 * failing amount surfaces the catalogue message inline and never reaches the
 * wallet. The button is defensively disabled outside OPEN_FOR_BIDS so the
 * form can only ever offer a valid action (panels are mutually exclusive).
 */
export function BidForm() {
  const { phase, highestBid } = useAuctionState();
  const { validate, submit } = usePlaceBid();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const disabled = phase !== 'OPEN_FOR_BIDS';

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let wei: bigint;
    try {
      wei = parseEth(amount);
    } catch {
      setMessage(INVALID_AMOUNT_MESSAGE);
      return;
    }

    const problem = validate(wei);
    setMessage(problem);
    if (problem === null) {
      submit(wei);
    }
  }

  return (
    <form
      aria-label="place a bid"
      onSubmit={onSubmit}
      className="flex flex-col gap-4 border border-surface-3 bg-surface-1 p-6"
    >
      <div className="flex items-center justify-between">
        <label htmlFor="bid-amount">
          <MonoLabel className="text-signal">amount (eth)</MonoLabel>
        </label>
        <MonoLabel className="text-signal">bid &gt; {formatEth(highestBid)} eth</MonoLabel>
      </div>

      <input
        id="bid-amount"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={amount}
        disabled={disabled}
        placeholder="0.001"
        onChange={(event) => {
          setAmount(event.target.value);
          setMessage(null);
        }}
        className="border border-surface-3 bg-surface-2 px-3 py-2 font-mono text-paper placeholder:text-signal"
      />

      {message !== null ? (
        <p role="alert" className="font-mono text-sm text-white">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={disabled}
        className="border-2 border-white bg-white px-4 py-2 text-void transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <MonoLabel className="text-void">place bid</MonoLabel>
      </button>
    </form>
  );
}
