'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Plan {
  _id: string;
  userId: string;
  walletAddress: string;
  totalAmount: number;
  riskPreference: 'easy' | 'medium' | 'hard';
  lockupComfort: string;
  executionMode: 'metamask' | 'circle';
  status: 'DRAFT' | 'APPROVED' | 'EXECUTING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  allocations: Array<{
    poolId: string;
    poolName: string;
    riskLevel: string;
    percentage: number;
    amount: number;
    lockupPeriod: string;
    yieldSource: string;
    txHash?: string;
    depositedAt?: Date;
  }>;
  summary: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  executionStartedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  executionProgress?: {
    currentStep: number;
    totalSteps: number;
    currentPoolName?: string;
    message?: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  plan?: Plan;
}

interface HiFiBotContextType {
  isOpen: boolean;
  activeTab: 'chat' | 'plans';
  messages: ChatMessage[];
  plans: Plan[];
  currentPlan: Plan | null;
  isLoading: boolean;
  sessionId: string;
  context: {
    isCreatingPlan: boolean;
    currentStep: number;
    collectedData: {
      amount?: number;
      riskPreference?: string;
      lockupComfort?: string;
      executionMode?: string;
    };
  };
  
  // Actions
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  setActiveTab: (tab: 'chat' | 'plans') => void;
  sendMessage: (message: string) => Promise<void>;
  loadPlans: () => Promise<void>;
  approvePlan: (planId: string) => Promise<void>;
  cancelPlan: (planId: string) => Promise<void>;
  executePlan: (planId: string) => Promise<void>;
  setCurrentPlan: (plan: Plan | null) => void;
  clearChat: () => void;
}

const HiFiBotContext = createContext<HiFiBotContextType | undefined>(undefined);

export const useHiFiBot = () => {
  const context = useContext(HiFiBotContext);
  if (!context) {
    throw new Error('useHiFiBot must be used within a HiFiBotProvider');
  }
  return context;
};

interface HiFiBotProviderProps {
  children: ReactNode;
  userId: string;
  walletAddress: string;
}

