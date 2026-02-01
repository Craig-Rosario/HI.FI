'use client'

import { useState } from 'react'
import { TrendingUp, Users, Lock, ArrowUpRight, X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

const pools = [
  {
    id: 1,
    name: 'Low Risk Pool',
    risk: 'LOW',
    status: 'Active',
    currentAmount: 450,
    threshold: 1000,
    estimatedYield: '5-8',
    exitCalendar: 'Weekly',
    waitTime: '~7 days',
    minDeposit: 1000,
    description: 'Conservative strategy with stable returns',
  },
  {
    id: 2,
    name: 'Medium Risk Pool',
    risk: 'MEDIUM',
    status: 'Active',
    currentAmount: 350,
    threshold: 700,
    estimatedYield: '12-18',
    exitCalendar: 'Daily',
    waitTime: '~24 hours',
    minDeposit: 700,
    description: 'Balanced approach for moderate returns',
  },
  {
    id: 3,
    name: 'High Risk Pool',
    risk: 'HIGH',
    status: 'Active',
    currentAmount: 230,
    threshold: 500,
    estimatedYield: '25-35',
    exitCalendar: 'Hours',
    waitTime: '~2-4 hours',
    minDeposit: 500,
    description: 'Aggressive strategy for maximum returns',
  },
]

const chains = [
  { id: 'ethereum', name: 'Ethereum', balance: 1250.50, disabled: false, logo: '/images/eth.svg' },
  { id: 'base', name: 'Base', balance: 850.25, disabled: false, logo: '/images/base.svg' },
  { id: 'arbitrum', name: 'Arbitrum', balance: 0, disabled: true, logo: '/images/arbitrum.svg' },
]

export default function PoolsPage() {
  const [selectedPool, setSelectedPool] = useState<number | null>(null)
  const [selectedChain, setSelectedChain] = useState('ethereum')
  const [investAmount, setInvestAmount] = useState('')
  const [showChainDropdown, setShowChainDropdown] = useState(false)
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return 'text-green-500 bg-green-500/10 border-green-500/20'
      case 'MEDIUM':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
      case 'HIGH':
        return 'text-rose-500 bg-rose-500/10 border-rose-500/20'
      default:
        return 'text-gray-400 bg-gray-800 border-gray-700'
    }
  }

  const getStatusColor = (status: string) => {
    return status === 'Active'
      ? 'text-green-400 bg-green-500/10 border-green-500/20'
      : 'text-orange-400 bg-orange-500/10 border-orange-500/20'
  }

  const formatUSDC = (amount: number) => {
    return amount.toLocaleString('en-US')
  }

  const getSelectedChain = () => chains.find(chain => chain.id === selectedChain)
  const protocolFee = investAmount ? parseFloat(investAmount) * 0.005 : 0 // 0.5% fee
  const netInvested = investAmount ? parseFloat(investAmount) - protocolFee : 0

  const openModal = (poolId: number) => {
    setSelectedPool(poolId)
    setInvestAmount('')
  }

  const closeModal = () => {
    setSelectedPool(null)
    setShowChainDropdown(false)
  }

  const getCurrentPool = () => pools.find(pool => pool.id === selectedPool)

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Investment Pools</h1>
        <p className="text-foreground/70">
          Choose from our curated risk-based investment pools. HI.Fi supports multichain entry from Ethereum, Base, and Arbitrum.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <h3 className="font-semibold text-blue-400 mb-2">🌐 Multichain Entry Supported</h3>
          <p className="text-sm text-foreground/70">
            Users can join from <strong>Ethereum, Base, or Arbitrum</strong> testnet with any token. All pools denominated in USDC.
          </p>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
          <h3 className="font-semibold text-orange-400 mb-2">⚠️ Risk Disclaimer</h3>
          <p className="text-sm text-foreground/70">
            All investments carry risk. Higher risk pools offer potential for greater returns but also greater potential losses. 
            Please invest only what you can afford to lose and consider your risk tolerance carefully.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {pools.map((pool) => (
          <div
            key={pool.id}
            className="bg-card border border-gray-800 rounded-lg p-6 hover:border-blue-500/50 transition"
          >
            <div className="mb-4">
              <h3 className="font-bold text-xl mb-3">{pool.name}</h3>
              <div className="flex gap-2 mb-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(pool.risk)}`}>
                  {pool.risk}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(pool.status)}`}>
                  {pool.status}
                </span>
              </div>
              <p className="text-sm text-gray-300">{pool.description}</p>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Pool Progress</span>
                <span className="font-semibold">{formatUSDC(pool.currentAmount)}/{formatUSDC(pool.threshold)} USDC</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3">
                <div
                  className="bg-linear-to-r from-blue-600 to-blue-400 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(pool.currentAmount / pool.threshold) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {Math.round((pool.currentAmount / pool.threshold) * 100)}% funded
              </p>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Estimated Yield</span>
                <span className="font-semibold text-green-400">{pool.estimatedYield}% APY*</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Exit Calendar</span>
                <span className="font-semibold">{pool.exitCalendar}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Wait Time</span>
                <span className="font-semibold text-orange-400">{pool.waitTime}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Min Deposit</span>
                <span className="font-semibold">{pool.minDeposit} USDC</span>
              </div>
            </div>

            <Button 
              size="sm" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => openModal(pool.id)}
            >
              Join Pool
            </Button>
          </div>
        ))}
      </div>

      {selectedPool && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
            onClick={closeModal}
            style={{ backdropFilter: 'blur(8px)' }}
          />
          
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <div>
                  <h2 className="text-2xl font-bold">{getCurrentPool()?.name}</h2>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(getCurrentPool()?.risk || '')}`}>
                      {getCurrentPool()?.risk} RISK
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(getCurrentPool()?.status || '')}`}>
                      {getCurrentPool()?.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">USDC-only • Non-custodial</p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Funding</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Funding Chain
                    </label>
                    <div className="relative">
                      <button
                        onClick={() => setShowChainDropdown(!showChainDropdown)}
                        className="w-full flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 relative">
                            <Image
                              src={getSelectedChain()?.logo || ''}
                              alt={getSelectedChain()?.name || ''}
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{getSelectedChain()?.name}</p>
                            <p className="text-sm text-gray-400">{getSelectedChain()?.balance.toLocaleString()} USDC</p>
                          </div>
                        </div>
                        <ChevronDown size={16} className={`transition-transform ${showChainDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {showChainDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
                          {chains.map((chain) => (
                            <button
                              key={chain.id}
                              onClick={() => {
                                if (!chain.disabled) {
                                  setSelectedChain(chain.id)
                                  setShowChainDropdown(false)
                                }
                              }}
                              disabled={chain.disabled}
                              className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                                chain.disabled ? 'opacity-50 cursor-not-allowed' : ''
                              } ${selectedChain === chain.id ? 'bg-gray-700' : ''}`}
                            >
                              <div className="w-6 h-6 relative">
                                <Image
                                  src={chain.logo}
                                  alt={chain.name}
                                  width={24}
                                  height={24}
                                  className="rounded-full"
                                />
                              </div>
                              <div>
                                <p className="font-medium">{chain.name}</p>
                                <p className="text-sm text-gray-400">{chain.balance.toLocaleString()} USDC</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      Available balance: {getSelectedChain()?.balance.toLocaleString()} USDC
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Amount</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Amount to invest (USDC on {getSelectedChain()?.name})
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={investAmount}
                        onChange={(e) => setInvestAmount(e.target.value)}
                        placeholder="0"
                        className="w-full p-3 pr-20 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button
                          onClick={() => setInvestAmount(getSelectedChain()?.balance.toString() || '0')}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                        >
                          MAX
                        </button>
                        <span className="text-gray-400">USDC</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-400 mt-2">
                      <span>Min: {getCurrentPool()?.minDeposit} USDC</span>
                      <span>Max: {getSelectedChain()?.balance.toLocaleString()} USDC</span>
                    </div>
                    {investAmount && (
                      <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-sm">
                          <span className="text-gray-400">You will invest: </span>
                          <span className="font-semibold text-blue-400">
                            {parseFloat(investAmount).toLocaleString()} USDC on {getSelectedChain()?.name}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {investAmount && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Preview</h3>
                    <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">You send</span>
                        <span className="font-medium">{parseFloat(investAmount).toLocaleString()} USDC</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Protocol fee (0.5%)</span>
                        <span className="font-medium">{protocolFee.toFixed(2)} USDC</span>
                      </div>
                      <hr className="border-gray-700" />
                      <div className="flex justify-between font-semibold">
                        <span>Net invested</span>
                        <span className="text-green-400">{netInvested.toFixed(2)} USDC</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-semibold mb-4">Pool Info</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Execution chain</span>
                      <span className="font-medium">Ethereum</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Target APY</span>
                      <span className="font-medium text-green-400">{getCurrentPool()?.estimatedYield}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Exit window</span>
                      <span className="font-medium">{getCurrentPool()?.exitCalendar}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Estimated withdrawal time</span>
                      <span className="font-medium">{getCurrentPool()?.waitTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Yield paid in</span>
                      <span className="font-medium">USDC</span>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                  <p className="text-sm text-orange-200">
                    <strong>Risk Warning:</strong> All investments carry risk of loss. Past performance does not guarantee future results.
                  </p>
                </div>

                {investAmount && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Confirmation</h3>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Invested USDC</span>
                        <span className="font-medium">{netInvested.toFixed(2)} USDC</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Funding chain</span>
                        <span className="font-medium">{getSelectedChain()?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Execution chain</span>
                        <span className="font-medium">Ethereum</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <Button
                    variant="outline"
                    onClick={closeModal}
                    className="flex-1 border-gray-600 hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={!investAmount || parseFloat(investAmount) < (getCurrentPool()?.minDeposit || 0)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Confirm Investment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}


    </div>
  )
}
