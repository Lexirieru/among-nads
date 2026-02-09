'use client'

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { MockUSDCABI } from '@/lib/abi/MockUSDC';
import { MOCK_USDC_ADDRESS } from '@/lib/contracts';

const FAUCET_COOLDOWN_SECS = 6 * 60 * 60; // 6 hours in seconds

export default function FaucetPage() {
    const { address, isConnected } = useAccount();
    const [now, setNow] = useState(Math.floor(Date.now() / 1000));

    // Tick every second for countdown
    useEffect(() => {
        const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(t);
    }, []);

    // ── USDC Balance ──
    const { data: usdcBalance } = useReadContract({
        address: MOCK_USDC_ADDRESS,
        abi: MockUSDCABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: isConnected && !!address, refetchInterval: 5000 },
    });

    // ── Last faucet timestamp ──
    const { data: lastFaucetRaw, refetch: refetchLastFaucet } = useReadContract({
        address: MOCK_USDC_ADDRESS,
        abi: MockUSDCABI,
        functionName: 'lastFaucet',
        args: address ? [address] : undefined,
        query: { enabled: isConnected && !!address, refetchInterval: 10000 },
    });

    // ── Faucet amount ──
    const { data: faucetAmountRaw } = useReadContract({
        address: MOCK_USDC_ADDRESS,
        abi: MockUSDCABI,
        functionName: 'FAUCET_AMOUNT',
        query: { enabled: true },
    });

    // ── MON Balance (native) ──
    const { data: monBalance } = useBalance({
        address,
        query: { enabled: isConnected && !!address, refetchInterval: 10000 },
    });

    // ── Faucet tx ──
    const { writeContract, data: faucetHash, isPending, error: faucetError, reset } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash: faucetHash,
        query: { enabled: !!faucetHash },
    });

    // Auto-dismiss success after 5s
    const [showSuccess, setShowSuccess] = useState(false);
    useEffect(() => {
        if (isSuccess) {
            setShowSuccess(true);
            refetchLastFaucet();
            const t = setTimeout(() => {
                setShowSuccess(false);
                reset();
            }, 5000);
            return () => clearTimeout(t);
        }
    }, [isSuccess, refetchLastFaucet, reset]);

    // ── Derived values ──
    const balanceFormatted = usdcBalance != null
        ? Number(formatUnits(usdcBalance as bigint, 6)).toFixed(2)
        : '—';

    const monBalanceFormatted = monBalance?.value != null
        ? Number(formatUnits(monBalance.value, monBalance.decimals)).toFixed(4)
        : '—';

    const faucetAmount = faucetAmountRaw != null
        ? Number(formatUnits(faucetAmountRaw as bigint, 6)).toFixed(0)
        : '100';

    const lastFaucetTime = lastFaucetRaw ? Number(lastFaucetRaw as bigint) : 0;
    const nextAvailable = lastFaucetTime + FAUCET_COOLDOWN_SECS;
    const isOnCooldown = now < nextAvailable && lastFaucetTime > 0;
    const remainingSecs = isOnCooldown ? nextAvailable - now : 0;

    const formatCountdown = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleClaim = () => {
        writeContract({
            address: MOCK_USDC_ADDRESS,
            abi: MockUSDCABI,
            functionName: 'faucet',
        });
    };

    const isBusy = isPending || isConfirming;

    return (
        <div className="text-white p-4 sm:px-8">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Page Title */}
                <div>
                    <h1 className="text-sm font-pixel text-[#ffd700] text-glow-gold uppercase tracking-wider">
                        Testnet Faucet
                    </h1>
                    <p className="text-[7px] font-pixel text-[#a8d8ea]/40 mt-1">
                        Claim tokens to play Among Nads
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* ═══════════ USDC Card ═══════════ */}
                    <div className="retro-panel p-5 flex flex-col">
                        {/* Token header */}
                        <div className="flex items-center gap-3 mb-4">
                            <img src="/USDC_Logos.png" alt="USDC" className="w-10 h-10 rounded-full" />
                            <div>
                                <div className="text-[10px] font-pixel text-white">USDC</div>
                                <div className="text-[7px] font-pixel text-[#a8d8ea]/40">Mock USDC</div>
                            </div>
                        </div>

                        {/* Balance */}
                        <div className="bg-[#0d2137]/60 border border-[#a8d8ea]/10 rounded-sm p-3 mb-3">
                            <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider mb-1">Balance</div>
                            <div className="flex items-center gap-2">
                                <div className="text-base font-pixel text-[#88d8b0] text-glow-mint">{balanceFormatted}</div>
                                <div className="text-[8px] font-pixel text-[#a8d8ea]/40">USDC</div>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="bg-[#0d2137]/60 border border-[#ffd700]/10 rounded-sm p-3 mb-3">
                            <div className="flex justify-between items-center mb-1">
                                <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">Drip</div>
                                <div className="text-[8px] font-pixel text-[#ffd700]">{faucetAmount} USDC</div>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">Cooldown</div>
                                <div className="text-[8px] font-pixel text-[#a8d8ea]/60">6 Hours</div>
                            </div>
                        </div>

                        {/* Cooldown */}
                        {isOnCooldown && (
                            <div className="bg-[#ff6b6b]/5 border border-[#ff6b6b]/20 rounded-sm p-2.5 mb-3 text-center">
                                <div className="text-[7px] font-pixel text-[#ff6b6b]/60 uppercase tracking-wider mb-0.5">Next Claim In</div>
                                <div className="text-xs font-pixel text-[#ff6b6b] text-glow-red">{formatCountdown(remainingSecs)}</div>
                            </div>
                        )}

                        {/* Success */}
                        {showSuccess && (
                            <div className="bg-[#88d8b0]/10 border border-[#88d8b0]/30 rounded-sm p-2.5 mb-3 text-center animate-pulse">
                                <div className="text-[8px] font-pixel text-[#88d8b0]">{faucetAmount} USDC claimed!</div>
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="mt-auto">
                            <button
                                onClick={() => {
                                    if (typeof window !== 'undefined' && (window as any).ethereum) {
                                        (window as any).ethereum.request({
                                            method: 'wallet_watchAsset',
                                            params: {
                                                type: 'ERC20',
                                                options: {
                                                    address: MOCK_USDC_ADDRESS,
                                                    symbol: 'USDC',
                                                    decimals: 6,
                                                    image: `${window.location.origin}/USDC_Logos.png`,
                                                },
                                            },
                                        });
                                    }
                                }}
                                className="w-full mb-2 py-2 rounded-sm text-[7px] font-pixel uppercase tracking-wider transition-all
                                    bg-transparent border border-[#a8d8ea]/20 text-[#a8d8ea]/50 hover:text-[#a8d8ea] hover:border-[#a8d8ea]/40"
                            >
                                + Add USDC to Wallet
                            </button>
                            {isConnected ? (
                                <button
                                    onClick={handleClaim}
                                    disabled={isBusy || isOnCooldown}
                                    className="w-full py-2.5 rounded-sm text-[8px] font-pixel uppercase tracking-wider transition-all
                                        bg-[#2775ca] hover:bg-[#3885da] text-white pixel-border
                                        disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isPending ? 'Requesting...' : isConfirming ? 'Confirming...' : isOnCooldown ? 'On Cooldown' : `Claim ${faucetAmount} USDC`}
                                </button>
                            ) : (
                                <ConnectButton.Custom>
                                    {({ openConnectModal, mounted }) => (
                                        <button
                                            onClick={openConnectModal}
                                            disabled={!mounted}
                                            className="w-full py-2.5 rounded-sm text-[8px] font-pixel uppercase tracking-wider transition-all
                                                bg-[#ffd700] hover:bg-[#ffed4a] text-[#0a1628] pixel-border hover:scale-[1.02]"
                                        >
                                            Connect Wallet
                                        </button>
                                    )}
                                </ConnectButton.Custom>
                            )}
                            {faucetError && !showSuccess && (
                                <div className="text-[7px] font-pixel text-[#ff6b6b] text-center mt-1.5 truncate">
                                    {faucetError.message?.slice(0, 80)}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* ═══════════ MON Card ═══════════ */}
                    <div className="retro-panel p-5 flex flex-col">
                        {/* Token header */}
                        <div className="flex items-center gap-3 mb-4">
                            <img src="/MON_Logos.png" alt="MON" className="w-10 h-10 rounded-full" />
                            <div>
                                <div className="text-[10px] font-pixel text-white">MON</div>
                                <div className="text-[7px] font-pixel text-[#a8d8ea]/40">Monad Testnet</div>
                            </div>
                        </div>

                        {/* Balance */}
                        <div className="bg-[#0d2137]/60 border border-[#a8d8ea]/10 rounded-sm p-3 mb-3">
                            <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider mb-1">Balance</div>
                            <div className="flex items-center gap-2">
                                <div className="text-base font-pixel text-[#836ef9]">{monBalanceFormatted}</div>
                                <div className="text-[8px] font-pixel text-[#a8d8ea]/40">MON</div>
                            </div>
                        </div>

                        <div className="bg-[#0d2137]/60 border border-[#ffd700]/10 rounded-sm p-3 mb-3">
                            <div className="flex justify-between items-center mb-1">
                                <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">Source</div>
                                <div className="text-[8px] font-pixel text-[#ffd700]">Official Faucet</div>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">Network</div>
                                <div className="text-[8px] font-pixel text-[#a8d8ea]/60">Monad Testnet</div>
                            </div>
                        </div>

                        {/* Claim Button → external link */}
                        <div className="mt-auto">
                            <a
                                href="https://faucet.monad.xyz/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full py-2.5 rounded-sm text-[8px] font-pixel uppercase tracking-wider text-center transition-all
                                    bg-[#836ef9] hover:bg-[#9580ff] text-white pixel-border hover:scale-[1.02]"
                            >
                                Claim MON
                            </a>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
