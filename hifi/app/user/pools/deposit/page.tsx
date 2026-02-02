'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter, useSearchParams } from 'next/navigation'
import { ethers } from 'ethers'

const SUPPORTED_CHAINS = [
  { name: 'Ethereum', domain: 0, chainId: 1 },
  { name: 'Sepolia', domain: 0, chainId: 11155111 },
  { name: 'Base', domain: 6, chainId: 8453 },
  { name: 'Base Sepolia', domain: 6, chainId: 84532 },
]

const POOL_VAULT_ABI = [
  'function threshold() view returns (uint256)',
  'function state() view returns (uint8)',
  'function usdc() view returns (address)',
]

const USDC_ABI = [
  'function balanceOf(address) view returns (uint256)',
]

type DepositStatus = 'idle' | 'approving' | 'signing' | 'bridging' | 'waiting' | 'completed' | 'error'

export default function DepositPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const poolAddress = searchParams?.get('pool') || '0xddC39afa01D12911340975eFe6379FF92E22445f'
  
  const [amount, setAmount] = useState('')
  const [selectedChain, setSelectedChain] = useState(SUPPORTED_CHAINS[1])
  const [status, setStatus] = useState<DepositStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [relayerAddress, setRelayerAddress] = useState('')
  const [txHash, setTxHash] = useState('')
  const [userAddress, setUserAddress] = useState('')
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)
  const [poolInfo, setPoolInfo] = useState<{
    address: string;
    threshold: number;
    totalCollected: number;
    state: string;
  } | null>(null)
  const [loadingPool, setLoadingPool] = useState(true)

  useEffect(() => {
    const fetchPoolInfo = async () => {
      try {
        const arcProvider = new ethers.JsonRpcProvider('https://rpc.testnet.arc.network')
        const poolContract = new ethers.Contract(poolAddress, POOL_VAULT_ABI, arcProvider)
        
        const [threshold, state, usdcAddr] = await Promise.all([
          poolContract.threshold(),
          poolContract.state(),
          poolContract.usdc(),
        ])
        
        // Get actual USDC balance
        const usdc = new ethers.Contract(usdcAddr, USDC_ABI, arcProvider)
        const balance = await usdc.balanceOf(poolAddress)

        setPoolInfo({
          address: poolAddress,
          threshold: parseFloat(ethers.formatUnits(threshold, 6)),
          totalCollected: parseFloat(ethers.formatUnits(balance, 6)),
          state: Number(state) === 0 ? 'Collecting' : Number(state) === 1 ? 'Deployed' : 'Withdrawing',
        })
        setLoadingPool(false)
      } catch (error) {
        console.error('Error fetching pool info:', error)
        setLoadingPool(false)
      }
    }

    fetchPoolInfo()

    fetch('/api/relayer/address')
      .then(res => res.json())
      .then(data => setRelayerAddress(data.relayerAddress))
      .catch(err => console.error('Failed to fetch relayer address:', err))

    if (typeof window !== 'undefined' && window.ethereum) {
      const initProvider = async () => {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum as never)
          const signer = await provider.getSigner()
          const address = await signer.getAddress()
          
          setSigner(signer)
          setUserAddress(address)
        } catch (error) {
          console.error('Failed to initialize provider:', error)
        }
      }
      initProvider()
    }
  }, [poolAddress])
  const switchNetwork = async (chainId: number) => {
    if (!window.ethereum) {
      throw new Error('No wallet detected')
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })
    } catch (error: unknown) {
      // This error code indicates that the chain has not been added to MetaMask
      if (error && typeof error === 'object' && 'code' in error && error.code === 4902) {
        const chainConfig = getChainConfig(chainId)
        if (chainConfig) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [chainConfig],
          })
        }
      } else {
        throw error
      }
    }
  }

  const getChainConfig = (chainId: number) => {
    const configs: Record<number, { chainId: string; chainName: string; nativeCurrency: { name: string; symbol: string; decimals: number }; rpcUrls: string[]; blockExplorerUrls?: string[] }> = {
      1: {
        chainId: '0x1',
        chainName: 'Ethereum Mainnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://eth.llamarpc.com'],
        blockExplorerUrls: ['https://etherscan.io'],
      },
      11155111: {
        chainId: '0xaa36a7',
        chainName: 'Sepolia Testnet',
        nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://rpc.sepolia.org'],
        blockExplorerUrls: ['https://sepolia.etherscan.io'],
      },
      8453: {
        chainId: '0x2105',
        chainName: 'Base',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://mainnet.base.org'],
        blockExplorerUrls: ['https://basescan.org'],
      },
      84532: {
        chainId: '0x14a34',
        chainName: 'Base Sepolia',
        nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://sepolia.base.org'],
        blockExplorerUrls: ['https://sepolia-explorer.base.org'],
      },
    }
    return configs[chainId]
  }
  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setStatus('error')
      setStatusMessage('Please enter a valid amount')
      return
    }

    if (!signer || !userAddress) {
      setStatus('error')
      setStatusMessage('Please connect your wallet')
      return
    }

    if (!relayerAddress) {
      setStatus('error')
      setStatusMessage('Relayer address not loaded. Please refresh the page.')
      return
    }

    try {
      // Check if wallet is on the correct network
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum as never)
        const network = await provider.getNetwork()
        
        if (Number(network.chainId) !== selectedChain.chainId) {
          setStatus('approving')
          setStatusMessage(`Please switch to ${selectedChain.name} in your wallet...`)
          await switchNetwork(selectedChain.chainId)
          // Reinitialize signer after network switch
          const newSigner = await provider.getSigner()
          setSigner(newSigner)
        }
      }

      const amountInUSDC = ethers.parseUnits(amount, 6)
      const usdcAddress = await getUSDCAddress(selectedChain.chainId)
      
      if (!usdcAddress) {
        throw new Error('USDC not supported on this chain')
      }

      setStatus('approving')
      setStatusMessage('Approving USDC...')
      
      const usdc = new ethers.Contract(
        usdcAddress,
        ['function approve(address spender, uint256 amount) returns (bool)', 'function transfer(address to, uint256 amount) returns (bool)'],
        signer
      )

      const approveTx = await usdc.approve(relayerAddress, amountInUSDC)
      await approveTx.wait()

      setStatus('signing')
      setStatusMessage('Transferring USDC...')

      const transferTx = await usdc.transfer(relayerAddress, amountInUSDC)
      const receipt = await transferTx.wait()
      setTxHash(receipt.hash)

      setStatus('bridging')
      setStatusMessage('Registering deposit with relayer...')

      // Call relayer API to process deposit
      const relayerResponse = await fetch('http://localhost:3001/api/deposit/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          amount: amountInUSDC.toString(),
          poolAddress: poolAddress,
          txHash: receipt.hash,
        })
      })

      if (!relayerResponse.ok) {
        const errorData = await relayerResponse.json()
        throw new Error(errorData.error || 'Failed to process deposit')
      }

      const { depositId } = await relayerResponse.json()

      setStatus('waiting')
      setStatusMessage('Relayer is bridging USDC to Arc and depositing to pool...')

      // Poll for deposit status
      let attempts = 0
      const maxAttempts = 60 // 2 minutes max
      const pollInterval = setInterval(async () => {
        attempts++
        
        try {
          const statusResponse = await fetch(`http://localhost:3001/api/deposit/status/${depositId}`)
          if (statusResponse.ok) {
            const depositStatus = await statusResponse.json()
            
            if (depositStatus.status === 'completed') {
              clearInterval(pollInterval)
              setStatus('completed')
              setStatusMessage('Deposit completed! Your shares are now available on Arc.')
            } else if (depositStatus.status === 'failed') {
              clearInterval(pollInterval)
              setStatus('error')
              setStatusMessage(`Deposit failed: ${depositStatus.error || 'Unknown error'}`)
            } else {
              // Update status message based on current stage
              const stageMessages: Record<string, string> = {
                'verifying': 'Verifying transaction on Sepolia...',
                'bridging': 'Bridging USDC from Sepolia to Arc via Circle CCTP...',
                'depositing': 'Depositing USDC to pool on Arc...',
              }
              setStatusMessage(stageMessages[depositStatus.status] || 'Processing deposit...')
            }
          }
        } catch (error) {
          console.error('Error polling deposit status:', error)
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval)
          setStatus('error')
          setStatusMessage('Deposit timeout. Please check status later.')
        }
      }, 2000)

    } catch (error) {
      console.error('Deposit error:', error)
      setStatus('error')
      const errorMessage = error instanceof Error ? error.message : 'Deposit failed'
      setStatusMessage(errorMessage)
    }
  }

  const getUSDCAddress = async (chainId: number): Promise<string | null> => {
    const usdcAddresses: Record<number, string> = {
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    }
    return usdcAddresses[chainId] || null
  }

  const resetForm = () => {
    setAmount('')
    setStatus('idle')
    setStatusMessage('')
    setTxHash('')
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/user/pools')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pools
          </Button>
        </div>

        <div className="border border-gray-800 rounded-lg p-8 bg-gradient-to-b from-gray-900 to-black">
          {loadingPool ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold mb-2">Deposit to Pool</h1>
              <p className="text-gray-400 mb-2">
                Deposit USDC from any supported chain. No Arc wallet needed!
              </p>
              
              {poolInfo && (
                <div className="mb-6 p-4 rounded-lg bg-blue-950/30 border border-blue-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-400">Pool Status:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      poolInfo.state === 'Collecting' ? 'bg-blue-500/20 text-blue-400' :
                      poolInfo.state === 'Deployed' ? 'bg-green-500/20 text-green-400' :
                      'bg-orange-500/20 text-orange-400'
                    }`}>
                      {poolInfo.state}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Funding Progress:</span>
                    <span className="font-semibold">
                      {poolInfo.totalCollected.toFixed(2)} / {poolInfo.threshold.toFixed(2)} USDC
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((poolInfo.totalCollected / poolInfo.threshold) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {status !== 'idle' && (
                <div className={`mb-6 p-4 rounded-lg border ${
                  status === 'completed' ? 'bg-green-950/30 border-green-800' :
                  status === 'error' ? 'bg-red-950/30 border-red-800' :
                  'bg-blue-950/30 border-blue-800'
                }`}>
                  <div className="flex items-center gap-3">
                    {status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                    {status === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                    {!['completed', 'error'].includes(status) && (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    )}
                    <div>
                      <p className="font-medium">{statusMessage}</p>
                      {txHash && (
                        <p className="text-sm text-gray-400 mt-1">
                          Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {userAddress && (
                <div className="mb-6 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                  <p className="text-sm text-gray-400">Connected Wallet</p>
                  <p className="font-mono text-sm">{userAddress}</p>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Source Chain</label>
                <select
                  value={selectedChain.chainId}
                  onChange={(e) => {
                    const chain = SUPPORTED_CHAINS.find(c => c.chainId === parseInt(e.target.value))
                    if (chain) {
                      setSelectedChain(chain)
                    }
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                  disabled={status !== 'idle'}
                >
                  {SUPPORTED_CHAINS.map(chain => (
                    <option key={chain.chainId} value={chain.chainId}>
                      {chain.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2" key={selectedChain.chainId}>
                  You only pay gas on <strong>{selectedChain.name}</strong>
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Amount (USDC)</label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-gray-800 border-gray-700 text-2xl h-16"
                  disabled={status !== 'idle'}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Minimum: 1 USDC
                </p>
              </div>

              {relayerAddress && (
                <div className="mb-6 p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                  <p className="text-sm text-gray-400 mb-1">Funds will be sent to relayer:</p>
                  <p className="font-mono text-xs break-all">{relayerAddress}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    The relayer will automatically deposit to the pool on your behalf
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                {status === 'completed' ? (
                  <>
                    <Button
                      onClick={resetForm}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      Make Another Deposit
                    </Button>
                    <Button
                      onClick={() => router.push('/user/dashboard')}
                      variant="outline"
                      className="flex-1"
                    >
                      View Dashboard
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleDeposit}
                      disabled={status !== 'idle' || !amount || !userAddress}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      {status !== 'idle' && status !== 'error' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Deposit USDC'
                      )}
                    </Button>
                    {status === 'error' && (
                      <Button
                        onClick={resetForm}
                        variant="outline"
                        className="px-6"
                      >
                        Try Again
                      </Button>
                    )}
                  </>
                )}
              </div>

              <div className="mt-8 pt-8 border-t border-gray-800">
                <h3 className="font-semibold mb-4">How it works</h3>
                <ol className="space-y-3 text-sm text-gray-400" key={selectedChain.chainId}>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs">1</span>
                    <span>You approve and transfer USDC from <strong className="text-blue-400">{selectedChain.name}</strong></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs">2</span>
                    <span>USDC is bridged to Arc via Circle Gateway (automatic)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs">3</span>
                    <span>Our relayer receives the funds and deposits on your behalf</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs">4</span>
                    <span>Pool shares are minted directly to your wallet</span>
                  </li>
                </ol>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
