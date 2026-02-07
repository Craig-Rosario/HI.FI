import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import connectToDatabase from '@/lib/mongodb';
import ChatMessage from '@/models/ChatMessage';
import Plan from '@/models/Plan';
import Pool from '@/models/Pool';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is not set');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are HI.FI BOT, an AI assistant helping users create USDC investment plans in a DeFi platform.

CRITICAL SAFETY RULES - ALWAYS FOLLOW:
1. You NEVER execute transactions
2. You NEVER sign transactions  
3. You NEVER access private keys
4. You NEVER control funds directly
5. You NEVER auto-rebalance portfolios
6. You NEVER trade tokens without explicit approval
7. You NEVER move funds without user clicking "Approve Plan"

ALWAYS STATE WHEN RELEVANT:
- "Execution requires user approval"
- "Funds are held in Circle-managed wallets (if applicable)"
- "You can approve, modify, or cancel this plan"

YOUR CAPABILITIES:
- Help users create investment plans
- Explain investment strategies
- Generate allocation recommendations
- Answer questions about pools and yields
- Guide users through the planning process

AVAILABLE POOLS:
- Easy Pool: Low risk, 1 minute withdrawal window, stable protocol yield (~3-5% APY)
- Medium Pool: Balanced exposure, 5 minute withdrawal window (~5-8% APY)
- Hard Pool: Higher risk, 10 minute withdrawal window, higher potential returns (~8-15% APY)

When a user wants to create a plan, you MUST collect information ONE QUESTION AT A TIME in this order:
1. Total USDC amount
2. Risk preference (Easy/Medium/Hard)
3. Lockup comfort (short/medium/long term)
4. Execution mode (Manual MetaMask or AI-managed Circle wallets)

