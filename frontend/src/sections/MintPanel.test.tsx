import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useMintNft: vi.fn(),
  useAuctionState: vi.fn(),
}));

vi.mock('../hooks/useMintNft', () => ({
  useMintNft: () => mocks.useMintNft(),
}));
vi.mock('../hooks/useAuctionState', () => ({
  useAuctionState: () => mocks.useAuctionState(),
}));

import { MintPanel } from './MintPanel';
import { EMPTY_URI_MESSAGE, INVALID_URI_MESSAGE, NOT_CONNECTED_MESSAGE } from '../lib/errors';

const validate = vi.fn();
const submit = vi.fn();

const VALID_URI = 'https://example.com/meta.json';

function auctionState(overrides: Record<string, unknown> = {}) {
  return { phase: 'NOT_STARTED', isLoading: false, error: undefined, ...overrides };
}

function mintNft(overrides: Record<string, unknown> = {}) {
  return {
    validate,
    submit,
    tx: { status: 'idle' },
    mintedTokenId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  validate.mockReturnValue(null);
  mocks.useAuctionState.mockImplementation(() => auctionState());
  mocks.useMintNft.mockImplementation(() => mintNft());
});

describe('MintPanel — US5 (pre-start onboarding, frontend-ui.md §1)', () => {
  it('shows the URI input and mint CTA in NOT_STARTED', () => {
    render(<MintPanel />);
    expect(screen.getByLabelText(/metadata uri/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^mint$/i })).toBeEnabled();
  });

  it('renders nothing once the auction has started (pre-start only)', () => {
    for (const phase of ['OPEN_FOR_BIDS', 'AWAITING_SETTLEMENT', 'SETTLED']) {
      mocks.useAuctionState.mockImplementation(() => auctionState({ phase }));
      const { container, unmount } = render(<MintPanel />);
      expect(container.firstChild).toBeNull();
      unmount();
    }
  });

  it('blocks an empty URI with the required message and no wallet prompt', () => {
    validate.mockReturnValue(EMPTY_URI_MESSAGE);
    render(<MintPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^mint$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(EMPTY_URI_MESSAGE);
    expect(submit).not.toHaveBeenCalled();
  });

  it('warns on an invalid URI before spending gas (scenario 2)', () => {
    validate.mockReturnValue(INVALID_URI_MESSAGE);
    render(<MintPanel />);
    fireEvent.change(screen.getByLabelText(/metadata uri/i), {
      target: { value: 'banana.json' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^mint$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(INVALID_URI_MESSAGE);
    expect(submit).not.toHaveBeenCalled();
  });

  it('surfaces the disconnected state from validate (T059)', () => {
    validate.mockReturnValue(NOT_CONNECTED_MESSAGE);
    render(<MintPanel />);
    fireEvent.change(screen.getByLabelText(/metadata uri/i), {
      target: { value: VALID_URI },
    });
    fireEvent.click(screen.getByRole('button', { name: /^mint$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(NOT_CONNECTED_MESSAGE);
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits the typed URI when validation passes', () => {
    render(<MintPanel />);
    fireEvent.change(screen.getByLabelText(/metadata uri/i), {
      target: { value: VALID_URI },
    });
    fireEvent.click(screen.getByRole('button', { name: /^mint$/i }));
    expect(validate).toHaveBeenCalledWith(VALID_URI);
    expect(submit).toHaveBeenCalledWith(VALID_URI);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('confirms the new token id on success (scenario 1, FR-008)', () => {
    mocks.useMintNft.mockImplementation(() =>
      mintNft({ tx: { status: 'success' }, mintedTokenId: 7n }),
    );
    render(<MintPanel />);
    expect(screen.getByText('token id')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows no token id before a successful mint', () => {
    render(<MintPanel />);
    expect(screen.queryByText('token id')).not.toBeInTheDocument();
  });

  it('does not suppress the global white focus ring (FR-012)', () => {
    render(<MintPanel />);
    const input = screen.getByLabelText(/metadata uri/i);
    // `outline-none` would override caliper.css `:focus-visible` (higher
    // specificity) — the input must keep the achromatic focus ring.
    expect(input.className).not.toMatch(/outline-none/);
    expect(input.className).toMatch(/focus:border-white/);
  });

  it('disables the CTA while a mint is in flight', () => {
    for (const status of ['awaiting_confirmation', 'pending']) {
      mocks.useMintNft.mockImplementation(() => mintNft({ tx: { status } }));
      const { unmount } = render(<MintPanel />);
      expect(screen.getByRole('button', { name: /^mint$/i })).toBeDisabled();
      unmount();
    }
  });
});
