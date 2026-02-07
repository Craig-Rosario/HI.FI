'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, BarChart3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import Image from 'next/image'

interface Transaction {
  _id: string
  type: 'deposit' | 'withdrawal'
  chain: 'ETH' | 'BASE'
  amount: string
  status: string
}

interface Pool {
  _id: string
  name: string
  riskLevel: 'low' | 'medium' | 'high'
  state: string
  tvl: string
  apy: string
}

interface DashboardData {
  totalDeposits: number
  totalWithdrawals: number
  depositsByChain: { ETH: number; BASE: number }
  withdrawalsByChain: { ETH: number; BASE: number }
  profitLoss: number
  totalPools: number
  activePools: number
  poolsByRisk: { low: number; medium: number; high: number }
  pools: Pool[]
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchDashboardData = useCallback(async () => {
    if (!user?.walletAddress) {
      setIsLoading(false)
      return
    }

    try {
      // Build query params including Circle wallet address
      const txParams = new URLSearchParams({
        userAddress: user.walletAddress,
        page: '1',
        type: 'all',
      })
      if (user.circleWalletAddress) {
        txParams.set('circleWalletAddress', user.circleWalletAddress)
      }

      // Fetch transactions and pools in parallel
      const [txResponse, poolsResponse] = await Promise.all([
        fetch(`/api/transactions?${txParams}`),
        fetch('/api/pools'),
      ])

      // Also fetch all transactions (without pagination limit) for accurate totals
      const allTxResponse = await fetch(`/api/transactions?${txParams}`)
      
      const txData = await allTxResponse.json()
      const poolsData = await poolsResponse.json()

      // Calculate transaction metrics
      let totalDeposits = 0
      let totalWithdrawals = 0
      const depositsByChain = { ETH: 0, BASE: 0 }
      const withdrawalsByChain = { ETH: 0, BASE: 0 }

      const transactions: Transaction[] = txData.transactions || []
      
      // Fetch all pages if there are more
      let currentPage = 1
      let allTransactions = [...transactions]
      
      if (txData.pagination?.totalPages > 1) {
        for (let page = 2; page <= txData.pagination.totalPages; page++) {
          const pageParams = new URLSearchParams(txParams)
          pageParams.set('page', page.toString())
          const pageResponse = await fetch(
            `/api/transactions?${pageParams}`
          )
          const pageData = await pageResponse.json()
          allTransactions = [...allTransactions, ...(pageData.transactions || [])]
        }
      }

      allTransactions.forEach((tx: Transaction) => {
        const amount = parseFloat(tx.amount) || 0
        if (tx.type === 'deposit') {
          totalDeposits += amount
          if (tx.chain === 'ETH') depositsByChain.ETH += amount
          else if (tx.chain === 'BASE') depositsByChain.BASE += amount
        } else if (tx.type === 'withdrawal') {
          totalWithdrawals += amount
          if (tx.chain === 'ETH') withdrawalsByChain.ETH += amount
          else if (tx.chain === 'BASE') withdrawalsByChain.BASE += amount
        }
      })

      // Calculate pool metrics
      const pools: Pool[] = poolsData.success ? poolsData.data : []
      const poolsByRisk = { low: 0, medium: 0, high: 0 }
      let activePools = 0

      pools.forEach((pool: Pool) => {
        if (pool.riskLevel === 'low') poolsByRisk.low++
        else if (pool.riskLevel === 'medium') poolsByRisk.medium++
        else if (pool.riskLevel === 'high') poolsByRisk.high++

        if (pool.state === 'COLLECTING' || pool.state === 'DEPLOYED' || pool.state === 'ACTIVE') {
          activePools++
        }
      })

      setData({
        totalDeposits,
        totalWithdrawals,
        depositsByChain,
        withdrawalsByChain,
        profitLoss: totalWithdrawals - totalDeposits,
        totalPools: pools.length,
        activePools,
        poolsByRisk,
        pools,
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user?.walletAddress])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // Calculate donut chart segments
  const getDonutSegments = () => {
    if (!data) return []
    
    const total = data.poolsByRisk.low + data.poolsByRisk.medium + data.poolsByRisk.high
    if (total === 0) return []

    const circumference = 2 * Math.PI * 40 // r=40
    const segments = []
    let offset = 0

    if (data.poolsByRisk.low > 0) {
      const length = (data.poolsByRisk.low / total) * circumference
      segments.push({ color: '#05FF11', length, offset, label: 'Low Risk', count: data.poolsByRisk.low })
      offset -= length
    }
    if (data.poolsByRisk.medium > 0) {
      const length = (data.poolsByRisk.medium / total) * circumference
      segments.push({ color: '#FFB005', length, offset, label: 'Medium Risk', count: data.poolsByRisk.medium })
      offset -= length
    }
    if (data.poolsByRisk.high > 0) {
      const length = (data.poolsByRisk.high / total) * circumference
      segments.push({ color: '#FF0000', length, offset, label: 'High Risk', count: data.poolsByRisk.high })
      offset -= length
    }

    return segments
  }

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    )
  }

  const segments = getDonutSegments()

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Welcome back!</h1>
        <p className="text-foreground/70">
          Here&apos;s your portfolio overview and investment metrics.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Total Deposits */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-foreground/50">Total Deposits</p>
            <ArrowDownLeft size={20} className="text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold mb-4">
            ${formatCurrency(data?.totalDeposits || 0)}
          </h3>
          <div className="space-y-2 pt-3 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Image src="/images/eth.svg" alt="ETH" width={16} height={16} />
                <span className="text-foreground/70">Ethereum</span>
              </div>
              <span className="font-medium">${formatCurrency(data?.depositsByChain.ETH || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Image src="/images/base.svg" alt="BASE" width={16} height={16} />
                <span className="text-foreground/70">Base</span>
              </div>
              <span className="font-medium">${formatCurrency(data?.depositsByChain.BASE || 0)}</span>
            </div>
          </div>
        </div>

        {/* Total Withdrawals */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-foreground/50">Total Withdrawals</p>
            <ArrowUpRight size={20} className="text-emerald-400" />
          </div>
          <h3 className="text-2xl font-bold mb-4">
            ${formatCurrency(data?.totalWithdrawals || 0)}
          </h3>
          <div className="space-y-2 pt-3 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Image src="/images/eth.svg" alt="ETH" width={16} height={16} />
                <span className="text-foreground/70">Ethereum</span>
              </div>
              <span className="font-medium">${formatCurrency(data?.withdrawalsByChain.ETH || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Image src="/images/base.svg" alt="BASE" width={16} height={16} />
                <span className="text-foreground/70">Base</span>
              </div>
              <span className="font-medium">${formatCurrency(data?.withdrawalsByChain.BASE || 0)}</span>
            </div>
          </div>
        </div>

        {/* Profit/Loss */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-foreground/50">Total Profit/Loss</p>
            {(data?.profitLoss || 0) >= 0 ? (
              <TrendingUp size={20} className="text-green-500" />
            ) : (
              <TrendingDown size={20} className="text-destructive" />
            )}
          </div>
          <h3
            className={`text-2xl font-bold mb-4 ${
              (data?.profitLoss || 0) >= 0 ? 'text-green-500' : 'text-destructive'
            }`}
          >
            {(data?.profitLoss || 0) >= 0 ? '+' : '-'}${formatCurrency(Math.abs(data?.profitLoss || 0))}
          </h3>
          <div className="pt-3 border-t border-border">
            <p className="text-sm text-foreground/50">
              Calculated as: Withdrawals - Deposits
            </p>
            <p className="text-xs text-foreground/40 mt-1">
              {(data?.profitLoss || 0) >= 0
                ? 'You have withdrawn more than deposited'
                : 'Your funds are currently invested in pools'}
            </p>
          </div>
        </div>
      </div>

      {/* Pool Stats Section */}
      <div className="bg-card border border-border rounded-lg p-4 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold">Pool Distribution</h2>
            <p className="text-foreground/50 text-sm mt-1">
              {data?.totalPools || 0} total pools • {data?.activePools || 0} active
            </p>
          </div>
          <Button
            variant="outline"
            className="border-border hover:bg-secondary/20 bg-transparent whitespace-nowrap"
            onClick={() => (window.location.href = '/user/pools')}
          >
            <BarChart3 size={18} className="mr-2" />
            View All Pools
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Donut Chart */}
          <div className="flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-48 h-48">
              {segments.length > 0 ? (
                segments.map((segment, idx) => (
                  <circle
                    key={idx}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="10"
                    strokeDasharray={`${segment.length} ${2 * Math.PI * 40}`}
                    strokeDashoffset={segment.offset}
                    transform="rotate(-90 50 50)"
                  />
                ))
              ) : (
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="10"
                />
              )}
              <text
                x="50"
                y="45"
                textAnchor="middle"
                className="text-lg font-bold fill-foreground"
              >
                {data?.totalPools || 0}
              </text>
              <text
                x="50"
                y="58"
                textAnchor="middle"
                className="text-[8px] fill-foreground/50"
              >
                Total Pools
              </text>
            </svg>
          </div>

          {/* Legend */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#05FF11' }} />
                <span className="text-sm font-medium">Low Risk</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold">{data?.poolsByRisk.low || 0}</span>
                <span className="text-sm text-foreground/50 ml-1">pools</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#FFB005' }} />
                <span className="text-sm font-medium">Medium Risk</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold">{data?.poolsByRisk.medium || 0}</span>
                <span className="text-sm text-foreground/50 ml-1">pools</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#FF0000' }} />
                <span className="text-sm font-medium">High Risk</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold">{data?.poolsByRisk.high || 0}</span>
                <span className="text-sm text-foreground/50 ml-1">pools</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-cyan-500" />
                <span className="text-sm font-medium">Active Pools</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-cyan-500">{data?.activePools || 0}</span>
                <span className="text-sm text-foreground/50 ml-1">of {data?.totalPools || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: '#05FF11' }}>{data?.poolsByRisk.low || 0}</p>
          <p className="text-sm text-foreground/50">Low Risk Pools</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: '#FFB005' }}>{data?.poolsByRisk.medium || 0}</p>
          <p className="text-sm text-foreground/50">Medium Risk Pools</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold" style={{ color: '#FF0000' }}>{data?.poolsByRisk.high || 0}</p>
          <p className="text-sm text-foreground/50">High Risk Pools</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-cyan-500">{data?.activePools || 0}</p>
          <p className="text-sm text-foreground/50">Active Pools</p>
        </div>
      </div>
    </div>
  )
}
