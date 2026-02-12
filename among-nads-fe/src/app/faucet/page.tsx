'use client'

import { useAccount, useBalance } from 'wagmi';
import { formatUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function FaucetPage() {
    const { address, isConnected } = useAccount();

    // ── MON Balance (native) ──
    const { data: monBalance } = useBalance({
        address,
        query: { enabled: isConnected && !!address, refetchInterval: 10000 },
    });

    const monBalanceFormatted = monBalance?.value != null
        ? Number(formatUnits(monBalance.value, monBalance.decimals)).toFixed(4)
        : '—';

    return (
        <div className="text-white p-4 sm:px-8">
            <div className="max-w-xl mx-auto space-y-6">
                {/* Page Title */}
                <div>
                    <h1 className="text-sm font-pixel text-[#ffd700] text-glow-gold uppercase tracking-wider">
                        Monad Testnet Faucet
                    </h1>
                    <p className="text-[7px] font-pixel text-[#a8d8ea]/40 mt-1">
                        Claim MON tokens to play Among Nads
                    </p>
                </div>

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
                        <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider mb-1">Your Balance</div>
                        <div className="flex items-center gap-2">
                            <div className="text-base font-pixel text-[#836ef9]">{monBalanceFormatted}</div>
                            <div className="text-[8px] font-pixel text-[#a8d8ea]/40">MON</div>
                        </div>
                    </div>

                     {/* Info Box */}
                    <div className="bg-[#0d2137]/60 border border-[#ffd700]/10 rounded-sm p-3 mb-3">
                        <div className="flex justify-between items-center mb-1">
                            <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">Source</div>
                            <div className="text-[8px] font-pixel text-[#ffd700]">Official Monad Faucet</div>
                        </div>
                        <div className="text-[7px] font-pixel text-[#a8d8ea]/40 mt-2 leading-relaxed">
                            You need native MON tokens to pay for gas and place bets. 
                            Claim them from the official testnet faucet.
                        </div>
                    </div>

                    {/* External Link Button */}
                    <div className="mt-auto pt-2">
                        {isConnected ? (
                            <a
                                href="https://testnet.monad.xyz/faucet"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full py-3 rounded-sm text-[8px] font-pixel uppercase tracking-wider text-center transition-all
                                    bg-[#836ef9] hover:bg-[#9580ff] text-white pixel-border hover:scale-[1.02]"
                            >
                                Go to Official Faucet
                            </a>
                        ) : (
                            <ConnectButton.Custom>
                                {({ openConnectModal, mounted }) => (
                                    <button
                                        onClick={openConnectModal}
                                        disabled={!mounted}
                                        className="w-full py-3 rounded-sm text-[8px] font-pixel uppercase tracking-wider transition-all
                                            bg-[#ffd700] hover:bg-[#ffed4a] text-[#0a1628] pixel-border hover:scale-[1.02]"
                                    >
                                        Connect Wallet to Check Balance
                                    </button>
                                )}
                            </ConnectButton.Custom>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
