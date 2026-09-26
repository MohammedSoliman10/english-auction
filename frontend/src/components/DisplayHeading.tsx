import type { ReactNode } from 'react';

interface DisplayHeadingProps {
  children: ReactNode;
  className?: string;
}

/** Tight grotesk display heading — the brand voice of the Caliper UI. */
export function DisplayHeading({ children, className = '' }: DisplayHeadingProps) {
  return (
    <h1
      className={`font-display text-4xl font-black tracking-tight text-white sm:text-5xl ${className}`}
    >
      {children}
    </h1>
  );
}
