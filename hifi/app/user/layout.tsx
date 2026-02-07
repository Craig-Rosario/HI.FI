'use client'

import React from "react"
import { ProtectedRoute, useAuth } from '@/contexts/AuthContext'
import { HiFiBotProvider } from '@/contexts/HiFiBotContext'
import { HiFiBotSidebar, HiFiBotButton } from '@/components/hifi-bot'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Coins, TrendingUp, LogOut, ChevronLeft, ChevronRight, X, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ArcImg from "@/public/images/arc.png"
const navigation = [
  { name: 'Dashboard', href: '/user/dashboard', icon: LayoutDashboard },
  { name: 'Pools', href: '/user/pools', icon: Coins },
  { name: 'Transactions', href: '/user/transactions', icon: TrendingUp },
]

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()

  const handleDisconnect = () => {
    logout()
    window.location.href = '/'
  }

  return (
    <ProtectedRoute>
    <HiFiBotProvider userId={user?._id || ''} walletAddress={user?.walletAddress || ''}>
    <div className="flex h-screen bg-background text-foreground overflow-hidden dark">
      <div
        className={`fixed md:relative inset-y-0 left-0 z-40 bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex flex-col h-full">
          <div className={`py-4 border-b border-sidebar-border flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-6'}`}>
            {!collapsed && <h1 className="text-2xl font-bold text-sidebar-foreground">HI.FI</h1>}
            {collapsed && <h1 className="text-2xl font-bold text-sidebar-foreground">H</h1>}            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-2 hover:bg-sidebar-accent/10 rounded-lg transition"
            >
              <X size={20} className="text-sidebar-foreground" />
            </button>          </div>

          <nav className={`flex-1 py-8 space-y-2 mt-4 ${collapsed ? 'px-2' : 'px-4'}`}>
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/10'
                  } ${collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}`}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon size={20} />
                  {!collapsed && <span className="font-medium">{item.name}</span>}
                </Link>
              )
            })}
          </nav>

          <div className={`border-t border-sidebar-border space-y-2 ${collapsed ? 'p-2' : 'p-4'}`}>
            {!collapsed ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-sidebar-border bg-sidebar-accent/5">
                  <span className="w-8 h-8 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-xs font-bold text-sidebar-foreground">
                    {user?.username?.slice(0, 2) || '0x'}
                  </span>
                  <span className="text-sm truncate text-sidebar-foreground">{user?.username || '0xabc...def'}</span>
                </div>
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  className="w-full justify-center gap-2 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent/10 bg-transparent"
                >
                  <LogOut size={18} />
                  Disconnect
                </Button>
              </>
            ) : (
              <>
                <button 
                  className="w-full flex justify-center p-2 rounded-lg hover:bg-sidebar-accent/10 transition-colors"
                  title="0xabc...def"
                >
                  <span className="w-8 h-8 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-xs font-bold text-sidebar-foreground">
                    0x
                  </span>
                </button>
                <Button
                  variant="outline"
                  className="w-full justify-center border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent/10 bg-transparent p-3"
                  title="Disconnect"
                >
                  <LogOut size={18} />
                </Button>
              </>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar-primary text-sidebar-primary-foreground items-center justify-center hover:bg-sidebar-primary/80 transition-colors shadow-lg"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-sidebar-border bg-sidebar flex items-center justify-between px-6 md:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 hover:bg-secondary/20 rounded-lg transition"
          >
            <Menu size={24} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-right text-sm">
              <img src={ArcImg.src} alt="Circle" className="w-6 h-6" />
              <p className="font-semibold">Powered by Arc</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* HI.FI BOT Sidebar and Button */}
      <HiFiBotSidebar />
      <HiFiBotButton />
    </div>
    </HiFiBotProvider>
    </ProtectedRoute>
  )
}
