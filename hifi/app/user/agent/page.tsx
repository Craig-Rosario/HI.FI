'use client';

import { HighRiskPoolCard } from '@/components/pools/high-risk-pool-card';
import { AgentPermissionsManager } from '@/components/agent/agent-permissions-manager';
import RiskQuestionnaire from '@/components/agent/risk-questionnaire';
import AgentChat from '@/components/agent/agent-chat';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function AgentPage() {
    const [showQuestionnaire, setShowQuestionnaire] = useState(false);
    const [showChat, setShowChat] = useState(false);

    const handleQuestionnaireComplete = (data: any, recommendation: any) => {
        console.log('Questionnaire complete:', data, recommendation);
        setShowQuestionnaire(false);
        // Optionally show success message or open chat
    };

    return (
        <div className="p-6 md:p-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold mb-2">🤖 AI Agent Management</h1>
                <p className="text-foreground/70">
                    Automate your DeFi investments with AI-powered agents. Complete risk assessment, manage permissions, and get personalized recommendations.
                </p>
            </div>

            {/* Risk Assessment & Agent Chat */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div>
                    {!showQuestionnaire ? (
                        <div className="bg-card border border-gray-800 rounded-lg p-6">
                            <h2 className="text-2xl font-bold mb-4">Risk Assessment</h2>
                            <p className="text-foreground/70 mb-6">
                                Complete our risk questionnaire to receive personalized investment recommendations from our AI agent.
                            </p>
                            <Button onClick={() => setShowQuestionnaire(true)} size="lg">
                                Start Risk Assessment
                            </Button>
                        </div>
                    ) : (
                        <div>
                            <Button
                                onClick={() => setShowQuestionnaire(false)}
                                variant="outline"
                                className="mb-4"
                            >
                                ← Back
                            </Button>
                            <RiskQuestionnaire onComplete={handleQuestionnaireComplete} onSkip={() => setShowQuestionnaire(false)} />
                        </div>
                    )}
                </div>

                <div className="bg-card border border-gray-800 rounded-lg p-6">
                    <h2 className="text-2xl font-bold mb-4">AI Agent Chat</h2>
                    <p className="text-foreground/70 mb-6">
                        Get personalized investment advice and recommendations from our AI agent.
                    </p>
                    <Button onClick={() => setShowChat(true)} size="lg">
                        Open Chat
                    </Button>
                </div>
            </div>

            {/* Agent Chat Modal */}
            <AgentChat isOpen={showChat} onClose={() => setShowChat(false)} />

            {/* High Risk Pool & Permissions */}
            <div>
                <h2 className="text-2xl font-bold mb-4">High Risk Pool & Agent Permissions</h2>
                <p className="text-foreground/70 mb-6">
                    Manage your high-risk pool investments and delegate actions to AI agents for automated management.
                </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <HighRiskPoolCard />
                <AgentPermissionsManager />
            </div>

            {/* Info Section */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
                <h3 className="text-xl font-bold text-blue-400 mb-4">How AI Agents Work</h3>
                <div className="grid md:grid-cols-3 gap-6 text-sm">
                    <div>
                        <h4 className="font-semibold text-blue-300 mb-2">1. Risk Assessment</h4>
                        <p className="text-foreground/70">
                            Complete a 7-step questionnaire to determine your risk profile and investment preferences.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-blue-300 mb-2">2. Grant Permissions</h4>
                        <p className="text-foreground/70">
                            Delegate specific actions to AI agents with time, amount, and usage limits for security.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-blue-300 mb-2">3. Automated Management</h4>
                        <p className="text-foreground/70">
                            Agents monitor markets 24/7 and execute optimal strategies within your granted permissions.
                        </p>
                    </div>
                </div>
            </div>

            {/* Benefits */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
                    <h3 className="font-semibold text-green-400 mb-3">✅ Key Benefits</h3>
                    <ul className="space-y-2 text-sm text-foreground/70">
                        <li>• Reduce transaction signatures from 8 to 1</li>
                        <li>• 24/7 market monitoring and execution</li>
                        <li>• Personalized AI recommendations</li>
                        <li>• Granular permission controls</li>
                        <li>• Instant permission revocation</li>
                        <li>• Full transparency and control</li>
                    </ul>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-6">
                    <h3 className="font-semibold text-orange-400 mb-3">⚠️ Important Notes</h3>
                    <ul className="space-y-2 text-sm text-foreground/70">
                        <li>• This is a demo/testnet system only</li>
                        <li>• High risk pool uses simulated volatility</li>
                        <li>• Not audited - do not use in production</li>
                        <li>• Always maintain control of your keys</li>
                        <li>• Revoke permissions anytime</li>
                        <li>• Only risk what you can afford to lose</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
