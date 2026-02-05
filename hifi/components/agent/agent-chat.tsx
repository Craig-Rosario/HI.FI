'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useMetaMask } from '@/hooks/use-metamask';

interface Message {
    id: string;
    role: 'user' | 'agent';
    content: string;
    timestamp: Date;
    data?: any;
}

interface AgentChatProps {
    isOpen: boolean;
    onClose: () => void;
    poolId?: string;
}

export default function AgentChat({ isOpen, onClose, poolId }: AgentChatProps) {
    const { account } = useMetaMask();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            // Send initial greeting
            setMessages([
                {
                    id: '1',
                    role: 'agent',
                    content: "👋 Hi! I'm your AI investment agent. I can help you:\n\n• Choose the right pool for your risk profile\n• Decide when to withdraw\n• Analyze market conditions\n• Set up automated strategies\n\nWhat would you like to know?",
                    timestamp: new Date(),
                },
            ]);
        }
    }, [isOpen]);

    const quickQuestions = [
        { label: 'Should I withdraw?', query: 'should_withdraw' },
        { label: 'Which pool is best?', query: 'best_pool' },
        { label: 'Market analysis', query: 'market_analysis' },
        { label: 'Risk assessment', query: 'risk_assessment' },
    ];

    const handleQuickQuestion = async (query: string, label: string) => {
        await sendMessage(label, query);
    };

    const sendMessage = async (userMessage?: string, query?: string) => {
        const messageText = userMessage || input;
        if (!messageText.trim() || !account) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await fetch('/api/agent/recommendation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: account,
                    query: query || 'general',
                }),
            });

            const result = await response.json();

            if (result.error && result.requiresQuestionnaire) {
                const agentMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'agent',
                    content:
                        "📋 I need to understand your investment profile first. Please complete the risk assessment questionnaire so I can provide personalized recommendations.\n\nClick the 'Complete Questionnaire' button to get started.",
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, agentMsg]);
            } else if (result.success) {
                const agentMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'agent',
                    content: formatRecommendation(result.recommendation, query),
                    timestamp: new Date(),
                    data: result.recommendation,
                };
                setMessages((prev) => [...prev, agentMsg]);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const formatRecommendation = (rec: any, query?: string) => {
        if (query === 'should_withdraw') {
            const { action, confidence, message, factors, currentPnL, withdrawWindowOpen } = rec;

            let response = `${message}\n\n`;
            response += `**Confidence:** ${confidence}%\n`;
            response += `**Current P&L:** ${currentPnL > 0 ? '+' : ''}${currentPnL.toFixed(2)}%\n`;
            response += `**Withdraw Window:** ${withdrawWindowOpen ? '✅ Open' : '❌ Closed'}\n\n`;

            if (factors && factors.length > 0) {
                response += '**Key Factors:**\n';
                factors.forEach((factor: string) => {
                    response += `• ${factor}\n`;
                });
            }

            if (rec.automationSuggestion) {
                response += `\n💡 **Automation Tip:** ${rec.automationSuggestion}`;
            }

            return response;
        }

        if (query === 'best_pool') {
            const { recommendedPool, reasoning } = rec;

            let response = `🎯 **Recommended Pool:** ${recommendedPool.pool.name || recommendedPool.pool.riskLevel}\n\n`;
            response += `**Risk Score:** ${rec.userRiskScore}/100\n\n`;

            if (reasoning) {
                response += '**Why this pool?**\n';
                recommendedPool.reasoning.forEach((reason: string) => {
                    response += `• ${reason}\n`;
                });
            }

            if (rec.alternativePools && rec.alternativePools.length > 0) {
                response += '\n**Alternatives:**\n';
                rec.alternativePools.forEach((alt: any) => {
                    response += `• ${alt.pool.name || alt.pool.riskLevel}: ${alt.reasoning[0] || 'Alternative option'}\n`;
                });
            }

            return response;
        }

        if (query === 'market_analysis') {
            const { marketSentiment, volatilityIndex, insights, recommendations } = rec;

            let response = `📊 **Market Analysis**\n\n`;
            response += `**Sentiment:** ${marketSentiment}\n`;
            response += `**Volatility Index:** ${volatilityIndex}/100\n\n`;

            if (insights && insights.length > 0) {
                response += '**Insights:**\n';
                insights.forEach((insight: string) => {
                    response += `• ${insight}\n`;
                });
            }

            if (recommendations && recommendations.length > 0) {
                response += '\n**Recommendations:**\n';
                recommendations.forEach((rec: string) => {
                    response += `• ${rec}\n`;
                });
            }

            return response;
        }

        if (query === 'risk_assessment') {
            const { currentRisk, pnlPercent, recommendations } = rec;

            let response = `⚡ **Risk Assessment**\n\n`;
            response += `**Current Risk Level:** ${currentRisk.toUpperCase()}\n`;
            if (pnlPercent !== undefined) {
                response += `**P&L:** ${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%\n\n`;
            }

            if (recommendations && recommendations.length > 0) {
                response += '**Recommendations:**\n';
                recommendations.forEach((rec: string) => {
                    response += `• ${rec}\n`;
                });
            }

            return response;
        }

        // General recommendation
        if (rec.message) {
            let response = rec.message + '\n\n';

            if (rec.recommendations) {
                response += '**Next Steps:**\n';
                rec.recommendations.forEach((r: string) => {
                    response += `• ${r}\n`;
                });
            }

            return response;
        }

        return JSON.stringify(rec, null, 2);
    };

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>🤖 AI Investment Agent</SheetTitle>
                </SheetHeader>

                <div className="flex flex-col h-[calc(100vh-8rem)]">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto py-4 space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-800 text-gray-100'
                                        }`}
                                >
                                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                                    <div className="text-xs opacity-50 mt-1">
                                        {msg.timestamp.toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-800 text-gray-100 p-3 rounded-lg">
                                    <div className="flex space-x-2">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Questions */}
                    {messages.length <= 1 && (
                        <div className="py-4 border-t border-gray-800">
                            <p className="text-sm text-gray-400 mb-2">Quick Questions:</p>
                            <div className="flex flex-wrap gap-2">
                                {quickQuestions.map((q) => (
                                    <Button
                                        key={q.query}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleQuickQuestion(q.query, q.label)}
                                        disabled={loading}
                                    >
                                        {q.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input */}
                    <div className="pt-4 border-t border-gray-800">
                        <div className="flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && !loading && sendMessage()}
                                placeholder="Ask me anything..."
                                disabled={loading}
                                className="flex-1"
                            />
                            <Button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
                                Send
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