export const HiFiBotProvider: React.FC<HiFiBotProviderProps> = ({ 
  children, 
  userId, 
  walletAddress 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'plans'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Welcome to **HI.FI BOT**! I'm here to help you create and manage your USDC investment plans.\n\n**What I can do:**\n- Create personalized investment plans\n- Explain pool strategies and risks\n- Guide you through the investment process\n\n**Try saying:**\n- "Create a new plan"\n- "Explain the pools"\n- "What's my current allocation?"\n\n_Remember: I never execute transactions or access your keys. All actions require your explicit approval._`,
      createdAt: new Date().toISOString(),
    },
  ]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [context, setContext] = useState({
    isCreatingPlan: false,
    currentStep: 0,
    collectedData: {},
  });

  const toggleSidebar = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const openSidebar = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsOpen(false);
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId,
          walletAddress,
          message,
          context,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: data.message.id,
          role: 'assistant',
          content: data.message.content,
          createdAt: data.message.createdAt,
          plan: data.plan ? { ...data.plan, _id: data.plan.id } : undefined,
        };

        setMessages(prev => [...prev, assistantMessage]);
        setContext(data.context || context);

        // If a plan was generated, refresh plans and set current plan
        if (data.plan) {
          await loadPlans();
          const newPlan = await fetchPlan(data.plan.id);
          if (newPlan) {
            setCurrentPlan(newPlan);
          }
        }
      } else {
        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your message. Please try again.',
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Send message error:', error);
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please check your connection and try again.',
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, userId, walletAddress, context, isLoading]);

  const fetchPlan = async (planId: string): Promise<Plan | null> => {
    try {
      const response = await fetch(`/api/plans?planId=${planId}`);
      const data = await response.json();
      return data.success ? data.plan : null;
    } catch (error) {
      console.error('Fetch plan error:', error);
      return null;
    }
  };

  const loadPlans = useCallback(async () => {
    try {
      const response = await fetch(`/api/plans?userId=${userId}`);
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Load plans error:', error);
    }
  }, [userId]);

  const approvePlan = useCallback(async (planId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, action: 'approve' }),
      });

      const data = await response.json();
      
      if (data.success) {
        await loadPlans();
        setCurrentPlan(data.plan);
        
        const successMessage: ChatMessage = {
          id: `system_${Date.now()}`,
          role: 'assistant',
          content: `✅ **Plan Approved!**\n\nYour investment plan has been approved and is ready for execution.\n\n${
            data.plan.executionMode === 'metamask' 
              ? '**Next Step:** Click "Execute Plan" to start the MetaMask transaction flow. You will need to approve and sign each transaction.'
              : '**Next Step:** Click "Execute Plan" to start AI-managed execution. Your funds in the Circle wallet will be automatically allocated according to the plan.'
          }\n\n_Execution requires your explicit action. No funds will move until you proceed._`,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, successMessage]);
      } else {
        throw new Error(data.error || 'Failed to approve plan');
      }
    } catch (error) {
      console.error('Approve plan error:', error);
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `❌ **Error:** ${error instanceof Error ? error.message : 'Failed to approve plan'}`,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [loadPlans]);

  const cancelPlan = useCallback(async (planId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, action: 'cancel' }),
      });

      const data = await response.json();
      
      if (data.success) {
        await loadPlans();
        setCurrentPlan(null);
        setContext({
          isCreatingPlan: false,
          currentStep: 0,
          collectedData: {},
        });
        
        const successMessage: ChatMessage = {
          id: `system_${Date.now()}`,
          role: 'assistant',
          content: '❌ **Plan Cancelled**\n\nYour investment plan has been cancelled. No funds were moved.\n\nWould you like to create a new plan? Just say "Create a new plan" to start fresh.',
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, successMessage]);
      } else {
        throw new Error(data.error || 'Failed to cancel plan');
      }
    } catch (error) {
      console.error('Cancel plan error:', error);
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `❌ **Error:** ${error instanceof Error ? error.message : 'Failed to cancel plan'}`,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [loadPlans]);

  const executePlan = useCallback(async (planId: string) => {
    const plan = plans.find(p => p._id === planId) || currentPlan;
    if (!plan) return;

    setIsLoading(true);

    if (plan.executionMode === 'circle') {
      // AI-managed execution via Circle wallets
      try {
        const startMessage: ChatMessage = {
          id: `exec_start_${Date.now()}`,
          role: 'assistant',
          content: '🚀 **Starting AI-Managed Execution**\n\nExecuting your plan using Circle wallets...\n\n_Funds are held in your dedicated Circle-managed wallet. I am narrating the execution but do not control your keys or funds._',
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, startMessage]);

        const response = await fetch('/api/plans/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, userId }),
        });

        const data = await response.json();

        if (data.success) {
          await loadPlans();
          setCurrentPlan(data.plan);

          const successMessage: ChatMessage = {
            id: `exec_complete_${Date.now()}`,
            role: 'assistant',
            content: `✅ **Execution Complete!**\n\n${data.results.map((r: any) => 
              `• **${r.poolName}:** ${r.amount} USDC ${r.success ? '✅' : '❌'}`
            ).join('\n')}\n\n${data.message}\n\nYour investments are now active! You can monitor them in the Pools section.`,
            createdAt: new Date().toISOString(),
          };
          setMessages(prev => [...prev, successMessage]);
          setActiveTab('plans');
        } else {
          throw new Error(data.error || 'Execution failed');
        }
      } catch (error) {
        console.error('Execute plan error:', error);
        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: `❌ **Execution Error:** ${error instanceof Error ? error.message : 'Failed to execute plan'}\n\nPlease try again or contact support.`,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } else {
      // MetaMask execution - provide instructions
      const metamaskMessage: ChatMessage = {
        id: `metamask_${Date.now()}`,
        role: 'assistant',
        content: `🦊 **MetaMask Execution Mode**\n\nTo execute this plan manually:\n\n${plan.allocations.map((a, i) => 
          `${i + 1}. Go to **${a.poolName}** in the Pools section\n   • Deposit **${a.amount} USDC**\n   • Approve the transaction in MetaMask`
        ).join('\n\n')}\n\n_I'll track your progress as you complete each deposit. Navigate to the Pools section to begin._\n\n⚠️ **Remember:** You control all transactions. I only provide guidance.`,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, metamaskMessage]);

      // Update plan status
      await fetch('/api/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, action: 'start_execution' }),
      });
      await loadPlans();
    }

    setIsLoading(false);
  }, [plans, currentPlan, userId, loadPlans]);

  const clearChat = useCallback(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `👋 Chat cleared! How can I help you today?\n\n**Try saying:**\n- "Create a new plan"\n- "Explain the pools"\n- "Show my active plans"`,
      createdAt: new Date().toISOString(),
    }]);
    setContext({
      isCreatingPlan: false,
      currentStep: 0,
      collectedData: {},
    });
    setCurrentPlan(null);
  }, []);

  const value: HiFiBotContextType = {
    isOpen,
    activeTab,
    messages,
    plans,
    currentPlan,
    isLoading,
    sessionId,
    context,
    toggleSidebar,
    openSidebar,
    closeSidebar,
    setActiveTab,
    sendMessage,
    loadPlans,
    approvePlan,
    cancelPlan,
    executePlan,
    setCurrentPlan,
    clearChat,
  };

  return (
    <HiFiBotContext.Provider value={value}>
      {children}
    </HiFiBotContext.Provider>
  );
};
