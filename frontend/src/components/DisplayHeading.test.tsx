import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DisplayHeading } from './DisplayHeading';

describe('DisplayHeading', () => {
  it('renders display text', () => {
    render(<DisplayHeading>ENGLISH AUCTION.</DisplayHeading>);
    expect(screen.getByRole('heading', { name: 'ENGLISH AUCTION.' })).toBeInTheDocument();
  });

  it('uses the tight grotesk display font utility', () => {
    render(<DisplayHeading>lot 01</DisplayHeading>);
    expect(screen.getByRole('heading').classList.contains('font-display')).toBe(true);
  });
});
