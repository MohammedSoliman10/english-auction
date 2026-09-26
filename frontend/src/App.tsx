import { HairlineGrid } from './components/HairlineGrid';
import { TxToast } from './components/TxToast';
import { TxProvider, useTxStore } from './app/TxProvider';
import { ActivityLog } from './sections/ActivityLog';
import { AuctionPanel } from './sections/AuctionPanel';
import { BidForm } from './sections/BidForm';
import { Header } from './sections/Header';

/**
 * Single-page auction composition (frontend-ui.md §1, US1 scope).
 *
 * Phase-exclusive action areas are inserted between <BidForm> and
 * <ActivityLog> as later user stories land (StartPanel, WithdrawPanel,
 * SettlePanel, ResultPanel, MintPanel) — panels stay mutually exclusive
 * by `phase` so only one primary action is ever offered (FR-004).
 */
export function AuctionPage() {
  const store = useTxStore();
  const tx = store?.tx ?? { status: 'idle' as const };
  const onDismiss = store?.reset ?? ((): void => undefined);

  return (
    <div className="relative min-h-screen bg-void">
      <HairlineGrid />
      <Header />
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
        <AuctionPanel />
        <BidForm />
        <ActivityLog />
      </main>
      {/* FR-010 global lifecycle surface — one toast for every wallet action. */}
      <TxToast tx={tx} onDismiss={onDismiss} />
    </div>
  );
}

/** App root: shared TxProvider store feeding the global <TxToast>. */
export function App() {
  return (
    <TxProvider>
      <AuctionPage />
    </TxProvider>
  );
}
