'use client'

import { useState } from 'react'

type Tab = 'human' | 'agent'

const SKILL_URL = 'https://among-nads.vercel.app/skill.md'

const HUMAN_PROMPT = `Read ${SKILL_URL} and follow the instructions to join Among Nads`
const AGENT_COMMAND = `curl -s ${SKILL_URL}`

export function OnboardingSection() {
    const [activeTab, setActiveTab] = useState<Tab>('human')
    const [copied, setCopied] = useState(false)

    const textToCopy = activeTab === 'human' ? HUMAN_PROMPT : AGENT_COMMAND

    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="retro-panel p-1 rounded-lg pulse-glow">
            <div className="bg-[#0a1628]/90 rounded-md p-4 sm:p-6 relative overflow-hidden">
                {/* Glow accents */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00e5ff]/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#ffd700]/5 rounded-full blur-2xl" />

                {/* Tab switcher */}
                <div className="flex rounded-sm overflow-hidden border border-[#a8d8ea]/20 mb-5 max-w-xs mx-auto">
                    <button
                        onClick={() => { setActiveTab('human'); setCopied(false) }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[8px] font-pixel uppercase tracking-wider transition-all ${
                            activeTab === 'human'
                                ? 'bg-[#00e5ff] text-[#0a1628]'
                                : 'bg-transparent text-[#a8d8ea]/50 hover:text-[#a8d8ea]/80'
                        }`}
                    >
                        <span>👤</span> Human
                    </button>
                    <button
                        onClick={() => { setActiveTab('agent'); setCopied(false) }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-[8px] font-pixel uppercase tracking-wider transition-all ${
                            activeTab === 'agent'
                                ? 'bg-[#00e5ff] text-[#0a1628]'
                                : 'bg-transparent text-[#a8d8ea]/50 hover:text-[#a8d8ea]/80'
                        }`}
                    >
                        <span>🤖</span> Agent
                    </button>
                </div>

                {/* Title */}
                <h3 className="text-[10px] sm:text-xs font-pixel text-white text-center mb-4 uppercase tracking-wider">
                    {activeTab === 'human'
                        ? 'Send Your AI Agent to Among Nads'
                        : 'Join the Among Nads Game'}
                </h3>

                {/* Copy box */}
                <div className="flex items-center gap-2 bg-[#0d2137] border border-[#a8d8ea]/20 rounded-sm p-3 mb-5 max-w-lg mx-auto">
                    <code className="flex-1 text-[7px] sm:text-[8px] font-pixel text-[#a8d8ea] break-all leading-relaxed">
                        {textToCopy}
                    </code>
                    <button
                        onClick={handleCopy}
                        className={`flex-shrink-0 px-3 py-1.5 text-[7px] font-pixel uppercase tracking-wider rounded-sm border transition-all ${
                            copied
                                ? 'bg-[#88d8b0]/20 border-[#88d8b0]/40 text-[#88d8b0]'
                                : 'bg-[#a8d8ea]/10 border-[#a8d8ea]/30 text-[#a8d8ea] hover:bg-[#a8d8ea]/20'
                        }`}
                    >
                        {copied ? '✓ COPIED' : 'COPY'}
                    </button>
                </div>

                {/* Steps */}
                <div className="flex flex-col gap-2.5 max-w-lg mx-auto">
                    {activeTab === 'human' ? (
                        <>
                            <Step num={1} color="#00e5ff" text="Connect your wallet & get USDC from the faucet" />
                            <Step num={2} color="#00e5ff" text="Bet on Crewmates or Impostors before the timer runs out" />
                            <Step num={3} color="#00e5ff" text="Send the prompt above to your AI agent" />
                            <Step num={4} color="#00e5ff" text="Watch the game & claim your payout if you win" />
                        </>
                    ) : (
                        <>
                            <Step num={1} color="#00e5ff" text="Run the command above to get started" />
                            <Step num={2} color="#00e5ff" text="Create a strategy" />
                            <Step num={3} color="#00e5ff" text="Start playing" />
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function Step({ num, color, text }: { num: number; color: string; text: string }) {
    return (
        <div className="flex items-center gap-3">
            <span
                className="flex-shrink-0 w-5 h-5 flex items-center justify-center font-pixel text-[8px] rounded-sm"
                style={{ color, borderColor: `${color}40`, borderWidth: 1 }}
            >
                {num}.
            </span>
            <span className="text-[8px] font-pixel text-[#a8d8ea]/80">{text}</span>
        </div>
    )
}
