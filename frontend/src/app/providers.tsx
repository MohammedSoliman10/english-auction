import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RuntimeConfigContext } from '../lib/config';
import { createWagmiConfig } from './wagmi';
import type { RuntimeConfig } from '../lib/types';

interface ProvidersProps {
  config: RuntimeConfig;
  children: ReactNode;
}

/** App-level providers: runtime config context + wagmi + TanStack Query. */
export function Providers({ config, children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 },
        },
      }),
  );
  const [wagmiConfig] = useState(() => createWagmiConfig(config));

  return (
    <RuntimeConfigContext.Provider value={config}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    </RuntimeConfigContext.Provider>
  );
}
