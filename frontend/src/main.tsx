import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/caliper.css';
import { ConfigLoadError, loadRuntimeConfig } from './lib/config';
import { Providers } from './app/providers';
import { App } from './App';
import { ErrorState, type ErrorKind } from './sections/ErrorState';

/**
 * Boot sequence (contract §6): fetch /api/config → providers → app tree.
 * Any failure renders the full-page ErrorState (T065) with its precise
 * boot-time message — never a blank page (FR-015).
 */
export async function renderApp(
  root: HTMLElement | null = document.getElementById('root'),
): Promise<void> {
  if (!root) return;

  let config;
  try {
    config = await loadRuntimeConfig();
  } catch (err) {
    const kind: ErrorKind = err instanceof ConfigLoadError ? err.kind : 'chain_unreachable';
    const message = err instanceof Error ? err.message : String(err);
    createRoot(root).render(<ErrorState kind={kind} message={message} />);
    return;
  }

  createRoot(root).render(
    <StrictMode>
      <Providers config={config}>
        <App />
      </Providers>
    </StrictMode>,
  );
}

if (import.meta.env.MODE !== 'test') {
  void renderApp();
}
