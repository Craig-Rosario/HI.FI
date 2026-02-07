'use client';

import React, { useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  MessageSquare, 
  FileText, 
  Loader2, 
  Check, 
  XCircle, 
  Edit3, 
  Play,
  ChevronRight,
  Trash2,
  RefreshCw,
  Wallet,
  Copy,
  ExternalLink
} from 'lucide-react';
import { useHiFiBot, Plan } from '@/contexts/HiFiBotContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';

// Circle Wallet Info types
interface CircleWalletInfo {
  id: string;
  address: string;
  balances: Array<{ token: string; amount: string }>;
  ethBalance?: string;
  isNew?: boolean;
}

interface FundingInstructions {
  network: string;
  address: string;
  token: string;
  tokenAddress: string;
  note: string;
  gasNote?: string;
}

// Status badge colors
const statusColors: Record<string, string> = {
  DRAFT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  APPROVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  EXECUTING: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ACTIVE: 'bg-green-500/20 text-green-400 border-green-500/30',
  COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Chat Tab Component
const ChatTab: React.FC = () => {
  const { 
    messages, 
    isLoading, 
    sendMessage, 
    currentPlan,
    approvePlan,
    cancelPlan,
    executePlan,
    clearChat
  } = useHiFiBot();
  
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const message = input;
    setInput('');
    await sendMessage(message);
  };

  const handleQuickAction = async (action: string) => {
    await sendMessage(action);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 border border-border'
              }`}
            >
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }: { children?: ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }: { children?: ReactNode }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                    ol: ({ children }: { children?: ReactNode }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                    li: ({ children }: { children?: ReactNode }) => <li className="mb-1">{children}</li>,
                    strong: ({ children }: { children?: ReactNode }) => <strong className="font-bold text-white">{children}</strong>,
                    h2: ({ children }: { children?: ReactNode }) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
                    h3: ({ children }: { children?: ReactNode }) => <h3 className="text-md font-semibold mb-1 mt-2">{children}</h3>,
                    hr: () => <hr className="my-3 border-border" />,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
              <div className="text-[10px] opacity-50 mt-1">
                {new Date(message.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted/50 border border-border rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Plan Action Buttons */}
      {currentPlan && currentPlan.status === 'DRAFT' && (
        <div className="px-4 py-3 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground mb-2">Plan Actions:</div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => approvePlan(currentPlan._id)}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleQuickAction('Modify my plan')}
              disabled={isLoading}
              className="flex-1"
            >
              <Edit3 className="h-4 w-4 mr-1" />
              Modify
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => cancelPlan(currentPlan._id)}
              disabled={isLoading}
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Execute Button for Approved Plans */}
      {currentPlan && currentPlan.status === 'APPROVED' && (
        <div className="px-4 py-3 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground mb-2">Ready to Execute:</div>
          <Button
            onClick={() => executePlan(currentPlan._id)}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Execute Plan
          </Button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-border">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => handleQuickAction('Create a new plan')}
            className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            + New Plan
          </button>
          <button
            onClick={clearChat}
            className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            Clear Chat
          </button>
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="rounded-xl h-10 w-10"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

// Circle Wallet Card Component
const CircleWalletCard: React.FC<{ userId?: string }> = ({ userId }) => {
  const { user } = useAuth();
  const [walletInfo, setWalletInfo] = useState<CircleWalletInfo | null>(null);
  const [fundingInfo, setFundingInfo] = useState<FundingInstructions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [showFundInput, setShowFundInput] = useState(false);
  const [selectedChain, setSelectedChain] = useState<'base-sepolia' | 'eth-sepolia'>('base-sepolia');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Chain configurations
  const chainConfigs = {
    'base-sepolia': {
      name: 'Base Sepolia',
      chainId: '0x14a34', // 84532
      usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      rpcUrl: 'https://sepolia.base.org',
      explorer: 'https://sepolia.basescan.org',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    },
    'eth-sepolia': {
      name: 'Ethereum Sepolia',
      chainId: '0xaa36a7', // 11155111
      usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Circle USDC on Sepolia
      rpcUrl: 'https://rpc.sepolia.org',
      explorer: 'https://sepolia.etherscan.io',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    },
  };

  const fetchWalletInfo = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/circle-wallet/info?userId=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setWalletInfo(data.wallet);
        setFundingInfo(data.fundingInstructions);
      } else {
        setError(data.error || 'Failed to load wallet');
      }
    } catch (err) {
      setError('Failed to connect to Circle wallet service');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchWalletInfo();
  }, [fetchWalletInfo]);

  const copyAddress = async () => {
    if (walletInfo?.address) {
      await navigator.clipboard.writeText(walletInfo.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  // Fund Circle wallet from MetaMask
  const fundFromMetaMask = async () => {
    if (!walletInfo?.address || !fundAmount || parseFloat(fundAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsFunding(true);
    setError(null);

    const chainConfig = chainConfigs[selectedChain];

    try {
      // Check if MetaMask is available
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask not found. Please install MetaMask.');
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No MetaMask accounts found');
      }

      // Check and switch network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== chainConfig.chainId) {
        // Try to switch to selected chain
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainConfig.chainId }],
          });
        } catch (switchError: unknown) {
          // If network doesn't exist, add it
          if ((switchError as { code?: number })?.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: chainConfig.chainId,
                chainName: chainConfig.name,
                nativeCurrency: chainConfig.nativeCurrency,
                rpcUrls: [chainConfig.rpcUrl],
                blockExplorerUrls: [chainConfig.explorer],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }

      // Convert amount to USDC decimals (6 decimals)
      const amountInWei = BigInt(Math.floor(parseFloat(fundAmount) * 1e6)).toString(16);
      
      // ERC20 transfer function signature: transfer(address,uint256)
      const transferData = 
        '0xa9059cbb' + // transfer function selector
        walletInfo.address.slice(2).padStart(64, '0') + // to address (padded)
        amountInWei.padStart(64, '0'); // amount (padded)

      // Send transaction
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: chainConfig.usdcAddress,
          data: transferData,
        }],
      });

      console.log('Fund transaction sent:', txHash);
      
      // Wait a bit and refresh balance
      setShowFundInput(false);
      setFundAmount('');
      
      // Poll for balance update
      setTimeout(() => fetchWalletInfo(), 3000);
      setTimeout(() => fetchWalletInfo(), 8000);
      setTimeout(() => fetchWalletInfo(), 15000);

    } catch (err) {
      console.error('Fund error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fund wallet');
    } finally {
      setIsFunding(false);
    }
  };

  // Send ETH for gas fees
  const sendETHForGas = async () => {
    if (!walletInfo?.address) {
      setError('No wallet address');
      return;
    }

    setIsFunding(true);
    setError(null);

    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask not found');
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error('No MetaMask accounts found');
      }

      // Switch to Base Sepolia
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0x14a34') {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x14a34' }],
        });
      }

      // Send 0.001 ETH for gas
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: walletInfo.address,
          value: '0x38D7EA4C68000', // 0.001 ETH in hex (1000000000000000 wei)
        }],
      });

      console.log('ETH transfer sent:', txHash);
      
      setTimeout(() => fetchWalletInfo(), 3000);
      setTimeout(() => fetchWalletInfo(), 8000);

    } catch (err) {
      console.error('ETH transfer error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send ETH');
    } finally {
      setIsFunding(false);
    }
  };

  // Transfer Circle wallet USDC to MetaMask
  const transferToMetaMask = async () => {
    if (!userId || !user?.walletAddress) {
      setError('MetaMask wallet address not found. Please connect MetaMask first.');
      return;
    }

    setIsTransferring(true);
    setError(null);
    setTransferStatus('Starting transfer...');

    try {
      const response = await fetch('/api/circle-wallet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          destinationAddress: user.walletAddress,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTransferStatus(`✅ ${data.message}`);
        // Refresh balance after transfer
        setTimeout(() => fetchWalletInfo(), 3000);
        setTimeout(() => fetchWalletInfo(), 8000);
        // Clear status after a few seconds
        setTimeout(() => setTransferStatus(null), 10000);
      } else {
        setError(data.error || 'Transfer failed');
        setTransferStatus(null);
      }
    } catch (err) {
      console.error('Transfer error:', err);
      setError(err instanceof Error ? err.message : 'Transfer failed');
      setTransferStatus(null);
    } finally {
      setIsTransferring(false);
    }
  };

  // Find USDC balance with flexible matching
  const usdcBalanceObj = walletInfo?.balances?.find(b => 
    b.token === 'USDC' || 
    b.token === 'USD Coin' || 
    b.token?.toUpperCase().includes('USDC')
  );
  const usdcBalance = usdcBalanceObj?.amount || '0';
  
  // Log balances for debugging
  useEffect(() => {
    if (walletInfo?.balances) {
      console.log('Circle wallet balances:', walletInfo.balances);
    }
  }, [walletInfo?.balances]);

  if (!userId) return null;

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-purple-400" />
          <span className="font-semibold text-sm">AI Wallet (Circle)</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchWalletInfo}
          disabled={isLoading}
          className="h-7 w-7 p-0"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading && !walletInfo ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-xs text-red-400 py-2">{error}</div>
      ) : walletInfo ? (
        <div className="space-y-3">
          {/* Balance */}
          <div className="bg-black/20 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Balance</div>
            <div className="flex items-end justify-between">
              <div className="text-xl font-bold text-white">{parseFloat(usdcBalance).toFixed(2)} USDC</div>
              <div className="text-xs text-muted-foreground">
                {walletInfo.ethBalance ? parseFloat(walletInfo.ethBalance).toFixed(4) : '0'} ETH
              </div>
            </div>
            {/* Show warning if no ETH for gas */}
            {(!walletInfo.ethBalance || parseFloat(walletInfo.ethBalance) < 0.0001) && (
              <button
                onClick={sendETHForGas}
                disabled={isFunding}
                className="text-[10px] text-orange-400 mt-1 hover:text-orange-300 underline cursor-pointer disabled:cursor-not-allowed"
              >
                ⚠️ Send 0.001 ETH for gas fees
              </button>
            )}
          </div>

          {/* Address */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Address:</span>
            <div className="flex items-center gap-1">
              <code className="bg-black/30 px-2 py-0.5 rounded text-purple-300">
                {shortenAddress(walletInfo.address)}
              </code>
              <button
                onClick={copyAddress}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
              <a
                href={`https://sepolia.basescan.org/address/${walletInfo.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="View on Explorer"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Funding Instructions */}
          {walletInfo.isNew || parseFloat(usdcBalance) === 0 ? (
            <div className="space-y-2">
              {!showFundInput ? (
                <>
                  <div className="text-xs text-yellow-400/80 bg-yellow-500/10 rounded-lg p-2 border border-yellow-500/20">
                    <span className="font-medium">💡 Fund your AI wallet:</span> Transfer USDC from MetaMask to enable AI-managed execution.
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowFundInput(true)}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    <Wallet className="h-3 w-3 mr-2" />
                    Fund from MetaMask
                  </Button>
                </>
              ) : (
                <div className="bg-black/20 rounded-lg p-3 space-y-3">
                  {/* Chain Selection */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Select Source Chain:</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedChain('base-sepolia')}
                        className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${
                          selectedChain === 'base-sepolia'
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-black/30 border-purple-500/30 hover:border-purple-500/50'
                        }`}
                      >
                        🔵 Base Sepolia
                      </button>
                      <button
                        onClick={() => setSelectedChain('eth-sepolia')}
                        className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${
                          selectedChain === 'eth-sepolia'
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-black/30 border-purple-500/30 hover:border-purple-500/50'
                        }`}
                      >
                        ⟠ ETH Sepolia
                      </button>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Amount (USDC):</div>
                    <input
                      type="number"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      placeholder="e.g., 20"
                      className="w-full bg-black/30 border border-purple-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>

                  {/* Info about selected chain */}
                  <div className="text-[10px] text-muted-foreground">
                    USDC: {chainConfigs[selectedChain].usdcAddress.slice(0, 10)}...
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={fundFromMetaMask}
                      disabled={isFunding || !fundAmount}
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                    >
                      {isFunding ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Send className="h-3 w-3 mr-1" />
                      )}
                      Send from {selectedChain === 'base-sepolia' ? 'Base' : 'ETH'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setShowFundInput(false); setFundAmount(''); }}
                      disabled={isFunding}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-green-400/80 bg-green-500/10 rounded-lg p-2 border border-green-500/20">
                ✅ Wallet ready for AI-managed execution!
              </div>

              {/* Transfer Status */}
              {transferStatus && (
                <div className="text-xs text-blue-400/80 bg-blue-500/10 rounded-lg p-2 border border-blue-500/20">
                  {transferStatus}
                </div>
              )}

              {/* Send to MetaMask Button */}
              <Button
                size="sm"
                onClick={transferToMetaMask}
                disabled={isTransferring || parseFloat(usdcBalance) === 0}
                className="w-full bg-orange-600 hover:bg-orange-700 text-xs"
              >
                {isTransferring ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-3 w-3 mr-2" />
                )}
                {isTransferring ? 'Transferring...' : 'Send to MetaMask'}
              </Button>

              {!showFundInput ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFundInput(true)}
                  className="w-full text-xs"
                >
                  <Wallet className="h-3 w-3 mr-2" />
                  Add More Funds
                </Button>
              ) : (
                <div className="bg-black/20 rounded-lg p-3 space-y-3">
                  {/* Chain Selection */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Select Source Chain:</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedChain('base-sepolia')}
                        className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${
                          selectedChain === 'base-sepolia'
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-black/30 border-purple-500/30 hover:border-purple-500/50'
                        }`}
                      >
                        🔵 Base Sepolia
                      </button>
                      <button
                        onClick={() => setSelectedChain('eth-sepolia')}
                        className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${
                          selectedChain === 'eth-sepolia'
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-black/30 border-purple-500/30 hover:border-purple-500/50'
                        }`}
                      >
                        ⟠ ETH Sepolia
                      </button>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Amount (USDC):</div>
                    <input
                      type="number"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      placeholder="e.g., 20"
                      className="w-full bg-black/30 border border-purple-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={fundFromMetaMask}
                      disabled={isFunding || !fundAmount}
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                    >
                      {isFunding ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Send className="h-3 w-3 mr-1" />
                      )}
                      Send
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setShowFundInput(false); setFundAmount(''); }}
                      disabled={isFunding}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

