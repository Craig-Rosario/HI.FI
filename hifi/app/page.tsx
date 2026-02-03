'use client'

import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { injected } from 'wagmi/connectors'
import DepositRouterABI from '@/lib/abis/DepositRouter.json'
import { Loader2, Wallet, ArrowRight } from 'lucide-react'

// TODO: Replace with deployed addresses
const DEPOSIT_ROUTER = "0x0000000000000000000000000000000000000000"
const VAULT_ADDRESS = "0x0000000000000000000000000000000000000000"
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" // Base Sepolia USDC

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const [amount, setAmount] = useState('')

  const handleConnect = () => connect({ connector: injected() })

  const handleDeposit = async () => {
    if (!amount) return

    // 1. Approve (Simplified: Assuming approval logic or user has approved. 
    // real app would check allowance first)
    // For this MVP UI, we'll try to call deposit directly and expect failure if not approved,
    // or we can add an 'Approve' button. Let's add Approve button logic implicitly or separate.
    // For simplicity: this calls depositSameChain.

    // Params: tokenIn, SwapParams, vault, minShares
    // SwapParams: poolKey, zeroForOne, amountIn, minAmountOut, hookData
    // We mock these for the UI demo.

    const swapParams = {
      poolKey: {
        currency0: "0x0000000000000000000000000000000000000000",
        currency1: "0x0000000000000000000000000000000000000000",
        fee: 3000,
        tickSpacing: 60,
        hooks: "0x0000000000000000000000000000000000000000"
      },
      zeroForOne: true,
      amountIn: parseUnits(amount, 6), // USDC 6 decimals
      minAmountOut: 0n,
      hookData: "0x"
    }

    writeContract({
      address: DEPOSIT_ROUTER,
      abi: DepositRouterABI.abi,
      functionName: 'depositSameChain',
      args: [
        USDC_ADDRESS,
        swapParams,
        VAULT_ADDRESS,
        0n // minShares
      ],
    })
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans selection:bg-purple-500/30">
      {/* Navbar */}
      <nav className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-lg" />
            <span className="text-xl font-bold tracking-tight">HI.FI</span>
          </div>

          <button
            onClick={isConnected ? () => disconnect() : handleConnect}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-all flex items-center gap-2"
          >
            {isConnected ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </>
            )}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-20 items-center">

          {/* Hero Section */}
          <div className="space-y-8">
            <h1 className="text-6xl font-extrabold leading-tight tracking-tight">
              Automated Treasury <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 animate-gradient">
                Management
              </span>
            </h1>
            <p className="text-xl text-neutral-400 leading-relaxed max-w-lg">
              Non-custodial, agent-driven vaults powered by Uniswap V4.
              Earn yield with mathematical precision.
            </p>

            <div className="flex items-center gap-4 pt-4">
              <div className="flex -space-x-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-neutral-900 bg-neutral-800 flex items-center justify-center text-xs text-neutral-500">
                    U{i}
                  </div>
                ))}
              </div>
              <span className="text-sm text-neutral-500">Trusted by early adopters</span>
            </div>
          </div>

          {/* Deposit Card */}
          <div className="bg-neutral-800/50 border border-white/5 p-8 rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Deposit</h2>
                <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded">Base Sepolia</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-neutral-400 ml-1">Amount (USDC)</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-4 text-2xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-neutral-700"
                  />
                  <button className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-500 hover:text-white transition-colors">
                    MAX
                  </button>
                </div>
              </div>

              {isConnected ? (
                <button
                  onClick={handleDeposit}
                  disabled={isPending || isConfirming}
                  className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isPending || isConfirming ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Deposit Funds <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all"
                >
                  Connect Wallet
                </button>
              )}

              {hash && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs font-mono break-all">
                  Tx: {hash}
                </div>
              )}

              {isConfirmed && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-mono">
                  Transaction Confirmed!
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
