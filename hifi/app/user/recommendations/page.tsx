'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { TrendingUp, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default function RecommendationsPage() {
    const { user } = useAuth();
    const [recommendations, setRecommendations] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedPool, setExpandedPool] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchRecommendations();
        }
    }, [user]);

    const fetchRecommendations = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/recommendations/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?._id })
            });

            const data = await response.json();

            if (data.success) {
                setRecommendations(data.recommendations);
            } else {
                setError(data.error || 'Failed to load recommendations');
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Failed to load recommendations. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getRiskLevelColor = (level: string) => {
        switch (level) {
            case 'ULTRA_LOW': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'LOW': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'HIGH': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            case 'VERY_HIGH': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
        }
    };

    if (loading) {
        return (
            <div className="p-6 md:p-8">
                <div className="flex items-center justify-center h-96">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-foreground/70">Generating personalized recommendations...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 md:p-8">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-8 text-center">
                    <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
                    <h2 className="text-xl font-bold mb-2">Error Loading Recommendations</h2>
                    <p className="text-foreground/70 mb-4">{error}</p>
                    {error.includes('profile incomplete') ? (
                        <Link href="/user/risk-profile">
                            <Button>Complete Risk Profile</Button>
                        </Link>
                    ) : (
                        <Button onClick={fetchRecommendations}>Try Again</Button>
                    )}
                </div>
            </div>
        );
    }

    if (!recommendations) {
        return null;
    }

    return (
        <div className="p-6 md:p-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold mb-2">Your Personalized Recommendations</h1>
                <p className="text-foreground/70">
                    Based on your risk profile, we've identified {recommendations.recommendations.length} suitable pools.
                </p>
            </div>

            {/* Risk Score Summary */}
            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold mb-1">Your Risk Score</h3>
                        <p className="text-sm text-foreground/60">
                            Based on your {recommendations.userProfile.riskTolerance} risk tolerance
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-bold text-blue-400">{recommendations.userRiskScore}</div>
                        <div className="text-sm text-foreground/60">out of 100</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
                    <div>
                        <div className="text-sm text-foreground/60 mb-1">Pools Evaluated</div>
                        <div className="text-xl font-semibold">{recommendations.totalPoolsEvaluated}</div>
                    </div>
                    <div>
                        <div className="text-sm text-foreground/60 mb-1">Matched</div>
                        <div className="text-xl font-semibold">{recommendations.totalPoolsMatched}</div>
                    </div>
                    <div>
                        <div className="text-sm text-foreground/60 mb-1">Recommended</div>
                        <div className="text-xl font-semibold">{recommendations.recommendations.length}</div>
                    </div>
                    <div>
                        <div className="text-sm text-foreground/60 mb-1">Algorithm</div>
                        <div className="text-xl font-semibold">v{recommendations.algorithmVersion}</div>
                    </div>
                </div>
            </div>

            {/* Recommendations List */}
            <div className="space-y-4">
                <h2 className="text-2xl font-bold">Recommended Pools</h2>

                {recommendations.recommendations.map((rec: any, index: number) => {
                    const isExpanded = expandedPool === rec.pool.poolAddress;

                    return (
                        <div
                            key={rec.pool.poolAddress}
                            className="bg-card border border-border rounded-lg overflow-hidden hover:border-blue-500/50 transition"
                        >
                            {/* Pool Header */}
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-2xl font-bold text-blue-400">#{index + 1}</span>
                                            <h3 className="text-2xl font-bold">{rec.explanation.poolName}</h3>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskLevelColor(rec.explanation.riskLevel)}`}>
                                                {rec.explanation.riskLevel.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-foreground/60 mb-3">{rec.explanation.matchReason}</p>
                                        <p className="text-sm text-foreground/60 font-mono">
                                            {rec.explanation.poolAddress.slice(0, 10)}...{rec.explanation.poolAddress.slice(-8)}
                                        </p>
                                    </div>
                                </div>

                                {/* Key Metrics */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <div className="text-sm text-foreground/60 mb-1">APY (30d)</div>
                                        <div className="text-xl font-bold text-green-400">{rec.explanation.metrics.apy30d.toFixed(2)}%</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-foreground/60 mb-1">TVL</div>
                                        <div className="text-xl font-bold">${(rec.explanation.metrics.tvl / 1000000).toFixed(2)}M</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-foreground/60 mb-1">Pool Risk</div>
                                        <div className="text-xl font-bold">{rec.explanation.riskScore}/100</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-foreground/60 mb-1">Fee Tier</div>
                                        <div className="text-xl font-bold">{rec.explanation.metrics.feeTier} bps</div>
                                    </div>
                                </div>

                                {/* Expand Button */}
                                <button
                                    onClick={() => setExpandedPool(isExpanded ? null : rec.pool.poolAddress)}
                                    className="mt-4 flex items-center gap-2 text-blue-400 hover:text-blue-300 transition"
                                >
                                    {isExpanded ? (
                                        <>
                                            <ChevronUp size={18} />
                                            <span>Hide Details</span>
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown size={18} />
                                            <span>View Detailed Analysis</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="border-t border-border p-6 bg-background/50 space-y-6">
                                    {/* Risk Breakdown */}
                                    <div>
                                        <h4 className="font-semibold text-lg mb-3">Risk Breakdown</h4>
                                        <div className="space-y-3">
                                            {Object.entries(rec.explanation.riskBreakdown).map(([key, value]: [string, any]) => (
                                                <div key={key} className="bg-card border border-border rounded-lg p-4">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                        <span className="text-blue-400 font-semibold">{value.score.toFixed(1)}/100</span>
                                                    </div>
                                                    <p className="text-sm text-foreground/70">{value.explanation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Warnings */}
                                    {rec.explanation.warnings.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold text-lg mb-3 text-orange-400">⚠️ Warnings</h4>
                                            <div className="space-y-2">
                                                {rec.explanation.warnings.map((warning: string, i: number) => (
                                                    <div key={i} className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                                                        <p className="text-sm">{warning}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Considerations */}
                                    <div>
                                        <h4 className="font-semibold text-lg mb-3">✓ Considerations</h4>
                                        <div className="space-y-2">
                                            {rec.explanation.considerations.map((consideration: string, i: number) => (
                                                <div key={i} className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                                    <p className="text-sm">{consideration}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3">
                                        <Button className="flex-1">
                                            Invest in This Pool
                                        </Button>
                                        <Button variant="outline">
                                            View on Explorer <ExternalLink size={16} className="ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Disclaimers */}
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-3 text-orange-400">⚠️ Important Disclaimers</h3>
                <ul className="space-y-2 text-sm text-foreground/70">
                    {recommendations.disclaimers.map((disclaimer: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                            <span className="text-orange-400 mt-0.5">•</span>
                            <span>{disclaimer}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
                <Link href="/user/risk-profile">
                    <Button variant="outline">Update Risk Profile</Button>
                </Link>
                <Button onClick={fetchRecommendations}>Refresh Recommendations</Button>
            </div>
        </div>
    );
}
