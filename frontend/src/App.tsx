import { HairlineGrid } from './components/HairlineGrid';
import { TxToast } from './components/TxToast';
import { TxProvider, useTxStore } from './app/TxProvider';
import { useAuctionState } from './hooks/useAuctionState';
import { ActivityLog } from './sections/ActivityLog';
import { AuctionPanel } from './sections/AuctionPanel';
import { BidForm } from './sections/BidForm';
import { Header } from './sections/Header';
import { StartPanel } from './sections/StartPanel';
import { WithdrawPanel } from './sections/WithdrawPanel';

/**
 * Single-page auction composition (frontend-ui.md §1).
 *
 * Phase-exclusive action areas (FR-004 — one primary action at a time):
 *   NOT_STARTED → <StartPanel>   OPEN_FOR_BIDS → <BidForm>
 *   AWAITING_SETTLEMENT / SETTLED → none yet (US4 mounts SettlePanel /
 *   ResultPanel in the same slot).
 * <WithdrawPanel> is the secondary area: it self-gates on myRefundable > 0
 * and stays mounted in every phase — a credit is claimable at any time
 * after being outbid (FR-005).
 */
export function AuctionPage() {
  const store = useTxStore();
  const { phase } = useAuctionState();
  const tx = store?.tx ?? { status: 'idle' as const };
  const onDismiss = store?.reset ?? ((): void => undefined);

  return (
    <div className="relative min-h-screen bg-void">
      <HairlineGrid />
      <Header />
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
        <AuctionPanel />
        {phase === 'NOT_STARTED' ? <StartPanel /> : null}
        {phase === 'OPEN_FOR_BIDS' ? <BidForm /> : null}
        <WithdrawPanel />
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
