'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, midnightTheme } from '@rainbow-me/rainbowkit'
import { config } from '@/lib/wagmi'
import { useState, type ReactNode } from 'react'
import '@rainbow-me/rainbowkit/styles.css'

export function Providers(props: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={midnightTheme({
          accentColor: '#ef4444', // Red for Impostor/Among Us vibe
          accentColorForeground: 'white',
          borderRadius: 'medium',
        })}>
          {props.children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
