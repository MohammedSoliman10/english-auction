import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useActivityLog: vi.fn(),
}));

vi.mock('../hooks/useActivityLog', () => ({
  useActivityLog: () => mocks.useActivityLog(),
}));

import { ActivityLog } from './ActivityLog';
import type { ActivityEntry } from '../hooks/useActivityLog';

const BIDDER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const T0 = BigInt(Date.UTC(2026, 8, 26, 12, 0, 0) / 1000);

const ENTRIES: ActivityEntry[] = [
  { id: '104-0', kind: 'End', actor: BIDDER, amount: 1_500_000_000_000_000_000n, time: T0 + 3n },
  { id: '103-0', kind: 'Withdraw', actor: BIDDER, amount: 500_000_000_000_000_000n, time: T0 + 2n },
  { id: '102-0', kind: 'Bid', actor: BIDDER, amount: 1_500_000_000_000_000_000n, time: T0 + 1n },
  { id: '100-0', kind: 'Start', actor: undefined, amount: undefined, time: T0 },
];

function activityLog(overrides: Record<string, unknown> = {}) {
  mocks.useActivityLog.mockReturnValue({
    entries: ENTRIES,
    isLoading: false,
    error: undefined,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  activityLog();
});

describe('ActivityLog — FR-009 on-chain activity (mono table, newest-first)', () => {
  it('lists Start/Bid/Withdraw/End newest-first with actor, amount and time', () => {
    render(<ActivityLog />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(4);

    expect(rows[0]).toHaveTextContent('END');
    expect(rows[0]).toHaveTextContent('0x7099…79C8');
    expect(rows[0]).toHaveTextContent('1.5 eth');
    expect(rows[0]).toHaveTextContent('12:00:03');

    expect(rows[1]).toHaveTextContent('WITHDRAW');
    expect(rows[1]).toHaveTextContent('0.5 eth');

    expect(rows[2]).toHaveTextContent('BID');
    expect(rows[2]).toHaveTextContent('12:00:01');

    expect(rows[3]).toHaveTextContent('START');
    expect(within(rows[3]).getAllByText('—')).toHaveLength(2); // no actor / no amount
  });

  it('renders the grayscale bid-history signal bars', () => {
    render(<ActivityLog />);
    expect(screen.getByRole('img', { name: 'signal history' })).toBeInTheDocument();
  });
});

describe('ActivityLog — non-happy paths (never blank, FR-015)', () => {
  it('shows a loading note while first reading', () => {
    activityLog({ entries: [], isLoading: true });
    render(<ActivityLog />);
    expect(screen.getByText(/reading activity/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('shows an empty state when nothing has happened yet', () => {
    activityLog({ entries: [] });
    render(<ActivityLog />);
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it('surfaces read failures as an alert', () => {
    activityLog({ entries: [], error: 'chain_unreachable' });
    render(<ActivityLog />);
    expect(screen.getByRole('alert')).toHaveTextContent(/chain unreachable/i);
  });
});
