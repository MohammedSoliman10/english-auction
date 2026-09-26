import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/caliper.css';
import { loadRuntimeConfig } from './lib/config';
import { Providers } from './app/providers';
import { App } from './App';
import { DisplayHeading } from './components/DisplayHeading';
import { MonoLabel } from './components/MonoLabel';

/** Full-page connection error — config fetch failed (FR-015, never blank). */
function BootError({ message }: { message: string }) {
  return (
    <main
      role="alert"
      className="flex min-h-screen flex-col items-start justify-center gap-4 bg-void px-8"
    >
      <DisplayHeading>ENGLISH AUCTION.</DisplayHeading>
      <MonoLabel className="text-white">connection error</MonoLabel>
      <p className="max-w-md font-mono text-sm text-paper">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="border-2 border-white bg-white px-4 py-2 text-void"
      >
        <MonoLabel className="text-void">reload</MonoLabel>
      </button>
    </main>
  );
}

/**
 * Boot sequence (contract §6): fetch /api/config → providers → app tree.
 * Any failure renders the actionable connection-error state.
 */
export async function renderApp(
  root: HTMLElement | null = document.getElementById('root'),
): Promise<void> {
  if (!root) return;

  let config;
  try {
    config = await loadRuntimeConfig();
  } catch (err) {
    createRoot(root).render(<BootError message={err instanceof Error ? err.message : String(err)} />);
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
