'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowUpRight, ArrowDownLeft, ExternalLink, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import Image from 'next/image'

interface Transaction {
  _id: string
  poolName: string
  type: 'deposit' | 'withdrawal'
  chain: 'ETH' | 'BASE'
  amount: string
  txHash: string
  status: 'pending' | 'confirmed'
  createdAt: string
}

interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalCount: number
  itemsPerPage: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export default function TransactionsPage() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async (page: number, type: string) => {
    if (!user?.walletAddress) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        userAddress: user.walletAddress,
        page: page.toString(),
        type,
      })

      const response = await fetch(`/api/transactions?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions')
      }

      const data = await response.json()
      setTransactions(data.transactions || [])
      setPagination(data.pagination || null)
    } catch (err) {
      console.error('Error fetching transactions:', err)
      setError('Failed to load transactions')
      setTransactions([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.walletAddress])

  useEffect(() => {
    fetchTransactions(currentPage, filterType)
  }, [currentPage, filterType, fetchTransactions])

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const handleFilterChange = (type: 'all' | 'deposit' | 'withdrawal') => {
    setFilterType(type)
    setCurrentPage(1) // Reset to first page when filter changes
  }

  const getEtherscanUrl = (txHash: string) => {
    return `https://sepolia.basescan.org/tx/${txHash}`
  }

  const formatAmount = (amount: string, type: string) => {
    const formattedAmount = parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })
    return type === 'deposit' ? `-$${formattedAmount}` : `+$${formattedAmount}`
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date),
      time: new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date),
    }
  }

  // Calculate index for each transaction based on pagination
  const getTransactionIndex = (index: number) => {
    if (!pagination) return index + 1
    return (pagination.currentPage - 1) * pagination.itemsPerPage + index + 1
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    if (!pagination) return []
    
    const pages: (number | string)[] = []
    const { currentPage, totalPages } = pagination
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
      }
    }
    
    return pages
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Transactions</h1>
        <p className="text-foreground/70">
          View your deposits and withdrawals
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-4">
        <select
          value={filterType}
          onChange={(e) => handleFilterChange(e.target.value as 'all' | 'deposit' | 'withdrawal')}
          className="px-4 py-2 bg-card border border-border rounded-lg text-foreground"
        >
          <option value="all">All Types</option>
          <option value="deposit">Deposits Only</option>
          <option value="withdrawal">Withdrawals Only</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-4 text-left text-sm font-semibold text-foreground/70">
                  #
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  Pool
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  Chain
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  Time
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  View
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-destructive">
                    {error}
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-foreground/50">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((tx, index) => (
                  <tr
                    key={tx._id}
                    className="hover:bg-secondary/10 transition"
                  >
                    <td className="px-4 py-4">
                      <span className="text-sm text-foreground/50">{getTransactionIndex(index)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-sm">{tx.poolName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {tx.type === 'deposit' ? (
                          <ArrowDownLeft size={16} className="text-destructive" />
                        ) : (
                          <ArrowUpRight size={16} className="text-green-500" />
                        )}
                        <span className="text-sm capitalize">{tx.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Image
                          src={tx.chain === 'ETH' ? '/images/eth.svg' : '/images/base.svg'}
                          alt={tx.chain}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                        <span className="text-sm font-medium">
                          {tx.chain === 'ETH' ? 'Ethereum' : 'Base'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`font-bold text-sm ${
                          tx.type === 'deposit'
                            ? 'text-destructive'
                            : 'text-green-500'
                        }`}
                      >
                        {formatAmount(tx.amount, tx.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="font-medium">{formatDateTime(tx.createdAt).date}</p>
                        <p className="text-foreground/50 text-xs">{formatDateTime(tx.createdAt).time}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          tx.status === 'confirmed'
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-yellow-500/10 text-yellow-500'
                        }`}
                      >
                        {tx.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={getEtherscanUrl(tx.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400 hover:underline"
                      >
                        View
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            className="border-border hover:bg-secondary/20 bg-transparent"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!pagination.hasPreviousPage}
          >
            <ChevronLeft size={16} className="mr-1" />
            Previous
          </Button>
          <div className="flex gap-1">
            {getPageNumbers().map((page, index) => (
              typeof page === 'number' ? (
                <button
                  key={index}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-2 rounded-lg text-sm transition ${
                    page === currentPage
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary/20'
                  }`}
                >
                  {page}
                </button>
              ) : (
                <span key={index} className="px-3 py-2 text-sm text-foreground/50">
                  {page}
                </span>
              )
            ))}
          </div>
          <Button
            variant="outline"
            className="border-border hover:bg-secondary/20 bg-transparent"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!pagination.hasNextPage}
          >
            Next
            <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      )}

      {/* Summary */}
      {pagination && (
        <div className="text-center text-sm text-foreground/50">
          Showing {transactions.length} of {pagination.totalCount} transactions
        </div>
      )}
    </div>
  )
}
