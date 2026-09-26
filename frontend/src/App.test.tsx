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
  it('shows the seller start action pre-start — no bid form (matrix §3)', () => {
    const { container } = renderWithPhase('NOT_STARTED');
    expect(mountOrder(container)).toEqual([
      'hairline-grid',
      'header',
      'auction-panel',
      'start-panel',
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
      'activity-log',
      'tx-toast',
    ]);
  });

  it('offers no primary action while awaiting settlement / settled', () => {
    for (const phase of ['AWAITING_SETTLEMENT', 'SETTLED']) {
      const { container, unmount } = renderWithPhase(phase);
      const order = mountOrder(container);
      expect(order).not.toContain('bid-form');
      expect(order).not.toContain('start-panel');
      expect(order).toEqual([
        'hairline-grid',
        'header',
        'auction-panel',
        'activity-log',
        'tx-toast',
      ]);
      unmount();
    }
  });

  it('mounts TxToast globally from the shared TxProvider store (FR-010)', () => {
    renderWithPhase('OPEN_FOR_BIDS');
    const toast = screen.getByTestId('tx-toast');
    expect(toast).toHaveAttribute('data-status', 'idle');
    expect(typeof mocks.txToastProps?.onDismiss).toBe('function');
  });
});
