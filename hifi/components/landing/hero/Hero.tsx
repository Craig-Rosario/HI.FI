'use client'
import { EncryptedText } from '@/components/ui/encrypted-text'
import { Highlighter } from '@/components/ui/highlighter'
import { LayoutTextFlip } from '@/components/ui/layout-text-flip'
import { LineShadowText } from '@/components/ui/line-shadow-text'
import { TextAnimate } from '@/components/ui/text-animate'
import Link from 'next/link'
import { motion } from "motion/react";
import { useMetaMask } from '@/hooks/use-metamask'

import { useEffect, useState } from "react";
import { Button } from '@/components/ui/button'


export default function Hero() {
    const [mounted, setMounted] = useState(false);
    const { 
        account, 
        isConnected, 
        isLoading, 
        user, 
        error, 
        connectWallet, 
        disconnectWallet 
    } = useMetaMask();

    useEffect(() => {
        setMounted(true);
    }, []);
    return (
        <section className="relative min-h-[90vh] bg-black text-white overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#111_0%,#000_65%)]" />

            <div className="relative max-w-7xl mx-auto px-8 py-32 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                <div>
                    {mounted && (
                        <EncryptedText
                            text="— POOLED FINANCE PLATFORM —"
                            encryptedClassName="text-neutral-500"
                            revealedClassName="text-pink-500 font-mono text-md tracking-[0.3em] mb-6"
                            revealDelayMs={30}
                        />
                    )}

                    <h1 className="text-6xl md:text-7xl font-extrabold leading-tight mb-7">
                        <LineShadowText className="bold" shadowColor="white">
                            Invest
                        </LineShadowText>{' '}
                        <br />
                        <LineShadowText className="bold" shadowColor="white">
                            Together,
                        </LineShadowText>{' '}
                        <br />
                        <div className="flex items-baseline gap-4">
                            <LineShadowText className="bold" shadowColor="white">
                                Earn
                            </LineShadowText>

                            <LayoutTextFlip
                                text=""
                                words={["More", "Better", "Safer", "Smarter"]}
                            />
                        </div>


                    </h1>

                    {mounted && (
                        <EncryptedText
                            text="Join a community of investors pooling capital for better opportunities.
                        Lower entry barriers, higher returns."
                            encryptedClassName="text-neutral-500"
                            revealedClassName="text-gray-400 text-lg max-w-xl mb-12"
                            revealDelayMs={10}
                        />
                    )}


                </div>

                <div className="relative">
                    <div className="absolute inset-0 blur-3xl bg-linear-to-r from-blue-600/40 via-pink-600/40 to-green-500/40" />

                    <div className="relative bg-[#0b0b0d] border border-gray-700 p-5 sm:p-8 overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.1)] rounded-xl">


                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 border-b border-gray-700 pb-6 mb-6">

                            <div>
                                <p className="text-gray-400 text-xs mb-2">TOTAL POOLED</p>
                                <p className="text-4xl font-bold">$2.4M</p>
                            </div>
                            <div className="flex gap-4 mt-5">
                                {!isConnected ? (
                                    <button
                                        onClick={connectWallet}
                                        disabled={isLoading}
                                        className="
    relative group
    bg-black text-white font-extrabold text-sm
    px-7 py-4 rounded-2xl
    border-2 border-white
    overflow-hidden
    shadow-[0_0_30px_rgba(255,255,255,0.25),6px_6px_0px_#fff]
    hover:shadow-[0_0_60px_rgba(255,255,255,0.6),3px_3px_0px_#fff]
    hover:translate-x-0.5 hover:translate-y-0.5
    active:translate-x-1.25 active:translate-y-1.25
    transition-all duration-200
    flex items-center gap-3 cursor-pointer
    disabled:opacity-50 disabled:cursor-not-allowed
  "
                                    >
                                        <span className="absolute inset-0 rounded-2xl bg-white/10 blur-xl opacity-0 group-hover:opacity-100 transition" />

                                        <span className="relative text-xl">
                                            {isLoading ? '⏳' : '🦊'}
                                        </span>
                                        <span className="relative tracking-wide">
                                            {isLoading ? 'CONNECTING...' : 'CONNECT WALLET'}
                                        </span>
                                    </button>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <div className="
    relative group
    bg-green-900 text-white font-extrabold text-sm
    px-7 py-4 rounded-2xl
    border-2 border-green-500
    overflow-hidden
    shadow-[0_0_30px_rgba(34,197,94,0.25),6px_6px_0px_#22c55e]
    flex items-center gap-3
  ">
                                            <span className="relative text-xl">✅</span>
                                            <div className="relative">
                                                <div className="tracking-wide">CONNECTED</div>
                                                {user && (
                                                    <div className="text-xs text-green-300">
                                                        {user.username} ({user.role})
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={disconnectWallet}
                                            className="text-xs text-gray-400 hover:text-white transition-colors"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                )}

                                {error && (
                                    <div className="absolute top-full mt-2 text-red-400 text-xs max-w-xs">
                                        {error}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-10">
                            <div className="border border-blue-500 bg-blue-500/10 p-6">
                                <p className="text-xs text-gray-400 mb-2">ACTIVE POOLS</p>
                                <p className="text-3xl font-bold">12</p>
                            </div>
                            <div className="border border-pink-500 bg-pink-500/10 p-6">
                                <p className="text-xs text-gray-400 mb-2">AVG RETURN</p>
                                <p className="text-3xl font-bold">24%</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 h-32">

                            <div className="relative border border-white/10 bg-black overflow-hidden">
                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="blue" x1="0" y1="1" x2="0" y2="0">
                                            <stop offset="0%" stopColor="#2563eb" />
                                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
                                        </linearGradient>
                                    </defs>
                                    <path fill="url(#blue)">
                                        <animate
                                            dur="4s"
                                            repeatCount="indefinite"
                                            attributeName="d"
                                            values="
                        M0,60 C40,55 80,65 120,60 160,55 200,60 200,60 L200,100 L0,100 Z;
                        M0,62 C40,65 80,55 120,62 160,68 200,60 200,60 L200,100 L0,100 Z;
                        M0,60 C40,55 80,65 120,60 160,55 200,60 200,60 L200,100 L0,100 Z"
                                        />
                                    </path>
                                </svg>
                            </div>

                            <div className="relative border border-white/10 bg-black overflow-hidden">
                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="pink" x1="0" y1="1" x2="0" y2="0">
                                            <stop offset="0%" stopColor="#db2777" />
                                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
                                        </linearGradient>
                                    </defs>
                                    <path fill="url(#pink)">
                                        <animate
                                            dur="2.5s"
                                            repeatCount="indefinite"
                                            attributeName="d"
                                            values="
                        M0,20 C40,15 80,25 120,18 160,10 200,20 200,20 L200,100 L0,100 Z;
                        M0,22 C40,30 80,15 120,25 160,35 200,20 200,20 L200,100 L0,100 Z;
                        M0,20 C40,15 80,25 120,18 160,10 200,20 200,20 L200,100 L0,100 Z"
                                        />
                                    </path>
                                </svg>
                            </div>

                            <div className="relative border border-white/10 bg-black overflow-hidden">
                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="green" x1="0" y1="1" x2="0" y2="0">
                                            <stop offset="0%" stopColor="#16a34a" />
                                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
                                        </linearGradient>
                                    </defs>
                                    <path fill="url(#green)">
                                        <animate
                                            dur="7s"
                                            repeatCount="indefinite"
                                            attributeName="d"
                                            values="
                        M0,80 C40,78 80,82 120,80 160,78 200,80 200,80 L200,100 L0,100 Z;
                        M0,82 C40,85 80,78 120,84 160,88 200,80 200,80 L200,100 L0,100 Z;
                        M0,80 C40,78 80,82 120,80 160,78 200,80 200,80 L200,100 L0,100 Z"
                                        />
                                    </path>
                                </svg>
                            </div>

                        </div>

                    </div>
                </div>

            </div>
        </section>
    )
}