// Plan Card Component
const PlanCard: React.FC<{ plan: Plan; onSelect: () => void }> = ({ plan, onSelect }) => {
  const { approvePlan, cancelPlan, executePlan, isLoading } = useHiFiBot();

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-lg">{plan.totalAmount} USDC</div>
          <div className="text-xs text-muted-foreground">
            {new Date(plan.createdAt).toLocaleDateString()}
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border ${statusColors[plan.status]}`}>
          {plan.status}
        </span>
      </div>

      {/* Allocation Summary */}
      <div className="space-y-2 mb-3">
        {plan.allocations.map((alloc, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{alloc.poolName}</span>
            <span className="font-medium">{alloc.amount} USDC ({alloc.percentage}%)</span>
          </div>
        ))}
      </div>

      {/* Execution Mode */}
      <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${plan.executionMode === 'circle' ? 'bg-purple-400' : 'bg-orange-400'}`} />
        {plan.executionMode === 'circle' ? 'AI-managed (Circle)' : 'Manual (MetaMask)'}
      </div>

      {/* Execution Progress */}
      {plan.status === 'EXECUTING' && plan.executionProgress && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span>{plan.executionProgress.message}</span>
            <span>{plan.executionProgress.currentStep}/{plan.executionProgress.totalSteps}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${(plan.executionProgress.currentStep / plan.executionProgress.totalSteps) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-3">
        {plan.status === 'DRAFT' && (
          <>
            <Button
              size="sm"
              onClick={() => approvePlan(plan._id)}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-3 w-3 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => cancelPlan(plan._id)}
              disabled={isLoading}
            >
              <XCircle className="h-3 w-3" />
            </Button>
          </>
        )}
        {plan.status === 'APPROVED' && (
          <Button
            size="sm"
            onClick={() => executePlan(plan._id)}
            disabled={isLoading}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            <Play className="h-3 w-3 mr-1" />
            Execute
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onSelect}
          className="flex-1"
        >
          Details
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
};

// Plans Tab Component
const PlansTab: React.FC = () => {
  const { plans, loadPlans, isLoading, setCurrentPlan, setActiveTab } = useHiFiBot();
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const filteredPlans = filter === 'all' 
    ? plans 
    : plans.filter(p => p.status === filter);

  const handleSelectPlan = (plan: Plan) => {
    setCurrentPlan(plan);
    setActiveTab('chat');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Circle Wallet Info */}
      <div className="p-4 border-b border-border">
        <CircleWalletCard userId={user?._id} />
      </div>

      {/* Filter Tabs */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Your Plans</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => loadPlans()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {['all', 'DRAFT', 'APPROVED', 'EXECUTING', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                filter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Plans List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
        {isLoading && plans.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No plans found</p>
            <p className="text-xs mt-1">Create a new plan in the Chat tab</p>
          </div>
        ) : (
          filteredPlans.map((plan) => (
            <PlanCard 
              key={plan._id} 
              plan={plan} 
              onSelect={() => handleSelectPlan(plan)}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Main Sidebar Component
export const HiFiBotSidebar: React.FC = () => {
  const { isOpen, closeSidebar, activeTab, setActiveTab } = useHiFiBot();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[400px] lg:w-[450px] xl:w-[500px] bg-background border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg">HI.FI BOT</h2>
              <p className="text-xs text-muted-foreground">Your AI Investment Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border">
              <Image
                src="/images/circle.png"
                alt="Circle"
                width={20}
                height={20}
                className="rounded-full"
              />
              <span className="text-[15px] font-medium text-muted-foreground">Powered by Circle</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeSidebar}
              className="rounded-xl"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'chat'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'plans'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-4 w-4" />
            Plans
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' ? <ChatTab /> : <PlansTab />}
        </div>

        {/* Safety Footer */}
        <div className="p-3 border-t border-border bg-muted/20">
          <p className="text-[10px] text-muted-foreground text-center">
            🔒 HI.FI BOT only executes AI-managed transactions with your explicit approval via Circle wallets.
          </p>
        </div>
      </div>
    </>
  );
};

// Floating Button to Open Sidebar
export const HiFiBotButton: React.FC = () => {
  const { openSidebar, isOpen } = useHiFiBot();

  if (isOpen) return null;

  return (
    <button
      onClick={openSidebar}
      className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-40"
    >
      <Bot className="h-6 w-6" />
    </button>
  );
};
