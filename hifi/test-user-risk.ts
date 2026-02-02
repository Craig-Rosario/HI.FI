/**
 * Test User Risk Score Calculation
 */

import { calculateUserRiskScore } from './lib/recommendations/userRiskScoring';
import { UserProfile } from './lib/types/recommendations';

const testProfiles: Partial<UserProfile>[] = [
    {
        ageRange: 'over-70',
        incomeRange: 'under-30k',
        investmentHorizon: '1-month',
        riskTolerance: 'conservative',
        liquidityNeeds: 'immediate',
        investmentGoals: ['capital-preservation'],
        previousDeFiExperience: 'none'
    },
    {
        ageRange: '25-40',
        incomeRange: '75k-150k',
        investmentHorizon: '1-year',
        riskTolerance: 'conservative',
        liquidityNeeds: 'medium-term',
        investmentGoals: ['capital-preservation'],
        previousDeFiExperience: 'beginner'
    },
    {
        ageRange: '25-40',
        incomeRange: '75k-150k',
        investmentHorizon: '1-year',
        riskTolerance: 'moderate',
        liquidityNeeds: 'medium-term',
        investmentGoals: ['income'],
        previousDeFiExperience: 'intermediate'
    },
    {
        ageRange: 'under-25',
        incomeRange: 'over-300k',
        investmentHorizon: '2-years+',
        riskTolerance: 'aggressive',
        liquidityNeeds: 'long-term',
        investmentGoals: ['growth'],
        previousDeFiExperience: 'advanced'
    }
];

console.log('👤 User Risk Score Examples:\n');
console.log('='.repeat(80));

testProfiles.forEach((profile, i) => {
    const userProfile = {
        ...profile,
        userId: `test-${i}`,
        walletAddress: '0x123',
        profileCreatedAt: new Date(),
        lastUpdated: new Date(),
        completionStatus: 'complete' as const
    } as UserProfile;

    const score = calculateUserRiskScore(userProfile);

    console.log(`\nProfile ${i + 1}:`);
    console.log(`  Age: ${profile.ageRange}`);
    console.log(`  Risk Tolerance: ${profile.riskTolerance}`);
    console.log(`  Horizon: ${profile.investmentHorizon}`);
    console.log(`  Experience: ${profile.previousDeFiExperience}`);
    console.log(`  🎯 User Risk Score: ${score}/100`);
    console.log(`  Can see pools with risk ≤ ${score}`);
});

console.log('\n' + '='.repeat(80));
console.log('Pool Risk: 14');
console.log('Users with score ≥15 will see the USDC pools');
