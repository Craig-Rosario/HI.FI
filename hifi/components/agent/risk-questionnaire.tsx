'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMetaMask } from '@/hooks/use-metamask';

interface QuestionnaireData {
    investmentAmount: string;
    riskTolerance: 'low' | 'medium' | 'high';
    investmentDuration: string;
    investmentGoal: 'preservation' | 'income' | 'growth' | 'aggressive';
    liquidityNeeds: 'high' | 'medium' | 'low';
    experienceLevel: 'beginner' | 'intermediate' | 'advanced';
    marketConditionView: 'bullish' | 'neutral' | 'bearish';
}

interface RiskQuestionnaireProps {
    onComplete: (data: QuestionnaireData, recommendation: any) => void;
    onSkip?: () => void;
}

export default function RiskQuestionnaire({ onComplete, onSkip }: RiskQuestionnaireProps) {
    const { account } = useMetaMask();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<QuestionnaireData>({
        investmentAmount: '',
        riskTolerance: 'medium',
        investmentDuration: '30',
        investmentGoal: 'growth',
        liquidityNeeds: 'medium',
        experienceLevel: 'intermediate',
        marketConditionView: 'neutral',
    });

    const totalSteps = 7;

    const handleSubmit = async () => {
        if (!account) return;

        setLoading(true);
        try {
            const response = await fetch('/api/agent/questionnaire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: account,
                }),
            });

            const result = await response.json();

            if (result.success) {
                onComplete(formData, result.recommendation);
            }
        } catch (error) {
            console.error('Error submitting questionnaire:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateField = <K extends keyof QuestionnaireData>(
        field: K,
        value: QuestionnaireData[K]
    ) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Investment Amount</h3>
                            <p className="text-gray-400 mb-4">
                                How much USDC are you planning to invest?
                            </p>
                            <Input
                                type="number"
                                placeholder="e.g., 100"
                                value={formData.investmentAmount}
                                onChange={(e) => updateField('investmentAmount', e.target.value)}
                                className="max-w-md"
                            />
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Risk Tolerance</h3>
                            <p className="text-gray-400 mb-4">
                                How much risk are you comfortable taking?
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(['low', 'medium', 'high'] as const).map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => updateField('riskTolerance', level)}
                                        className={`p-6 rounded-lg border-2 transition-all ${formData.riskTolerance === level
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="text-lg font-semibold capitalize mb-2">
                                            {level} Risk
                                        </div>
                                        <p className="text-sm text-gray-400">
                                            {level === 'low' && 'Preserve capital, stable returns'}
                                            {level === 'medium' && 'Balanced growth with moderate volatility'}
                                            {level === 'high' && 'Maximum returns, accept high volatility'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Investment Duration</h3>
                            <p className="text-gray-400 mb-4">
                                How long do you plan to keep funds invested? (in days)
                            </p>
                            <Input
                                type="number"
                                placeholder="e.g., 30"
                                value={formData.investmentDuration}
                                onChange={(e) => updateField('investmentDuration', e.target.value)}
                                className="max-w-md"
                            />
                            <div className="mt-4 grid grid-cols-4 gap-2">
                                {['7', '14', '30', '90'].map((days) => (
                                    <Button
                                        key={days}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => updateField('investmentDuration', days)}
                                    >
                                        {days} days
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Investment Goal</h3>
                            <p className="text-gray-400 mb-4">
                                What is your primary investment objective?
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {([
                                    { value: 'preservation', label: 'Capital Preservation', desc: 'Protect principal above all' },
                                    { value: 'income', label: 'Steady Income', desc: 'Consistent, predictable returns' },
                                    { value: 'growth', label: 'Growth', desc: 'Build wealth over time' },
                                    { value: 'aggressive', label: 'Aggressive Growth', desc: 'Maximum returns, high risk' },
                                ] as const).map((goal) => (
                                    <button
                                        key={goal.value}
                                        onClick={() => updateField('investmentGoal', goal.value)}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${formData.investmentGoal === goal.value
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="font-semibold mb-1">{goal.label}</div>
                                        <p className="text-sm text-gray-400">{goal.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 5:
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Liquidity Needs</h3>
                            <p className="text-gray-400 mb-4">
                                How quickly do you need access to your funds?
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(['high', 'medium', 'low'] as const).map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => updateField('liquidityNeeds', level)}
                                        className={`p-6 rounded-lg border-2 transition-all ${formData.liquidityNeeds === level
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="text-lg font-semibold capitalize mb-2">
                                            {level} Liquidity
                                        </div>
                                        <p className="text-sm text-gray-400">
                                            {level === 'high' && 'Need access within days'}
                                            {level === 'medium' && 'Can wait 1-2 weeks'}
                                            {level === 'low' && 'Can lock funds for months'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 6:
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Experience Level</h3>
                            <p className="text-gray-400 mb-4">
                                How familiar are you with DeFi investing?
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => updateField('experienceLevel', level)}
                                        className={`p-6 rounded-lg border-2 transition-all ${formData.experienceLevel === level
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="text-lg font-semibold capitalize mb-2">
                                            {level}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 7:
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Market Outlook</h3>
                            <p className="text-gray-400 mb-4">
                                What's your view on current market conditions?
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(['bullish', 'neutral', 'bearish'] as const).map((view) => (
                                    <button
                                        key={view}
                                        onClick={() => updateField('marketConditionView', view)}
                                        className={`p-6 rounded-lg border-2 transition-all ${formData.marketConditionView === view
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="text-lg font-semibold capitalize mb-2">
                                            {view === 'bullish' && '📈 Bullish'}
                                            {view === 'neutral' && '➡️ Neutral'}
                                            {view === 'bearish' && '📉 Bearish'}
                                        </div>
                                        <p className="text-sm text-gray-400">
                                            {view === 'bullish' && 'Markets will go up'}
                                            {view === 'neutral' && 'Uncertain direction'}
                                            {view === 'bearish' && 'Markets will decline'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Risk Assessment</h2>
                <p className="text-gray-400">
                    Help our AI agent understand your investment profile
                </p>
            </div>

            {/* Progress bar */}
            <div className="mb-8">
                <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-400">
                        Step {step} of {totalSteps}
                    </span>
                    <span className="text-sm text-gray-400">
                        {Math.round((step / totalSteps) * 100)}%
                    </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${(step / totalSteps) * 100}%` }}
                    />
                </div>
            </div>

            {/* Question */}
            <div className="mb-8">{renderStep()}</div>

            {/* Navigation */}
            <div className="flex justify-between">
                <div>
                    {step > 1 && (
                        <Button variant="outline" onClick={() => setStep(step - 1)}>
                            ← Previous
                        </Button>
                    )}
                </div>
                <div className="flex gap-2">
                    {onSkip && (
                        <Button variant="ghost" onClick={onSkip}>
                            Skip for now
                        </Button>
                    )}
                    {step < totalSteps ? (
                        <Button onClick={() => setStep(step + 1)}>Next →</Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Analyzing...' : 'Complete Assessment'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
