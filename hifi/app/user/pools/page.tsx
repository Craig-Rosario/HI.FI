'use client'

import { useState } from 'react'
import { TrendingUp, Users, Lock, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const allPools = [
  {
    id: 1,
    name: 'Tech Growth Fund',
    category: 'Technology',
    description: 'Invest in leading tech companies with high growth potential',
    apy: '28%',
    tvl: '$2.4M',
    members: 342,
    minInvest: '$100',
    risk: 'Medium',
    returns1m: '+8.2%',
    returns3m: '+24.6%',
    active: true,
  },
  {
    id: 2,
    name: 'Blue Chip Portfolio',
    category: 'Stable',
    description: 'Conservative portfolio of large-cap stable investments',
    apy: '18%',
    tvl: '$5.2M',
    members: 1205,
    minInvest: '$50',
    risk: 'Low',
    returns1m: '+4.5%',
    returns3m: '+13.2%',
    active: true,
  },
  {
    id: 3,
    name: 'DeFi Opportunities',
    category: 'DeFi',
    description: 'Exposure to emerging DeFi protocols and yield farming',
    apy: '45%',
    tvl: '$1.8M',
    members: 567,
    minInvest: '$500',
    risk: 'High',
    returns1m: '+12.8%',
    returns3m: '+42.1%',
    active: true,
  },
  {
    id: 4,
    name: 'Emerging Markets',
    category: 'Growth',
    description: 'Growth-focused strategy targeting emerging markets',
    apy: '32%',
    tvl: '$890K',
    members: 234,
    minInvest: '$250',
    risk: 'Medium-High',
    returns1m: '+9.3%',
    returns3m: '+28.7%',
    active: true,
  },
  {
    id: 5,
    name: 'Stable Yield',
    category: 'Yield',
    description: 'Stablecoin yield farming with consistent returns',
    apy: '12%',
    tvl: '$3.1M',
    members: 892,
    minInvest: '$25',
    risk: 'Very Low',
    returns1m: '+3.1%',
    returns3m: '+9.4%',
    active: true,
  },
  {
    id: 6,
    name: 'Global Diversified',
    category: 'Mixed',
    description: 'Balanced portfolio across multiple asset classes',
    apy: '22%',
    tvl: '$1.5M',
    members: 445,
    minInvest: '$100',
    risk: 'Low-Medium',
    returns1m: '+6.7%',
    returns3m: '+19.8%',
    active: true,
  },
]

const categories = ['All Pools', 'Technology', 'Stable', 'DeFi', 'Growth', 'Yield', 'Mixed']

export default function PoolsPage() {
  const [selectedCategory, setSelectedCategory] = useState('All Pools')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('apy')

  const filteredPools = allPools.filter((pool) => {
    const matchesCategory =
      selectedCategory === 'All Pools' || pool.category === selectedCategory
    const matchesSearch = pool.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const sortedPools = [...filteredPools].sort((a, b) => {
    if (sortBy === 'apy') {
      return parseFloat(b.apy) - parseFloat(a.apy)
    } else if (sortBy === 'tvl') {
      return parseFloat(b.tvl) - parseFloat(a.tvl)
    } else if (sortBy === 'members') {
      return b.members - a.members
    }
    return 0
  })

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Very Low':
      case 'Low':
        return 'text-green-500 bg-green-500/10'
      case 'Low-Medium':
      case 'Medium':
        return 'text-yellow-500 bg-yellow-500/10'
      case 'Medium-High':
      case 'High':
        return 'text-rose-500 bg-rose-500/10'
      default:
        return 'text-gray-400 bg-gray-800'
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Investment Pools</h1>
        <p className="text-foreground/70">
          Discover and invest in curated pools managed by our expert team
        </p>
      </div>

      {/* Search and Filters */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Search pools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="md:max-w-xs bg-card border-border"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 bg-card border border-border rounded-lg text-foreground"
          >
            <option value="apy">Sort by APY</option>
            <option value="tvl">Sort by TVL</option>
            <option value="members">Sort by Members</option>
          </select>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedCategory === category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/20 text-foreground hover:bg-secondary/30'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Pools Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {sortedPools.map((pool) => (
          <div
            key={pool.id}
            className="bg-card border border-gray-800 rounded-lg p-6 hover:border-blue-500/50 transition flex flex-col"
          >
            {/* Header */}
            <div className="mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-xl mb-1">{pool.name}</h3>
                  <p className="text-sm text-gray-400">{pool.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">APY</p>
                  <p className="text-2xl font-bold text-red-400">{pool.apy}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300">{pool.description}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-gray-800 my-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">TVL</p>
                <p className="font-semibold text-sm">{pool.tvl}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Members</p>
                <p className="font-semibold text-sm">{pool.members}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Min Invest</p>
                <p className="font-semibold text-sm">{pool.minInvest}</p>
              </div>
            </div>

            {/* Performance */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">1 Month Return</span>
                <span className="font-semibold text-green-500">
                  {pool.returns1m}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">3 Month Return</span>
                <span className="font-semibold text-green-500">
                  {pool.returns3m}
                </span>
              </div>
            </div>

            {/* Risk and Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800 mt-auto">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${getRiskColor(
                  pool.risk
                )}`}
              >
                {pool.risk}
              </span>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Invest
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {sortedPools.length === 0 && (
        <div className="text-center py-12">
          <p className="text-foreground/50 text-lg">
            No pools found matching your criteria
          </p>
        </div>
      )}
    </div>
  )
}
