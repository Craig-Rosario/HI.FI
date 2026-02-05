'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Users, Lock, ArrowUpRight, X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { IPool } from '@/models/Pool'
import { useInvest, SourceChain } from '@/hooks/use-invest'
import { InvestmentProgressModal } from '@/components/investment-progress-modal'
import { HighRiskPoolCard } from '@/components/pools/high-risk-pool-card'
import { AgentPermissionsManager } from '@/components/agent/agent-permissions-manager'

// Type for the UI pool with additional display properties
interface UIPool extends Omit<IPool, 'createdAt' | 'updatedAt'> {
  id: string; // Use _id as id for consistency with existing UI
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'Collecting' | 'Earning Yield' | 'Withdraw Open' | 'Inactive';
  currentAmount: number;
  threshold: number;
  estimatedYield: string;
  exitCalendar: string;
  waitTimeDisplay: string;
  isCapReached: boolean;
  progress: number; // 0-100 capped
  userShares?: number;
  withdrawOpen?: boolean; // Is withdraw available now?
  withdrawTimeLeft?: number; // Seconds until withdraw opens
}

const chains = [
  { id: 'ethereum', name: 'Ethereum', balance: 1250.50, disabled: false, logo: '/images/eth.svg' },
  { id: 'base', name: 'Base', balance: 850.25, disabled: false, logo: '/images/base.svg' },
  { id: 'arbitrum', name: 'Arbitrum', balance: 0, disabled: true, logo: '/images/arbitrum.svg' },
]

// Chain info for display
const CHAIN_INFO: Record<string, { name: string; bridgeFee: number; isNative: boolean }> = {
  ethereum: { name: 'Ethereum Sepolia', bridgeFee: 2.1, isNative: false },
  base: { name: 'Base Sepolia', bridgeFee: 0, isNative: true },
};

// Helper function to convert DB pool to UI pool
function convertPoolToUIPool(dbPool: IPool): UIPool {
  const currentAmount = parseFloat(dbPool.tvl);
  const threshold = parseFloat(dbPool.cap);
  const isCapReached = currentAmount >= threshold;
  const progress = Math.min(Math.round((currentAmount / threshold) * 100), 100);
  
  // Convert risk level from db format to UI format
  const riskMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
    'low': 'LOW',
    'medium': 'MEDIUM', 
    'high': 'HIGH'
  };
  const risk = riskMap[dbPool.riskLevel] || 'LOW';
  
  // Determine status based on state, withdrawOpen, and TVL
  let status: UIPool['status'] = 'Inactive';
  if (dbPool.state === 'COLLECTING') {
    status = 'Collecting'; // Will show "Auto-deploying" if isCapReached
  } else if (dbPool.state === 'DEPLOYED') {
    // If withdraw is open (1 min after deployment), show Withdraw Open
    status = dbPool.withdrawOpen ? 'Withdraw Open' : 'Earning Yield';
  } else if (dbPool.state === 'WITHDRAW_WINDOW') {
    status = 'Withdraw Open';
  }
  
  // Set exit calendar based on risk level
  const exitCalendarMap: Record<string, string> = {
    'LOW': 'Weekly',
    'MEDIUM': 'Bi-weekly',
    'HIGH': 'Monthly'
  };
  
  return {
    ...dbPool,
    id: dbPool._id,
    risk,
    status,
    currentAmount,
    threshold,
    estimatedYield: dbPool.apy === '0' ? (risk === 'MEDIUM' ? '-2 to +6' : '5-8') : dbPool.apy, // Different estimate for medium risk
    exitCalendar: exitCalendarMap[risk] || 'Weekly',
    waitTimeDisplay: `~${Math.ceil(dbPool.waitTime / 60)} minutes`,
    isCapReached,
    progress,
    withdrawOpen: dbPool.withdrawOpen,
    withdrawTimeLeft: dbPool.withdrawTimeLeft,
  };
}

