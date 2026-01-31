'use client'

import { useState } from 'react'
import { ArrowUpRight, ArrowDownLeft, Calendar, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const allTransactions = [
  {
    id: 1,
    pool: 'Tech Growth Fund',
    type: 'deposit',
    amount: '$5,000.00',
    date: '2024-01-28',
    time: '14:32',
    status: 'confirmed',
    hash: '0xabc...def',
  },
  {
    id: 2,
    pool: 'Blue Chip Portfolio',
    type: 'deposit',
    amount: '$3,200.00',
    date: '2024-01-26',
    time: '09:15',
    status: 'confirmed',
    hash: '0xdef...ghi',
  },
  {
    id: 3,
    pool: 'Blue Chip Portfolio',
    type: 'withdraw',
    amount: '$1,500.00',
    date: '2024-01-24',
    time: '16:45',
    status: 'confirmed',
    hash: '0xghi...jkl',
  },
  {
    id: 4,
    pool: 'DeFi Opportunities',
    type: 'deposit',
    amount: '$2,000.00',
    date: '2024-01-20',
    time: '11:20',
    status: 'confirmed',
    hash: '0xjkl...mno',
  },
  {
    id: 5,
    pool: 'Tech Growth Fund',
    type: 'withdraw',
    amount: '$500.00',
    date: '2024-01-18',
    time: '13:05',
    status: 'confirmed',
    hash: '0xmno...pqr',
  },
  {
    id: 6,
    pool: 'Emerging Markets',
    type: 'deposit',
    amount: '$1,000.00',
    date: '2024-01-15',
    time: '10:30',
    status: 'confirmed',
    hash: '0xpqr...stu',
  },
  {
    id: 7,
    pool: 'Stable Yield',
    type: 'deposit',
    amount: '$4,000.00',
    date: '2024-01-12',
    time: '15:45',
    status: 'confirmed',
    hash: '0xstu...vwx',
  },
  {
    id: 8,
    pool: 'Tech Growth Fund',
    type: 'deposit',
    amount: '$2,300.00',
    date: '2024-01-08',
    time: '12:15',
    status: 'confirmed',
    hash: '0xvwx...yza',
  },
  {
    id: 9,
    pool: 'Global Diversified',
    type: 'deposit',
    amount: '$1,500.00',
    date: '2024-01-05',
    time: '09:50',
    status: 'confirmed',
    hash: '0xyza...bcd',
  },
  {
    id: 10,
    pool: 'Blue Chip Portfolio',
    type: 'deposit',
    amount: '$8,000.00',
    date: '2024-01-01',
    time: '14:20',
    status: 'confirmed',
    hash: '0xbcd...efg',
  },
]

export default function TransactionsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [dateRange, setDateRange] = useState('all')

  const filteredTransactions = allTransactions.filter((tx) => {
    const matchesSearch = tx.pool
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || tx.type === filterType
    return matchesSearch && matchesType
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }

  const formatAmount = (amount: string, type: string) => {
    return type === 'deposit' ? `+${amount}` : `-${amount}`
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Transactions</h1>
        <p className="text-foreground/70">
          View all your deposits, withdrawals, and earnings
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-sm text-foreground/50 mb-2">Total Deposits</p>
          <p className="text-3xl font-bold">$40,000</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-sm text-foreground/50 mb-2">Total Withdrawals</p>
          <p className="text-3xl font-bold">$2,000</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-sm text-foreground/50 mb-2">Net Position</p>
          <p className="text-3xl font-bold text-green-500">$38,000</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Search by pool name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="md:max-w-xs bg-card border-border"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-card border border-border rounded-lg text-foreground"
          >
            <option value="all">All Types</option>
            <option value="deposit">Deposits Only</option>
            <option value="withdraw">Withdrawals Only</option>
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 bg-card border border-border rounded-lg text-foreground"
          >
            <option value="all">All Time</option>
            <option value="30d">Last 30 Days</option>
            <option value="7d">Last 7 Days</option>
            <option value="24h">Last 24 Hours</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  Pool
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground/70">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-secondary/10 transition"
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-sm">{tx.pool}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {tx.type === 'deposit' ? (
                        <ArrowDownLeft size={16} className="text-green-500" />
                      ) : (
                        <ArrowUpRight size={16} className="text-destructive" />
                      )}
                      <span className="text-sm capitalize">{tx.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`font-bold text-sm ${
                        tx.type === 'deposit'
                          ? 'text-green-500'
                          : 'text-destructive'
                      }`}
                    >
                      {formatAmount(tx.amount, tx.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="font-medium">{formatDate(tx.date)}</p>
                      <p className="text-foreground/50 text-xs">{tx.time}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-500">
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={`#`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {filteredTransactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-foreground/50 text-lg">
            No transactions found
          </p>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" className="border-border hover:bg-secondary/20 bg-transparent">
          Previous
        </Button>
        <div className="flex gap-1">
          {[1, 2, 3].map((page) => (
            <button
              key={page}
              className={`px-3 py-2 rounded-lg text-sm transition ${
                page === 1
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary/20'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
        <Button variant="outline" className="border-border hover:bg-secondary/20 bg-transparent">
          Next
        </Button>
      </div>
    </div>
  )
}
