/**
 * ChainGuard — shows a banner when the connected wallet is on the wrong chain,
 * and offers a one-click switch to Arc Testnet.
 */
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { arcTestnet } from 'viem/chains'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

export function ChainGuard() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [switching, setSwitching] = useState(false)

  // Only show when connected but on the wrong chain
  if (!isConnected || chainId === arcTestnet.id) return null

  function handleSwitch() {
    setSwitching(true)
    try {
      switchChain({ chainId: arcTestnet.id })
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5"
      style={{
        background: 'linear-gradient(90deg, rgba(248,113,113,0.15), rgba(245,200,66,0.12))',
        borderBottom: '1px solid rgba(248,113,113,0.3)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
        <span className="text-xs font-semibold truncate" style={{ color: '#f87171' }}>
          Wrong network — switch to Arc Testnet to play
        </span>
      </div>
      <button
        onClick={handleSwitch}
        disabled={switching}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #1e5c38, #2d7a46)',
          border: '1px solid rgba(74,222,128,0.35)',
          color: 'white',
          opacity: switching ? 0.7 : 1,
        }}
      >
        {switching ? <Loader2 size={12} className="animate-spin" /> : null}
        Switch
      </button>
    </div>
  )
}
