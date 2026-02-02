'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronRight, TrendingUp } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface RiskProfileData {
    ageRange: string;
    incomeRange: string;
    investmentHorizon: string;
    riskTolerance: string;
    liquidityNeeds: string;
    investmentGoals: string[];
    previousDeFiExperience: string;
}

export default function RiskProfilePage() {
    const router = useRouter();
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [profileData, setProfileData] = useState<RiskProfileData>({
        ageRange: '',
        incomeRange: '',
        investmentHorizon: '',
        riskTolerance: '',
        liquidityNeeds: '',
        investmentGoals: [],
        previousDeFiExperience: ''
    });

    const updateProfile = (field: keyof RiskProfileData, value: any) => {
        setProfileData(prev => ({ ...prev, [field]: value }));
    };

    const toggleGoal = (goal: string) => {
        setProfileData(prev => ({
            ...prev,
            investmentGoals: prev.investmentGoals.includes(goal)
                ? prev.investmentGoals.filter(g => g !== goal)
                : [...prev.investmentGoals, goal]
        }));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Get user ID from auth context
            if (!user?._id) {
                alert('User not authenticated. Please log in again.');
                router.push('/');
                return;
            }

            const response = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user._id, riskProfile: profileData })
            });

            const data = await response.json();

            if (data.success) {
                // Redirect to recommendations page
                router.push('/user/recommendations');
            } else {
                alert(data.error || 'Failed to save profile');
            }
        } catch (error) {
            console.error('Submit error:', error);
            alert('Failed to save profile. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isStepComplete = () => {
        switch (step) {
            case 1: return profileData.ageRange && profileData.incomeRange;
            case 2: return profileData.investmentHorizon && profileData.liquidityNeeds;
            case 3: return profileData.riskTolerance;
            case 4: return profileData.investmentGoals.length > 0;
            case 5: return profileData.previousDeFiExperience;
            default: return false;
        }
    };

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Risk Profile Assessment</h1>
                    <p className="text-foreground/70">
                        Help us understand your investment preferences to provide personalized pool recommendations.
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Step {step} of 5</span>
                        <span className="text-sm text-foreground/70">{Math.round((step / 5) * 100)}% Complete</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${(step / 5) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Step Content */}
                <div className="bg-card border border-border rounded-lg p-8 mb-6">
                    {step === 1 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Personal Information</h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium mb-3">Age Range</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {['under-25', '25-40', '41-55', '56-70', 'over-70'].map(age => (
                                            <button
                                                key={age}
                                                onClick={() => updateProfile('ageRange', age)}
                                                className={`p-4 border-2 rounded-lg transition ${profileData.ageRange === age
                                                    ? 'border-blue-500 bg-blue-500/10'
                                                    : 'border-gray-700 hover:border-gray-600'
                                                    }`}
                                            >
                                                {age}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-3">Annual Income Range</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {[
                                            { value: 'under-30k', label: '< $30K' },
                                            { value: '30k-75k', label: '$30K - $75K' },
                                            { value: '75k-150k', label: '$75K - $150K' },
                                            { value: '150k-300k', label: '$150K - $300K' },
                                            { value: 'over-300k', label: '> $300K' }
                                        ].map(income => (
                                            <button
                                                key={income.value}
                                                onClick={() => updateProfile('incomeRange', income.value)}
                                                className={`p-4 border-2 rounded-lg transition ${profileData.incomeRange === income.value
                                                    ? 'border-blue-500 bg-blue-500/10'
                                                    : 'border-gray-700 hover:border-gray-600'
                                                    }`}
                                            >
                                                {income.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Investment Timeline</h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium mb-3">Investment Horizon</label>
                                    <p className="text-sm text-foreground/60 mb-4">How long do you plan to keep funds invested?</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {[
                                            { value: '1-month', label: '1 Month' },
                                            { value: '3-months', label: '3 Months' },
                                            { value: '6-months', label: '6 Months' },
                                            { value: '1-year', label: '1 Year' },
                                            { value: '2-years+', label: '2+ Years' }
                                        ].map(horizon => (
                                            <button
                                                key={horizon.value}
                                                onClick={() => updateProfile('investmentHorizon', horizon.value)}
                                                className={`p-4 border-2 rounded-lg transition ${profileData.investmentHorizon === horizon.value
                                                    ? 'border-blue-500 bg-blue-500/10'
                                                    : 'border-gray-700 hover:border-gray-600'
                                                    }`}
                                            >
                                                {horizon.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-3">Liquidity Needs</label>
                                    <p className="text-sm text-foreground/60 mb-4">How quickly might you need access to funds?</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { value: 'immediate', label: 'Immediate', desc: 'May need funds anytime' },
                                            { value: 'short-term', label: 'Short-term', desc: '1-3 months' },
                                            { value: 'medium-term', label: 'Medium-term', desc: '3-12 months' },
                                            { value: 'long-term', label: 'Long-term', desc: '1+ years' }
                                        ].map(need => (
                                            <button
                                                key={need.value}
                                                onClick={() => updateProfile('liquidityNeeds', need.value)}
                                                className={`p-4 border-2 rounded-lg transition text-left ${profileData.liquidityNeeds === need.value
                                                    ? 'border-blue-500 bg-blue-500/10'
                                                    : 'border-gray-700 hover:border-gray-600'
                                                    }`}
                                            >
                                                <div className="font-medium">{need.label}</div>
                                                <div className="text-sm text-foreground/60">{need.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Risk Tolerance</h2>
                            <p className="text-foreground/70 mb-6">
                                How comfortable are you with potential short-term losses for long-term gains?
                            </p>

                            <div className="space-y-3">
                                {[
                                    {
                                        value: 'conservative',
                                        label: 'Conservative',
                                        desc: 'Prefer stability over high returns. Minimal risk of loss.',
                                        color: 'green'
                                    },
                                    {
                                        value: 'moderate',
                                        label: 'Moderate',
                                        desc: 'Balance between safety and growth. Some risk acceptable.',
                                        color: 'blue'
                                    },
                                    {
                                        value: 'balanced',
                                        label: 'Balanced',
                                        desc: 'Equal weight to safety and returns. Moderate risk tolerance.',
                                        color: 'purple'
                                    },
                                    {
                                        value: 'growth',
                                        label: 'Growth',
                                        desc: 'Prioritize returns over stability. Higher risk acceptable.',
                                        color: 'orange'
                                    },
                                    {
                                        value: 'aggressive',
                                        label: 'Aggressive',
                                        desc: 'Maximize returns. Comfortable with high volatility.',
                                        color: 'red'
                                    }
                                ].map(tolerance => (
                                    <button
                                        key={tolerance.value}
                                        onClick={() => updateProfile('riskTolerance', tolerance.value)}
                                        className={`w-full p-5 border-2 rounded-lg transition text-left ${profileData.riskTolerance === tolerance.value
                                            ? `border-${tolerance.color}-500 bg-${tolerance.color}-500/10`
                                            : 'border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-lg mb-1">{tolerance.label}</div>
                                                <div className="text-sm text-foreground/60">{tolerance.desc}</div>
                                            </div>
                                            {profileData.riskTolerance === tolerance.value && (
                                                <TrendingUp className={`text-${tolerance.color}-500`} size={24} />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Investment Goals</h2>
                            <p className="text-foreground/70 mb-6">
                                Select all that apply (multiple selections allowed)
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    {
                                        value: 'capital-preservation',
                                        label: 'Capital Preservation',
                                        desc: 'Protect principal investment',
                                        icon: '🛡️'
                                    },
                                    {
                                        value: 'income',
                                        label: 'Income Generation',
                                        desc: 'Regular yield from fees',
                                        icon: '💰'
                                    },
                                    {
                                        value: 'growth',
                                        label: 'Capital Growth',
                                        desc: 'Long-term appreciation',
                                        icon: '📈'
                                    },
                                    {
                                        value: 'speculation',
                                        label: 'Speculation',
                                        desc: 'High-risk, high-reward',
                                        icon: '🎲'
                                    }
                                ].map(goal => (
                                    <button
                                        key={goal.value}
                                        onClick={() => toggleGoal(goal.value)}
                                        className={`p-6 border-2 rounded-lg transition text-left ${profileData.investmentGoals.includes(goal.value)
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="text-3xl mb-3">{goal.icon}</div>
                                        <div className="font-bold text-lg mb-1">{goal.label}</div>
                                        <div className="text-sm text-foreground/60">{goal.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-6">DeFi Experience</h2>
                            <p className="text-foreground/70 mb-6">
                                How familiar are you with DeFi protocols and liquidity provision?
                            </p>

                            <div className="space-y-3">
                                {[
                                    {
                                        value: 'none',
                                        label: 'No Experience',
                                        desc: 'New to DeFi and crypto investing'
                                    },
                                    {
                                        value: 'beginner',
                                        label: 'Beginner',
                                        desc: 'Some exposure, still learning basics'
                                    },
                                    {
                                        value: 'intermediate',
                                        label: 'Intermediate',
                                        desc: 'Comfortable with DeFi concepts and protocols'
                                    },
                                    {
                                        value: 'advanced',
                                        label: 'Advanced',
                                        desc: 'Experienced LP, understand IL and strategies'
                                    }
                                ].map(exp => (
                                    <button
                                        key={exp.value}
                                        onClick={() => updateProfile('previousDeFiExperience', exp.value)}
                                        className={`w-full p-5 border-2 rounded-lg transition text-left ${profileData.previousDeFiExperience === exp.value
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="font-bold text-lg mb-1">{exp.label}</div>
                                        <div className="text-sm text-foreground/60">{exp.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between">
                    <Button
                        onClick={() => setStep(s => Math.max(1, s - 1))}
                        variant="outline"
                        disabled={step === 1}
                    >
                        Back
                    </Button>

                    {step < 5 ? (
                        <Button
                            onClick={() => setStep(s => s + 1)}
                            disabled={!isStepComplete()}
                        >
                            Next <ChevronRight size={18} className="ml-1" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            disabled={!isStepComplete() || isSubmitting}
                        >
                            {isSubmitting ? 'Generating Recommendations...' : 'Complete & View Recommendations'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
