import { DisplayHeading } from '../components/DisplayHeading';
import { MonoLabel } from '../components/MonoLabel';

/** Spec edge-case error kinds (data-model §1 — only these two, never raw). */
export type ErrorKind = 'chain_unreachable' | 'not_deployed';

const DEFAULT_MESSAGE: Record<ErrorKind, string> = {
  chain_unreachable:
    'The auction chain is unreachable — check the host chain process, then reload. No changes were made on-chain.',
  not_deployed:
    'Contract addresses missing — run scripts/deploy.sh first, then reload.',
};

interface ErrorStateProps {
  kind: ErrorKind;
  /** Precise boot-time detail; defaults to the canonical copy. */
  message?: string;
  /** Reload action override (tests); defaults to `window.location.reload`. */
  onReload?: () => void;
}

/**
 * Full-page Caliper error view (frontend-ui.md §1 `<ErrorState>`, SC-005 /
 * FR-015): the ONLY page shown when the app cannot serve live auction data —
 * never a blank page and never broken panels next to raw errors.
 *
 * - `chain_unreachable` — RPC/chain down at runtime (App swaps the page when
 *   reads fail) or the server was unreachable at boot.
 * - `not_deployed` — `/api/config` returned 503 (env not provisioned).
 *
 * Rendering the full page (not a section) keeps the chrome honest: without
 * chain data there is no header state, phase, or log to show.
 */
export function ErrorState({ kind, message, onReload }: ErrorStateProps) {
  return (
    <main
      role="alert"
      data-testid="error-state"
      className="flex min-h-screen flex-col items-start justify-center gap-4 bg-void px-8"
    >
      <DisplayHeading>ENGLISH AUCTION.</DisplayHeading>
      <MonoLabel className="text-white">{kind === 'not_deployed' ? 'not deployed' : 'connection error'}</MonoLabel>
      <p className="max-w-md font-mono text-sm text-paper">{message ?? DEFAULT_MESSAGE[kind]}</p>
      <button
        type="button"
        onClick={onReload ?? ((): void => window.location.reload())}
        className="border-2 border-white bg-white px-4 py-2 text-void transition-opacity hover:opacity-80"
      >
        <MonoLabel className="text-void">reload</MonoLabel>
      </button>
    </main>
  );
}
