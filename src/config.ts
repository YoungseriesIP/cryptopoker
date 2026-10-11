/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { requireChain } from './onchain-facts'

// Pull the RPC URL from the generated facts registry (never hardcode)
const arcTestnetFact = requireChain(arcTestnet.id)

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnetFact.rpcUrls[0])

export const config = createConfig({
  chains: [arcTestnet, mainnet], // mainnet needed for ENS resolution
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId: '2f05ae7f1116030fde2d36508f472bfb', // public WC projectId
    }),
  ],
  transports: {
    [arcTestnet.id]: http(arcTestnetFact.rpcUrls[0]),
    [mainnet.id]: http(),
  },
})

export { arcTestnet }
