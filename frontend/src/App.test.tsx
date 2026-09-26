import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  txToastProps: null as { tx?: { status: string }; onDismiss?: () => void } | null,
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.txToastProps = null;
});

describe('App — single-page composition (frontend-ui.md §1, T038)', () => {
  it('composes header, panels, activity log and the global toast in spec order', () => {
    const { container } = render(<App />);

    const order = [...container.querySelectorAll('[data-testid]')].map((el) =>
      el.getAttribute('data-testid'),
    );
    expect(order).toEqual([
      'hairline-grid',
      'header',
      'auction-panel',
      'bid-form',
      'activity-log',
      'tx-toast',
    ]);
  });

  it('mounts TxToast globally from the shared TxProvider store (FR-010)', () => {
    render(<App />);
    const toast = screen.getByTestId('tx-toast');
    expect(toast).toHaveAttribute('data-status', 'idle');
    expect(typeof mocks.txToastProps?.onDismiss).toBe('function');
  });
});
