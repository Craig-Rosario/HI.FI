'use client';

import { useState } from 'react';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

interface RiskQuestionnaireProps {
    onComplete: (riskLevel: RiskLevel) => void;
    onClose?: () => void;
    currentRisk?: RiskLevel;
}

const riskOptions = [
    {
        level: 'LOW' as RiskLevel,
        title: 'Conservative',
        description: 'Preserve capital with minimal volatility',
        v4Exposure: '0%',
        expectedApy: '2-4%',
        color: 'from-green-500 to-emerald-600',
        icon: '🛡️',
        features: [
            'No Uniswap v4 exposure',
            'Funds stay in vault',
            'Lowest risk, stable returns',
        ],
    },
    {
        level: 'MEDIUM' as RiskLevel,
        title: 'Balanced',
        description: 'Moderate growth with managed risk',
        v4Exposure: '30%',
        expectedApy: '5-10%',
        color: 'from-blue-500 to-indigo-600',
        icon: '⚖️',
        features: [
            'Up to 30% in Uniswap v4 LP',
            'USDC/ETH liquidity pool',
            'Balanced risk-reward ratio',
        ],
    },
    {
        level: 'HIGH' as RiskLevel,
        title: 'Aggressive',
        description: 'Maximum growth potential',
        v4Exposure: '70%',
        expectedApy: '10-20%',
        color: 'from-purple-500 to-pink-600',
        icon: '🚀',
        features: [
            'Up to 70% in Uniswap v4 LP',
            'Higher yield potential',
            'Higher volatility exposure',
        ],
    },
];

export default function RiskQuestionnaire({
    onComplete,
    onClose,
    currentRisk,
}: RiskQuestionnaireProps) {
    const [selectedRisk, setSelectedRisk] = useState<RiskLevel | null>(currentRisk || null);
    const [step, setStep] = useState(0);

    const questions = [
        {
            question: 'What is your primary investment goal?',
            options: [
                { text: 'Preserve my capital with minimal risk', risk: 'LOW' },
                { text: 'Grow my wealth with moderate risk', risk: 'MEDIUM' },
                { text: 'Maximize returns, I can handle volatility', risk: 'HIGH' },
            ],
        },
        {
            question: 'How would you react to a 10% drop in your portfolio?',
            options: [
                { text: 'I would withdraw immediately', risk: 'LOW' },
                { text: 'I would wait and see', risk: 'MEDIUM' },
                { text: 'I would invest more at lower prices', risk: 'HIGH' },
            ],
        },
        {
            question: 'What is your investment horizon?',
            options: [
                { text: 'Less than 1 month', risk: 'LOW' },
                { text: '1-6 months', risk: 'MEDIUM' },
                { text: '6+ months', risk: 'HIGH' },
            ],
        },
    ];

    const [answers, setAnswers] = useState<string[]>([]);

    const handleAnswer = (risk: string) => {
        const newAnswers = [...answers, risk];
        setAnswers(newAnswers);

        if (step < questions.length - 1) {
            setStep(step + 1);
        } else {
            // Calculate risk based on answers
            const riskCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
            newAnswers.forEach((r) => {
                riskCounts[r as RiskLevel]++;
            });

            let recommendedRisk: RiskLevel = 'MEDIUM';
            if (riskCounts.LOW >= 2) recommendedRisk = 'LOW';
            else if (riskCounts.HIGH >= 2) recommendedRisk = 'HIGH';

            setSelectedRisk(recommendedRisk);
            setStep(questions.length); // Move to selection screen
        }
    };

    const handleConfirm = () => {
        if (selectedRisk) {
            // Save to localStorage
            localStorage.setItem('hifi_risk_level', selectedRisk);
            onComplete(selectedRisk);
        }
    };

    // Questionnaire step
    if (step < questions.length) {
        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-gray-900 rounded-2xl max-w-lg w-full p-8 border border-gray-800">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Risk Assessment</h2>
                        <div className="text-sm text-gray-400">
                            {step + 1} / {questions.length}
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                                style={{ width: `${((step + 1) / questions.length) * 100}%` }}
                            />
                        </div>
                    </div>

                    <h3 className="text-2xl font-semibold text-white mb-6">
                        {questions[step].question}
                    </h3>

                    <div className="space-y-3">
                        {questions[step].options.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => handleAnswer(option.risk)}
                                className="w-full p-4 text-left bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 rounded-xl transition-all duration-200"
                            >
                                <span className="text-white">{option.text}</span>
                            </button>
                        ))}
                    </div>

                    {onClose && (
                        <button
                            onClick={onClose}
                            className="mt-6 text-gray-400 hover:text-white transition-colors"
                        >
                            Skip for now
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Selection screen
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl max-w-4xl w-full p-8 border border-gray-800">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Select Your Risk Profile</h2>
                        <p className="text-gray-400 mt-1">
                            {selectedRisk && `Recommended: ${selectedRisk}`}
                        </p>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white text-2xl"
                        >
                            ×
                        </button>
                    )}
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-8">
                    {riskOptions.map((option) => (
                        <button
                            key={option.level}
                            onClick={() => setSelectedRisk(option.level)}
                            className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${selectedRisk === option.level
                                    ? 'border-blue-500 bg-blue-500/10'
                                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                }`}
                        >
                            <div className="text-4xl mb-3">{option.icon}</div>
                            <h3 className="text-xl font-bold text-white mb-1">{option.title}</h3>
                            <p className="text-gray-400 text-sm mb-4">{option.description}</p>

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">V4 Exposure</span>
                                    <span className="text-white font-semibold">{option.v4Exposure}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Expected APY</span>
                                    <span className="text-green-400 font-semibold">{option.expectedApy}</span>
                                </div>
                            </div>

                            <ul className="space-y-1">
                                {option.features.map((feature, index) => (
                                    <li key={index} className="text-xs text-gray-400 flex items-center gap-2">
                                        <span className="text-green-500">✓</span>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </button>
                    ))}
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => {
                            setStep(0);
                            setAnswers([]);
                        }}
                        className="px-6 py-3 border border-gray-700 text-gray-300 rounded-xl hover:bg-gray-800 transition-colors"
                    >
                        Retake Quiz
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedRisk}
                        className={`flex-1 py-3 rounded-xl font-semibold transition-all duration-200 ${selectedRisk
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90'
                                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        Confirm {selectedRisk} Risk Profile
                    </button>
                </div>

                <p className="text-center text-gray-500 text-xs mt-4">
                    Your risk preference is stored locally and enforced by the onchain agent.
                </p>
            </div>
        </div>
    );
}
