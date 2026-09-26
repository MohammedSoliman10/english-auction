import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorState } from './ErrorState';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ErrorState — spec edge cases, SC-005 (never a blank page)', () => {
  it('renders the chain_unreachable view with the reload action', () => {
    const reload = vi.fn();
    render(<ErrorState kind="chain_unreachable" onReload={reload} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/chain is unreachable/i);
    expect(screen.getByText('connection error')).toBeInTheDocument();
    expect(screen.getByText('ENGLISH AUCTION.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^reload$/i }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders the not_deployed view pointing at deploy.sh', () => {
    render(<ErrorState kind="not_deployed" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/deploy\.sh/);
    expect(screen.getByText('not deployed')).toBeInTheDocument();
  });

  it('accepts a precise boot-time message override', () => {
    render(<ErrorState kind="chain_unreachable" message="Cannot reach the server — reload." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the server — reload.');
    // default copy is replaced, not appended
    expect(screen.getByRole('alert')).not.toHaveTextContent(/check the host/i);
  });

  it('stays on the achromatic ramp (Caliper full-page view)', () => {
    const { container } = render(<ErrorState kind="chain_unreachable" />);
    const main = container.querySelector('main');
    expect(main?.className).toContain('bg-void');
    expect(main?.className).toContain('min-h-screen');
  });
});
