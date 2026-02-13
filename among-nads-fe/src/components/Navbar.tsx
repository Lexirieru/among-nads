'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Navbar() {
    const pathname = usePathname();

    const navLinks = [
        { name: 'Game', path: '/' },
        { name: 'History', path: '/history' },
        { name: 'Leaderboard', path: '/leaderboard' },
    ];

    const renderLinks = (mobile: boolean) => (
        <>
            {navLinks.map((link) => (
                <Link
                    key={link.path}
                    href={link.path}
                    className={`
                        ${mobile ? 'text-center' : ''}
                        px-2 sm:px-3 py-1.5 rounded-sm text-[7px] sm:text-[8px] font-pixel uppercase tracking-wider transition-all
                        ${pathname === link.path
                            ? 'bg-[#ffd700]/10 text-[#ffd700] border border-[#ffd700]/30'
                            : 'text-[#a8d8ea]/50 hover:text-[#a8d8ea] hover:bg-[#0d2137]/40'}
                    `}
                >
                    {link.name}
                </Link>
            ))}
        </>
    );

    return (
        <nav className="retro-panel p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 sm:gap-2">
            {/* Top Row (Mobile) / Left Side (Desktop) */}
            <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start sm:gap-6">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <img src="/amongnads_logo_tg.png" alt="Among Nads" className="w-8 h-8 rounded-full" />
                    <span className="text-base font-pixel text-shimmer tracking-tight hidden sm:inline">AMONG NADS</span>
                </Link>

                {/* Desktop Links */}
                <div className="hidden sm:flex items-center gap-1">
                    {renderLinks(false)}
                </div>

                {/* Mobile Connect Button */}
                <div className="sm:hidden flex-shrink-0">
                    <ConnectButton.Custom>
                        {({ account, openConnectModal, openAccountModal, mounted }) => {
                            if (!mounted) return null;
                            if (!account) {
                                return (
                                    <button
                                        onClick={openConnectModal}
                                        className="px-3 py-1.5 rounded-sm text-[7px] font-pixel uppercase tracking-wider
                                            bg-[#ffd700] hover:bg-[#ffed4a] text-[#0a1628] pixel-border transition-all"
                                    >
                                        Connect
                                    </button>
                                );
                            }
                            return (
                                <button
                                    onClick={openAccountModal}
                                    className="px-2 py-1.5 rounded-sm text-[7px] font-pixel tracking-wider
                                        bg-[#0d2137]/60 border border-[#a8d8ea]/20 text-[#a8d8ea] hover:border-[#a8d8ea]/40 transition-all truncate max-w-[120px]"
                                >
                                    {account.displayName}
                                </button>
                            );
                        }}
                    </ConnectButton.Custom>
                </div>
            </div>

            {/* Mobile Links Row */}
            <div className="flex sm:hidden items-center justify-between gap-1 w-full">
                {renderLinks(true)}
            </div>

            {/* Desktop Connect Button */}
            <div className="hidden sm:block flex-shrink-0">
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
            </div>
        </nav>
    );
}
