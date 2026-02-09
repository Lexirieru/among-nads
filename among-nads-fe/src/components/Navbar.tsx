'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Navbar() {
    const pathname = usePathname();

    return (
        <nav className="retro-panel p-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2">
                    <img src="/amongnads_logo_tg.png" alt="Among Nads" className="w-8 h-8 rounded-full" />
                    <span className="text-base font-pixel text-shimmer tracking-tight">AMONG NADS</span>
                </Link>
                <div className="flex items-center gap-1">
                    <Link
                        href="/"
                        className={`px-3 py-1.5 rounded-sm text-[8px] font-pixel uppercase tracking-wider transition-all ${
                            pathname === '/'
                                ? 'bg-[#ffd700]/10 text-[#ffd700] border border-[#ffd700]/30'
                                : 'text-[#a8d8ea]/50 hover:text-[#a8d8ea] hover:bg-[#0d2137]/40'
                        }`}
                    >
                        Game
                    </Link>
                    <Link
                        href="/history"
                        className={`px-3 py-1.5 rounded-sm text-[8px] font-pixel uppercase tracking-wider transition-all ${
                            pathname === '/history'
                                ? 'bg-[#ffd700]/10 text-[#ffd700] border border-[#ffd700]/30'
                                : 'text-[#a8d8ea]/50 hover:text-[#a8d8ea] hover:bg-[#0d2137]/40'
                        }`}
                    >
                        History
                    </Link>
                    <Link
                        href="/faucet"
                        className={`px-3 py-1.5 rounded-sm text-[8px] font-pixel uppercase tracking-wider transition-all ${
                            pathname === '/faucet'
                                ? 'bg-[#ffd700]/10 text-[#ffd700] border border-[#ffd700]/30'
                                : 'text-[#a8d8ea]/50 hover:text-[#a8d8ea] hover:bg-[#0d2137]/40'
                        }`}
                    >
                        Faucet
                    </Link>
                </div>
            </div>
            <ConnectButton.Custom>
                {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
                    if (!mounted) return null;
                    if (!account) {
                        return (
                            <button
                                onClick={openConnectModal}
                                className="px-4 py-1.5 rounded-sm text-[8px] font-pixel uppercase tracking-wider
                                    bg-[#ffd700] hover:bg-[#ffed4a] text-[#0a1628] pixel-border transition-all hover:scale-[1.02]"
                            >
                                Connect
                            </button>
                        );
                    }
                    return (
                        <button
                            onClick={openAccountModal}
                            className="px-3 py-1.5 rounded-sm text-[8px] font-pixel tracking-wider
                                bg-[#0d2137]/60 border border-[#a8d8ea]/20 text-[#a8d8ea] hover:border-[#a8d8ea]/40 transition-all"
                        >
                            {account.displayName}
                            {chain && <span className="text-[#88d8b0] ml-1.5">{chain.name}</span>}
                        </button>
                    );
                }}
            </ConnectButton.Custom>
        </nav>
    );
}