export default function PoolsPage() {
  const [pools, setPools] = useState<UIPool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPool, setSelectedPool] = useState<string | null>(null)
  const [selectedChain, setSelectedChain] = useState('ethereum')
  const [investAmount, setInvestAmount] = useState('')
  const [showChainDropdown, setShowChainDropdown] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [withdrawPool, setWithdrawPool] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [userAddress, setUserAddress] = useState<string | null>(null)
  const [userShares, setUserShares] = useState<Record<string, string>>({})
  // Investment hook
  const { state: investState, invest, reset: resetInvest } = useInvest()

  // Get user wallet address
  useEffect(() => {
    const getAddress = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' })
          if (accounts?.length > 0) {
            setUserAddress(accounts[0])
          }
        } catch (err) {
          console.error('Failed to get accounts:', err)
        }
      }
    }
    getAddress()
  }, [])

  // Fetch pools from API
  useEffect(() => {
    const fetchPools = async () => {
      try {
        const response = await fetch('/api/pools')
        if (!response.ok) {
          throw new Error('Failed to fetch pools')
        }
        const data = await response.json()
        if (data.success) {
          const uiPools = data.data.map(convertPoolToUIPool)
          setPools(uiPools)
        } else {
          throw new Error(data.error || 'Failed to fetch pools')
        }
      } catch (err) {
        console.error('Error fetching pools:', err)
        setError(err instanceof Error ? err.message : 'Failed to load pools')
      } finally {
        setLoading(false)
      }
    }

    fetchPools()
  }, [])

  // Cleanup body overflow when component unmounts or modal closes
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  useEffect(() => {
    if (!selectedPool) {
      document.body.style.overflow = 'unset'
    }
  }, [selectedPool])

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

  const getStatusColor = (status: string, isCapReached?: boolean) => {
    if (status === 'Collecting' && isCapReached) {
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' // Auto-deploying
    }
    switch (status) {
      case 'Collecting':
        return 'text-green-400 bg-green-500/10 border-green-500/20'
      case 'Earning Yield':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
      case 'Withdraw Open':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20'
      default:
        return 'text-orange-400 bg-orange-500/10 border-orange-500/20'
    }
  }

  const formatUSDC = (amount: number) => {
    return amount.toLocaleString('en-US')
  }

  const getSelectedChain = () => chains.find(chain => chain.id === selectedChain)
  const chainInfo = CHAIN_INFO[selectedChain] || CHAIN_INFO.ethereum
  const bridgeFee = chainInfo.bridgeFee
  const protocolFee = investAmount ? parseFloat(investAmount) * 0.005 : 0 // 0.5% fee
  const totalFees = protocolFee + bridgeFee
  const netInvested = investAmount ? parseFloat(investAmount) - totalFees : 0

  const openModal = (poolId: string) => {
    setSelectedPool(poolId)
    setInvestAmount('')
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
  }

  const closeModal = () => {
    setSelectedPool(null)
    setShowChainDropdown(false)
    // Restore body scroll when modal is closed
    document.body.style.overflow = 'unset'
  }

  const handleConfirmInvestment = async () => {
    if (!selectedPool || !investAmount) return
    
    // Get the pool's contract address
    const pool = pools.find(p => p.id === selectedPool)
    const poolContractAddress = pool?.contractAddress
    
    // Close the pool modal and show progress modal
    closeModal()
    setShowProgressModal(true)
    
    // Start the investment flow with the pool-specific contract address and selected chain
    await invest(investAmount, selectedPool, poolContractAddress, selectedChain as SourceChain)
  }

  const handleCloseProgressModal = () => {
    setShowProgressModal(false)
    resetInvest()
    setInvestAmount('')
  }

  // Open withdraw modal
  const openWithdrawModal = (poolId: string) => {
    setWithdrawPool(poolId)
    document.body.style.overflow = 'hidden'
  }
  
  const closeWithdrawModal = () => {
    setWithdrawPool(null)
    document.body.style.overflow = 'unset'
  }

  // Handle withdraw - calls smart contract via MetaMask
  // Flow: Vault withdraws from Aave → Wraps to arcUSDC → Sends to user → User unwraps to USDC
  const handleWithdraw = async () => {
    if (!withdrawPool || withdrawing) return
    if (!window.ethereum) {
      alert('Please install MetaMask')
      return
    }
    
    setWithdrawing(true)
    
    try {
      const pool = pools.find(p => p.id === withdrawPool)
      if (!pool) throw new Error('Pool not found')
      
      // Import ethers dynamically
      const { ethers } = await import('ethers')
      
      // Switch to Base Sepolia
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x14a34' }], // 84532 in hex
        })
      } catch (switchError: any) {
        // Chain not added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x14a34',
              chainName: 'Base Sepolia',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://sepolia.base.org'],
              blockExplorerUrls: ['https://sepolia.basescan.org'],
            }],
          })
        }
      }
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const userAddr = await signer.getAddress()
      
      // Pool Vault ABI (Aave integrated)
      const vaultAbi = [
        'function shares(address) external view returns (uint256)',
        'function withdraw(uint256 shareAmount) external',
        'function isWithdrawOpen() external view returns (bool)',
        'function previewWithdraw(address user) external view returns (uint256)',
      ]
      
      const vault = new ethers.Contract(pool.contractAddress, vaultAbi, signer)
      
      // Check user shares
      const userShares = await vault.shares(userAddr)
      if (userShares === BigInt(0)) {
        throw new Error('You have no shares in this pool')
      }
      
      // Preview how much user will receive (including yield)
      try {
        const previewAmount = await vault.previewWithdraw(userAddr)
        console.log(`Withdrawing ${ethers.formatUnits(previewAmount, 6)} USDC (including yield)`)
      } catch {
        // Old contract might not have this
      }
      
      // Withdraw shares (contract handles Aave withdrawal + wrapping to arcUSDC)
      const withdrawTx = await vault.withdraw(userShares)
      await withdrawTx.wait()
      
      // Now unwrap arcUSDC to USDC (user receives arcUSDC from vault)
      const arcUsdcAddress = process.env.NEXT_PUBLIC_ARCUSDC_ADDRESS
      if (arcUsdcAddress) {
        const arcUsdcAbi = [
          'function balanceOf(address) external view returns (uint256)',
          'function withdraw(uint256 amount) external',
        ]
        const arcUsdc = new ethers.Contract(arcUsdcAddress, arcUsdcAbi, signer)
        const arcBalance = await arcUsdc.balanceOf(userAddr)
        
        if (arcBalance > BigInt(0)) {
          console.log(`Unwrapping ${ethers.formatUnits(arcBalance, 6)} arcUSDC to USDC`)
          const unwrapTx = await arcUsdc.withdraw(arcBalance)
          await unwrapTx.wait()
        }
      }
      
      closeWithdrawModal()
      
      // Refresh pools after withdrawal
      const poolsResponse = await fetch('/api/pools')
      const poolsData = await poolsResponse.json()
      if (poolsData.success) {
        setPools(poolsData.data.map(convertPoolToUIPool))
      }
      
      alert('Successfully withdrew! USDC sent to your wallet.')
    } catch (err: any) {
      console.error('Withdraw error:', err)
      alert(`Withdraw failed: ${err.reason || err.message || 'Unknown error'}`)
    } finally {
      setWithdrawing(false)
    }
  }

  const getCurrentPool = () => pools.find(pool => pool.id === selectedPool)
  const getWithdrawPool = () => pools.find(pool => pool.id === withdrawPool)

  // Loading state
  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Investment Pools</h1>
          <p className="text-foreground/70">Loading pools...</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-gray-800 rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-gray-700 rounded mb-4"></div>
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="h-4 bg-gray-700 rounded mb-4"></div>
              <div className="h-10 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 md:p-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Investment Pools</h1>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <h3 className="font-semibold text-red-400 mb-2">⚠️ Error Loading Pools</h3>
            <p className="text-sm text-foreground/70">{error}</p>
          </div>
        </div>
      </div>
    )
  }

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

      {/* High Risk Pool with Agent Features */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">🤖 AI-Powered High Risk Pool</h2>
          <p className="text-foreground/70">
            Experimental pool with extreme volatility simulation and AI agent automation
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <HighRiskPoolCard />
          <AgentPermissionsManager />
        </div>
      </div>

      {/* Traditional Pools */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Traditional Pools</h2>
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
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(pool.status, pool.isCapReached)}`}>
                  {pool.status === 'Collecting' && pool.isCapReached ? 'Deploying' : pool.status}
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
                  className={`h-3 rounded-full transition-all duration-300 ${
                    pool.isCapReached 
                      ? 'bg-linear-to-r from-green-600 to-green-400' 
                      : 'bg-linear-to-r from-blue-600 to-blue-400'
                  }`}
                  style={{ width: `${pool.progress}%` }}
                />
              </div>
              <p className={`text-xs mt-1 ${pool.isCapReached ? 'text-green-400' : 'text-gray-400'}`}>
                {pool.isCapReached ? '✓ Cap reached - Ready to deploy' : `${pool.progress}% funded`}
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
                <span className="font-semibold text-orange-400">{pool.waitTimeDisplay}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Min Deposit</span>
                <span className="font-semibold">{pool.minDeposit} USDC</span>
              </div>
            </div>

            {/* Show different buttons based on pool state */}
            {pool.status === 'Collecting' && !pool.isCapReached && (
              <Button 
                size="sm" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => openModal(pool.id)}
              >
                Join Pool
              </Button>
            )}
            
            {pool.status === 'Collecting' && pool.isCapReached && (
              <div className="space-y-2">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center animate-pulse">
                  <span className="text-yellow-400 text-sm">
                    ⏳ {pool.adapterType === 'simulated' ? 'Auto-deploying to Strategy...' : 'Auto-deploying to Aave...'}
                  </span>
                </div>
                <p className="text-xs text-center text-gray-400">
                  Pool is full - automatically deploying to earn yield
                </p>
              </div>
            )}
            
            {pool.status === 'Earning Yield' && (
              <div className="space-y-2">
                <div className={`${pool.risk === 'MEDIUM' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-green-500/10 border-green-500/20'} border rounded-lg p-3 text-center`}>
                  <span className={`${pool.risk === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'} text-sm`}>
                    {pool.adapterType === 'simulated' 
                      ? `📊 Simulating ${pool.estimatedYield}% APY` 
                      : `💰 Earning ${pool.estimatedYield}% APY on Aave`
                    }
                  </span>
                </div>
                {pool.withdrawTimeLeft !== undefined && pool.withdrawTimeLeft > 0 && (
                  <p className="text-xs text-center text-gray-400">
                    ⏱️ Withdraw opens in {pool.withdrawTimeLeft}s
                  </p>
                )}
              </div>
            )}
            
            {pool.status === 'Withdraw Open' && (
              <div className="space-y-3">
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
                  <span className="text-purple-400 text-sm">🔓 Withdraw Available</span>
                </div>
                <Button 
                  size="sm" 
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => openWithdrawModal(pool.id)}
                >
                  Withdraw Funds + Interest
                </Button>
              </div>
            )}
            
            {pool.status === 'Inactive' && (
              <Button 
                size="sm" 
                className="w-full bg-gray-600 text-white cursor-not-allowed"
                disabled
              >
                Pool Closed
              </Button>
            )}
          </div>
        ))}
      </div>

      {selectedPool && (
        <div className="fixed inset-0 z-40 overflow-hidden">
          {/* Backdrop with blur effect that covers everything */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md w-full h-full"
            onClick={closeModal}
            style={{ 
              backdropFilter: 'blur(8px)',
              minHeight: '100vh',
              minWidth: '100vw',
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0
            }}
          />
          
          {/* Modal container */}
          <div className="relative z-50 flex items-center justify-center p-4 h-full overflow-y-auto"
               style={{ minHeight: '100vh' }}>
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
                      {bridgeFee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Bridge fee (CCTP)</span>
                          <span className="font-medium">{bridgeFee.toFixed(2)} USDC</span>
                        </div>
                      )}
                      <hr className="border-gray-700" />
                      <div className="flex justify-between font-semibold">
                        <span>Net invested</span>
                        <span className="text-green-400">{netInvested.toFixed(2)} USDC</span>
                      </div>
                      {selectedChain === 'base' && (
                        <p className="text-xs text-green-400">✓ No bridge fees - depositing directly on Base</p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-semibold mb-4">Pool Info</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Execution chain</span>
                      <span className="font-medium">Base Sepolia</span>
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
                      <span className="font-medium">{getCurrentPool()?.waitTimeDisplay}</span>
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
                        <span className="font-medium">Base Sepolia</span>
                      </div>
                      {selectedChain !== 'base' && (
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Flow</span>
                          <span>{getSelectedChain()?.name} USDC → arcUSDC → Pool</span>
                        </div>
                      )}
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
                    onClick={handleConfirmInvestment}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Confirm Investment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Investment Progress Modal */}
      <InvestmentProgressModal
        isOpen={showProgressModal}
        onClose={handleCloseProgressModal}
        step={investState.step}
        message={investState.message}
        txHash={investState.txHash}
        error={investState.error}
        amount={investAmount}
        sourceChain={selectedChain as 'ethereum' | 'base'}
      />

      {/* Withdraw Modal */}
      {withdrawPool && (
        <div className="fixed inset-0 z-40 overflow-hidden">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={closeWithdrawModal}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="relative bg-gray-900 rounded-xl border border-gray-700 p-6 max-w-md w-full">
              <button
                onClick={closeWithdrawModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
              
              <h2 className="text-2xl font-bold mb-4">Withdraw from Pool</h2>
              
              <div className="space-y-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Pool</div>
                  <div className="font-semibold">{getWithdrawPool()?.name}</div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Available to Withdraw</div>
                  <div className="font-semibold text-2xl text-green-400">
                    {getWithdrawPool()?.currentAmount.toFixed(2)} USDC
                  </div>
                </div>
                
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-400 mb-2">Withdrawal Flow</h4>
                  <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                    {getWithdrawPool()?.adapterType === 'simulated' ? (
                      <>
                        <li>Strategy USDC → arcUSDC (in vault)</li>
                        <li>arcUSDC → Your wallet</li>
                        <li>Unwrap arcUSDC → USDC</li>
                      </>
                    ) : (
                      <>
                        <li>Aave aUSDC → arcUSDC (in vault)</li>
                        <li>arcUSDC → Your wallet</li>
                        <li>Unwrap arcUSDC → USDC</li>
                      </>
                    )}
                  </ol>
                  {getWithdrawPool()?.risk === 'MEDIUM' && (
                    <p className="text-xs text-yellow-400 mt-2">
                      ⚠️ Medium risk pool - final amount may vary based on simulated PnL
                    </p>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    variant="outline"
                    onClick={closeWithdrawModal}
                    className="flex-1 border-gray-600 hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleWithdraw}
                    disabled={withdrawing}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {withdrawing ? 'Processing...' : 'Withdraw All'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
