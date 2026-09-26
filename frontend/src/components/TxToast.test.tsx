import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TxToast } from './TxToast';

const HASH = '0x1234567890abcdef1234567890abcdef12345678' as const;

describe('TxToast', () => {
  it('renders nothing while idle', () => {
    const { container } = render(<TxToast tx={{ status: 'idle' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('asks for wallet confirmation while awaiting', () => {
    render(<TxToast tx={{ status: 'awaiting_confirmation' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/confirm in your wallet/i);
  });

  it('shows the shortened hash while pending', () => {
    render(<TxToast tx={{ status: 'pending', hash: HASH }} />);
    expect(screen.getByRole('status')).toHaveTextContent('0x1234…5678');
  });

  it('reports success, rejection, and revert distinctly (FR-010)', () => {
    const { rerender } = render(<TxToast tx={{ status: 'success' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/confirmed/i);

    rerender(<TxToast tx={{ status: 'rejected' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/rejected/i);

    rerender(<TxToast tx={{ status: 'reverted', message: 'Transfer failed — retry' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Transfer failed — retry');
  });

  it('offers a dismiss control on terminal outcomes only', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<TxToast tx={{ status: 'success' }} onDismiss={onDismiss} />);

    const dismiss = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    // In-flight actions cannot be dismissed — only terminal states can.
    rerender(<TxToast tx={{ status: 'awaiting_confirmation' }} onDismiss={onDismiss} />);
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();

    rerender(<TxToast tx={{ status: 'pending', hash: HASH }} onDismiss={onDismiss} />);
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });
});