Be conversational, friendly, but professional. Keep responses concise.`;

interface ConversationContext {
  isCreatingPlan: boolean;
  currentStep: number;
  collectedData: {
    amount?: number;
    riskPreference?: string;
    lockupComfort?: string;
    executionMode?: string;
  };
}

function detectIntent(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('create') && (lowerMessage.includes('plan') || lowerMessage.includes('investment'))) {
    return 'create_plan';
  }
  if (lowerMessage.includes('modify') || lowerMessage.includes('change') || lowerMessage.includes('edit')) {
    return 'modify_plan';
  }
  if (lowerMessage.includes('explain') || lowerMessage.includes('what') || lowerMessage.includes('how')) {
    return 'explain';
  }
  if (lowerMessage.includes('cancel')) {
    return 'cancel_plan';
  }
  return null;
}

function parseAmount(message: string): number | null {
  // Match patterns like "100", "$100", "100 USDC", "100USDC"
  const patterns = [
    /\$?([\d,]+(?:\.\d{1,2})?)\s*(?:usdc|usd|dollars?)?/i,
    /(?:usdc|usd)\s*\$?([\d,]+(?:\.\d{1,2})?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0) return amount;
    }
  }
  return null;
}

function parseRiskPreference(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('easy') || lowerMessage.includes('low') || lowerMessage.includes('safe') || lowerMessage.includes('conservative')) {
    return 'easy';
  }
  if (lowerMessage.includes('medium') || lowerMessage.includes('balanced') || lowerMessage.includes('moderate')) {
    return 'medium';
  }
  if (lowerMessage.includes('hard') || lowerMessage.includes('high') || lowerMessage.includes('aggressive') || lowerMessage.includes('risky')) {
    return 'hard';
  }
  return null;
}

function parseLockupComfort(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('short') || lowerMessage.includes('quick') || lowerMessage.includes('1') || lowerMessage.includes('one') || lowerMessage.includes('minute')) {
    return 'short';
  }
  if (lowerMessage.includes('medium') || lowerMessage.includes('5') || lowerMessage.includes('five') || lowerMessage.includes('moderate')) {
    return 'medium';
  }
  if (lowerMessage.includes('long') || lowerMessage.includes('10') || lowerMessage.includes('ten') || lowerMessage.includes('extended')) {
    return 'long';
  }
  return null;
}

function parseExecutionMode(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('manual') || lowerMessage.includes('metamask') || lowerMessage.includes('wallet') || lowerMessage.includes('myself') || lowerMessage.includes('1')) {
    return 'metamask';
  }
  if (lowerMessage.includes('ai') || lowerMessage.includes('circle') || lowerMessage.includes('managed') || lowerMessage.includes('automatic') || lowerMessage.includes('2')) {
    return 'circle';
  }
  return null;
}

function generateAllocation(amount: number, riskPreference: string, lockupComfort: string): {
  allocations: Array<{
    pool: string;
    riskLevel: string;
    percentage: number;
    amount: number;
    lockup: string;
    yieldSource: string;
  }>;
  summary: string;
} {
  let easyPercent = 0;
  let mediumPercent = 0;
  let hardPercent = 0;

  // Base allocation on risk preference
  switch (riskPreference) {
    case 'easy':
      easyPercent = 70;
      mediumPercent = 20;
      hardPercent = 10;
      break;
    case 'medium':
      easyPercent = 40;
      mediumPercent = 40;
      hardPercent = 20;
      break;
    case 'hard':
      easyPercent = 20;
      mediumPercent = 30;
      hardPercent = 50;
      break;
  }

  // Adjust based on lockup comfort
  if (lockupComfort === 'short') {
    // Favor easy pool for short lockup
    const adjustment = 10;
    easyPercent = Math.min(100, easyPercent + adjustment);
    hardPercent = Math.max(0, hardPercent - adjustment);
  } else if (lockupComfort === 'long') {
    // Can take more risk with longer lockup
    const adjustment = 10;
    hardPercent = Math.min(100, hardPercent + adjustment);
    easyPercent = Math.max(0, easyPercent - adjustment);
  }

  // Normalize percentages
  const total = easyPercent + mediumPercent + hardPercent;
  easyPercent = Math.round((easyPercent / total) * 100);
  mediumPercent = Math.round((mediumPercent / total) * 100);
  hardPercent = 100 - easyPercent - mediumPercent;

  const allocations = [];
  
  if (easyPercent > 0) {
    allocations.push({
      pool: 'Easy Pool',
      riskLevel: 'easy',
      percentage: easyPercent,
      amount: parseFloat((amount * easyPercent / 100).toFixed(2)),
      lockup: '1 minute',
      yieldSource: 'protocol',
    });
  }
  
  if (mediumPercent > 0) {
    allocations.push({
      pool: 'Medium Pool',
      riskLevel: 'medium',
      percentage: mediumPercent,
      amount: parseFloat((amount * mediumPercent / 100).toFixed(2)),
      lockup: '5 minutes',
      yieldSource: 'protocol',
    });
  }
  
  if (hardPercent > 0) {
    allocations.push({
      pool: 'Hard Pool',
      riskLevel: 'hard',
      percentage: hardPercent,
      amount: parseFloat((amount * hardPercent / 100).toFixed(2)),
      lockup: '10 minutes',
      yieldSource: 'protocol',
    });
  }

  const summary = generatePlanSummary(riskPreference, lockupComfort, allocations);

  return { allocations, summary };
}

function generatePlanSummary(riskPreference: string, lockupComfort: string, allocations: any[]): string {
  const riskDescriptions: Record<string, string> = {
    easy: 'prioritizes capital preservation with stable returns',
    medium: 'balances safety with growth potential',
    hard: 'maximizes growth potential with higher risk tolerance',
  };

  const lockupDescriptions: Record<string, string> = {
    short: 'keeping funds highly liquid with 1 minute withdrawal windows',
    medium: 'accepting 5 minute withdrawal windows for balanced returns',
    long: 'committing to 10 minute withdrawal windows for better yields',
  };

  return `This plan ${riskDescriptions[riskPreference]} while ${lockupDescriptions[lockupComfort]}. ` +
    `Your funds will be distributed across ${allocations.length} pool(s) to optimize risk-adjusted returns.`;
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { sessionId, userId, walletAddress, message, context } = body;

    if (!sessionId || !userId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Save user message
    await ChatMessage.create({
      sessionId,
      userId,
      role: 'user',
      content: message,
      metadata: context,
    });

    // Get conversation history
    const history = await ChatMessage.find({ sessionId })
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    // Parse current context
    const currentContext: ConversationContext = context || {
      isCreatingPlan: false,
      currentStep: 0,
      collectedData: {},
    };

    let assistantResponse = '';
    let newContext = { ...currentContext };
    let generatedPlan = null;

    // Check for plan creation flow
    const intent = detectIntent(message);
    
    if (intent === 'create_plan' && !currentContext.isCreatingPlan) {
      // Start plan creation flow
      newContext = {
        isCreatingPlan: true,
        currentStep: 1,
        collectedData: {},
      };
      assistantResponse = "Great! Let's create an investment plan for you. 🎯\n\n**How much USDC do you want to allocate?**\n\nPlease enter the total amount you'd like to invest (e.g., \"100 USDC\").";
    } else if (currentContext.isCreatingPlan) {
      // Continue plan creation flow
      switch (currentContext.currentStep) {
        case 1: // Collecting amount
          const amount = parseAmount(message);
          if (amount && amount > 0) {
            newContext.collectedData.amount = amount;
            newContext.currentStep = 2;
            assistantResponse = `Perfect! You want to invest **${amount} USDC**. ✅\n\n**What's your risk preference?**\n\n• **Easy** (Low risk) - Stable, conservative returns\n• **Medium** - Balanced exposure\n• **Hard** (High risk) - Higher potential returns`;
          } else {
            assistantResponse = "I couldn't understand the amount. Please enter a valid USDC amount (e.g., \"100\" or \"50 USDC\").";
          }
          break;

        case 2: // Collecting risk preference
          const risk = parseRiskPreference(message);
          if (risk) {
            newContext.collectedData.riskPreference = risk;
            newContext.currentStep = 3;
            assistantResponse = `Got it! You prefer **${risk.charAt(0).toUpperCase() + risk.slice(1)}** risk. ✅\n\n**What withdrawal window are you comfortable with?**\n\n• **Short (1 min)** - Quick access to funds\n• **Medium (5 min)** - Balanced flexibility\n• **Long (10 min)** - Higher yields, longer wait`;
          } else {
            assistantResponse = "Please choose a risk level: **Easy** (low risk), **Medium**, or **Hard** (high risk).";
          }
          break;

        case 3: // Collecting lockup comfort
          const lockup = parseLockupComfort(message);
          if (lockup) {
            newContext.collectedData.lockupComfort = lockup;
            newContext.currentStep = 4;
            assistantResponse = `Great choice! You're comfortable with **${lockup === 'short' ? '1 minute' : lockup === 'medium' ? '5 minute' : '10 minute'}** withdrawal windows. ✅\n\n**How would you like to execute this plan?**\n\n1️⃣ **Manual (MetaMask)** - You sign each transaction yourself\n2️⃣ **AI-managed (Circle Wallets)** - Automatic execution after approval\n\n_Note: With AI-managed execution, funds will be held in a Circle-managed wallet. You retain full control and can withdraw anytime._`;
          } else {
            assistantResponse = "Please choose a withdrawal window: **Short** (1 min), **Medium** (5 min), or **Long** (10 min).";
          }
          break;

        case 4: // Collecting execution mode
          const execMode = parseExecutionMode(message);
          if (execMode) {
            newContext.collectedData.executionMode = execMode;
            newContext.currentStep = 5;
            newContext.isCreatingPlan = false;

            // Generate the plan
            const { allocations, summary } = generateAllocation(
              newContext.collectedData.amount!,
              newContext.collectedData.riskPreference!,
              newContext.collectedData.lockupComfort!
            );

            // Get pool IDs from database
            const pools = await Pool.find({}).lean();
            const poolMap: Record<string, any> = {};
            pools.forEach((p: any) => {
              if (p.riskLevel === 'low') poolMap['easy'] = p;
              else if (p.riskLevel === 'medium') poolMap['medium'] = p;
              else if (p.riskLevel === 'high') poolMap['hard'] = p;
            });

            // Create plan allocations with pool IDs
            const planAllocations = allocations.map(a => ({
              poolId: poolMap[a.riskLevel]?._id?.toString() || '',
              poolName: a.pool,
              riskLevel: a.riskLevel,
              percentage: a.percentage,
              amount: a.amount,
              lockupPeriod: a.lockup,
              yieldSource: a.yieldSource,
            }));

            // Create the plan in database
            const plan = await Plan.create({
              userId,
              walletAddress: walletAddress?.toLowerCase(),
              totalAmount: newContext.collectedData.amount,
              riskPreference: newContext.collectedData.riskPreference,
              lockupComfort: newContext.collectedData.lockupComfort,
              executionMode: execMode,
              status: 'DRAFT',
              allocations: planAllocations,
              summary,
            });

            generatedPlan = {
              id: plan._id.toString(),
              totalAmount: newContext.collectedData.amount,
              allocations,
              executionMode: execMode,
              summary,
            };

            // Build response
            const executionModeLabel = execMode === 'metamask' 
              ? 'Manual (MetaMask)'
              : 'AI-managed (Circle Wallets)';

            let planText = `## 📋 Proposed Plan\n\n`;
            
            allocations.forEach(a => {
              planText += `### ${a.pool}: ${a.amount} USDC (${a.percentage}%)\n`;
              planText += `- Risk: ${a.riskLevel.charAt(0).toUpperCase() + a.riskLevel.slice(1)}\n`;
              planText += `- Lockup: ${a.lockup}\n`;
              planText += `- Yield: ${a.yieldSource === 'protocol' ? 'Protocol yield' : 'Subsidized yield'}\n\n`;
            });

            planText += `---\n\n**Execution Mode:** ${executionModeLabel}\n\n`;
            
            if (execMode === 'circle') {
              planText += `⚠️ _Funds will be held in a Circle-managed wallet. Execution requires your explicit approval._\n\n`;
            }

            planText += `**Summary:** ${summary}\n\n`;
            planText += `---\n\n✅ **You can approve, modify, or cancel this plan.**`;

            assistantResponse = planText;
          } else {
            assistantResponse = "Please choose an execution mode:\n\n1️⃣ **Manual (MetaMask)** - You sign each transaction\n2️⃣ **AI-managed (Circle Wallets)** - Automatic execution";
          }
          break;
      }
    } else {
      // Use Gemini for general conversation
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const chatHistory = history.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
          { role: 'model', parts: [{ text: 'I understand. I am HI.FI BOT, ready to help users create safe USDC investment plans. I will never execute transactions, sign transactions, or access private keys. All execution requires explicit user approval.' }] },
          ...chatHistory,
        ],
      });

      const result = await chat.sendMessage(message);
      assistantResponse = result.response.text();
    }

    // Save assistant response
    const assistantMessage = await ChatMessage.create({
      sessionId,
      userId,
      role: 'assistant',
      content: assistantResponse,
      metadata: {
        ...newContext,
        planId: generatedPlan?.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: assistantMessage._id.toString(),
        role: 'assistant',
        content: assistantResponse,
        createdAt: assistantMessage.createdAt,
      },
      context: newContext,
      plan: generatedPlan,
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET chat history
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');

    if (!sessionId && !userId) {
      return NextResponse.json(
        { error: 'sessionId or userId required' },
        { status: 400 }
      );
    }

    const query: any = {};
    if (sessionId) query.sessionId = sessionId;
    if (userId) query.userId = userId;

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      messages: messages.map((m: any) => ({
        id: m._id.toString(),
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        metadata: m.metadata,
      })),
    });

  } catch (error) {
    console.error('Get chat history error:', error);
    return NextResponse.json(
      { error: 'Failed to get chat history' },
      { status: 500 }
    );
  }
}
