import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  txToastProps: null as { tx?: { status: string }; onDismiss?: () => void } | null,
  useAuctionState: vi.fn(),
}));

vi.mock('./hooks/useAuctionState', () => ({
  useAuctionState: () => mocks.useAuctionState(),
}));
vi.mock('./sections/Header', () => ({
  Header: () => <div data-testid="header" />,
}));
vi.mock('./sections/AuctionPanel', () => ({
  AuctionPanel: () => <div data-testid="auction-panel" />,
}));
vi.mock('./sections/BidForm', () => ({
  BidForm: () => <div data-testid="bid-form" />,
}));
vi.mock('./sections/StartPanel', () => ({
  StartPanel: () => <div data-testid="start-panel" />,
}));
vi.mock('./sections/MintPanel', () => ({
  MintPanel: () => <div data-testid="mint-panel" />,
}));
vi.mock('./sections/WithdrawPanel', () => ({
  WithdrawPanel: () => <div data-testid="withdraw-panel" />,
}));
vi.mock('./sections/SettlePanel', () => ({
  SettlePanel: () => <div data-testid="settle-panel" />,
}));
vi.mock('./sections/ResultPanel', () => ({
  ResultPanel: () => <div data-testid="result-panel" />,
}));
vi.mock('./sections/ActivityLog', () => ({
  ActivityLog: () => <div data-testid="activity-log" />,
}));
vi.mock('./components/TxToast', () => ({
  TxToast: (props: { tx: { status: string }; onDismiss: () => void }) => {
    mocks.txToastProps = props;
    return <div data-testid="tx-toast" data-status={props.tx.status} />;
  },
}));
vi.mock('./components/HairlineGrid', () => ({
  HairlineGrid: () => <div data-testid="hairline-grid" />,
}));

import { App } from './App';

function mountOrder(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('[data-testid]')].map((el) =>
    el.getAttribute('data-testid'),
  );
}

function renderWithPhase(phase: string) {
  mocks.useAuctionState.mockReturnValue({ phase });
  return render(<App />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.txToastProps = null;
});

describe('App — single-page composition (frontend-ui.md §1, T038/T044)', () => {
  it('shows MintPanel handing off to StartPanel pre-start — no bid form (US5, matrix §3)', () => {
    const { container } = renderWithPhase('NOT_STARTED');
    expect(mountOrder(container)).toEqual([
      'hairline-grid',
      'header',
      'auction-panel',
      'mint-panel',
      'start-panel',
      'withdraw-panel',
      'activity-log',
      'tx-toast',
    ]);
  });

  it('trades StartPanel for BidForm once bidding opens', () => {
    const { container } = renderWithPhase('OPEN_FOR_BIDS');
    expect(mountOrder(container)).toEqual([
      'hairline-grid',
      'header',
      'auction-panel',
      'bid-form',
      'withdraw-panel',
      'activity-log',
      'tx-toast',
    ]);
  });

  it('swaps in SettlePanel at AWAITING_SETTLEMENT and ResultPanel at SETTLED (matrix §3)', () => {
    const { container: awaiting, unmount: u1 } = renderWithPhase('AWAITING_SETTLEMENT');
    const awaitingOrder = mountOrder(awaiting);
    u1();

    const { container: settled, unmount: u2 } = renderWithPhase('SETTLED');
    const settledOrder = mountOrder(settled);
    u2();

    expect(awaitingOrder).toEqual([
      'hairline-grid',
      'header',
      'auction-panel',
      'settle-panel',
      'withdraw-panel',
      'activity-log',
      'tx-toast',
    ]);
    expect(settledOrder).toEqual([
      'hairline-grid',
      'header',
      'auction-panel',
      'result-panel',
      'withdraw-panel',
      'activity-log',
      'tx-toast',
    ]);

    // never a competing primary action in either terminal phase
    for (const order of [awaitingOrder, settledOrder]) {
      expect(order).not.toContain('bid-form');
      expect(order).not.toContain('start-panel');
    }
  });

  it('mounts TxToast globally from the shared TxProvider store (FR-010)', () => {
    renderWithPhase('OPEN_FOR_BIDS');
    const toast = screen.getByTestId('tx-toast');
    expect(toast).toHaveAttribute('data-status', 'idle');
    expect(typeof mocks.txToastProps?.onDismiss).toBe('function');
  });
});
