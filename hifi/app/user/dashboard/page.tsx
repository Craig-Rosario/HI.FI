'use client'

import { TrendingUp, ArrowUpRight, ArrowDownLeft, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const metrics = [
  {
    label: 'Portfolio Value',
    value: '$45,230.50',
    change: '+12.5%',
    trend: 'up',
  },
  {
    label: 'Total Invested',
    value: '$40,000.00',
    change: '+$5,230',
    trend: 'up',
  },
  {
    label: 'Unrealized Gains',
    value: '$5,230.50',
    change: '+13.1%',
    trend: 'up',
  },
  {
    label: 'Monthly Returns',
    value: '$1,428.50',
    change: '+8.2%',
    trend: 'up',
  },
]

const activePools = [
  {
    id: 1,
    name: 'Tech Growth Fund',
    strategy: 'Technology sector focus',
    invested: '$10,000.00',
    value: '$11,250.00',
    return: '+12.5%',
    apy: '28%',
    members: 342,
  },
  {
    id: 2,
    name: 'Blue Chip Portfolio',
    strategy: 'Large-cap stable',
    invested: '$15,000.00',
    value: '$16,875.00',
    return: '+12.5%',
    apy: '18%',
    members: 1205,
  },
  {
    id: 3,
    name: 'DeFi Opportunities',
    strategy: 'DeFi protocol exposure',
    invested: '$8,500.00',
    value: '$9,587.50',
    return: '+12.8%',
    apy: '45%',
    members: 567,
  },
  {
    id: 4,
    name: 'Emerging Markets',
    strategy: 'Growth-focused strategy',
    invested: '$6,500.00',
    value: '$7,517.50',
    return: '+15.7%',
    apy: '32%',
    members: 234,
  },
]

export default function DashboardPage() {
  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-4xl font-bold mb-2">Welcome back!</h1>
        <p className="text-foreground/70">
          Here's your portfolio overview and active investments.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid md:grid-cols-4 gap-6">
        {metrics.map((metric, idx) => (
          <div
            key={idx}
            className="bg-card border border-border rounded-lg p-6"
          >
            <p className="text-sm text-foreground/50 mb-2">{metric.label}</p>
            <h3 className="text-2xl font-bold mb-3">{metric.value}</h3>
            <div className="flex items-center gap-2">
              {metric.trend === 'up' ? (
                <ArrowUpRight size={18} className="text-green-500" />
              ) : (
                <ArrowDownLeft size={18} className="text-destructive" />
              )}
              <span className={metric.trend === 'up' ? 'text-green-500' : 'text-destructive'}>
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Portfolio Chart Section */}
      <div className="bg-card border border-border rounded-lg p-4 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold">Portfolio Allocation</h2>
            <p className="text-foreground/50 text-sm mt-1">
              Distribution of your investments across pools
            </p>
          </div>
          <Button variant="outline" className="border-border hover:bg-secondary/20 bg-transparent whitespace-nowrap">
            <BarChart3 size={18} className="mr-2" />
            View Details
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-40 h-40">
              <circle cx="50" cy="50" r="40" fill="none" stroke="url(#gradient1)" strokeWidth="8" strokeDasharray="62.8 314" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="url(#gradient2)" strokeWidth="8" strokeDasharray="47.1 314" strokeDashoffset="-62.8" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="url(#gradient3)" strokeWidth="8" strokeDasharray="31.4 314" strokeDashoffset="-109.9" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="url(#gradient4)" strokeWidth="8" strokeDasharray="172.7 314" strokeDashoffset="-141.3" />
              <defs>
                <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: 'rgb(100, 116, 255)' }} />
                  <stop offset="100%" style={{ stopColor: 'rgb(100, 116, 255)' }} />
                </linearGradient>
                <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: 'rgb(232, 68, 68)' }} />
                  <stop offset="100%" style={{ stopColor: 'rgb(232, 68, 68)' }} />
                </linearGradient>
                <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: 'rgb(34, 197, 94)' }} />
                  <stop offset="100%" style={{ stopColor: 'rgb(34, 197, 94)' }} />
                </linearGradient>
                <linearGradient id="gradient4" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: 'rgb(168, 85, 247)' }} />
                  <stop offset="100%" style={{ stopColor: 'rgb(168, 85, 247)' }} />
                </linearGradient>
              </defs>
              <text x="50" y="50" textAnchor="middle" dy="0.3em" className="text-xs font-bold fill-foreground">
                4 Pools
              </text>
            </svg>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(100, 116, 255)' }} />
                <span className="text-sm">Tech Growth Fund</span>
              </div>
              <span className="text-sm font-semibold">22%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(232, 68, 68)' }} />
                <span className="text-sm">Blue Chip Portfolio</span>
              </div>
              <span className="text-sm font-semibold">37%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(34, 197, 94)' }} />
                <span className="text-sm">DeFi Opportunities</span>
              </div>
              <span className="text-sm font-semibold">21%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgb(168, 85, 247)' }} />
                <span className="text-sm">Emerging Markets</span>
              </div>
              <span className="text-sm font-semibold">20%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Pools */}
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Your Active Pools</h2>
          <p className="text-foreground/50">
            Manage and track your investments across pools
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {activePools.map((pool) => (
            <div
              key={pool.id}
              className="bg-card border border-border rounded-lg p-6 hover:border-blue-500/50 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">{pool.name}</h3>
                  <p className="text-sm text-gray-400">{pool.strategy}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">APY</p>
                  <p className="text-xl font-bold text-red-400">{pool.apy}</p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Your Investment</span>
                  <span className="font-semibold">{pool.invested}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Current Value</span>
                  <span className="font-semibold text-green-500">{pool.value}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-linear-to-r from-gray-600 via-gray-500 to-white h-2 rounded-full"
                    style={{ width: '75%' }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Performance</span>
                  <span className="text-green-500">{pool.return}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                <span className="text-xs text-gray-400">
                  {pool.members.toLocaleString()} members
                </span>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Manage
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
