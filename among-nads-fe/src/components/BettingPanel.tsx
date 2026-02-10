'use client'

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AmongNadsABI } from '@/lib/abi/AmongNads';
import { MockUSDCABI } from '@/lib/abi/MockUSDC';
import { AMONG_NADS_ADDRESS, MOCK_USDC_ADDRESS } from '@/lib/contracts';
import { useUserBet } from '@/hooks/useUserBet';
import { useUnclaimedPayouts } from '@/hooks/useUnclaimedPayouts';

const Team = { Crewmates: 0, Impostors: 1 } as const;
const teamName = (t: number | null) => (t === 0 ? 'Crewmates' : t === 1 ? 'Impostors' : '—');
const formatUsdc = (raw: string | null) => raw ? (Number(raw) / 1e6).toFixed(2) : '0';

interface BettingPanelProps {
    phase: string;
    winner?: string | null;
    onChainGameId?: string | null;
    bettingOpen?: boolean;
    bettingTimer?: number;
    bettingOpensIn?: number;
}

type BetTeam = 'Crewmates' | 'Impostors' | null;

const formatBetTimer = (secs: number) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;

export function BettingPanel({ phase, winner, onChainGameId, bettingOpen = false, bettingTimer = 0, bettingOpensIn = 0 }: BettingPanelProps) {
    const { address, isConnected } = useAccount();

    // ── USDC wallet balance ──
    const { data: usdcBalance } = useReadContract({
        address: MOCK_USDC_ADDRESS,
        abi: MockUSDCABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: isConnected && !!address, refetchInterval: 10000 },
    });

    // ── On-chain game data (for payout calculation) ──
    const { data: gameData } = useReadContract({
        address: AMONG_NADS_ADDRESS,
        abi: AmongNadsABI,
        functionName: 'getGame',
        args: onChainGameId ? [BigInt(onChainGameId)] : undefined,
        query: { enabled: !!onChainGameId, refetchInterval: 10000 },
    });

    // ── Subgraph: on-chain bet status ──
    const userBet = useUserBet(onChainGameId, address);

    // ── Unclaimed payouts from past games ──
    const unclaimed = useUnclaimedPayouts(address);

    // ── UI state ──
    const [selectedTeam, setSelectedTeam] = useState<BetTeam>(null);
    const [amount, setAmount] = useState('');
    const [claimingGameId, setClaimingGameId] = useState<string | null>(null);
    const [claimedGameIds, setClaimedGameIds] = useState<Set<string>>(new Set());
    const [showCurrentSuccess, setShowCurrentSuccess] = useState(false);
    const [showHistSuccess, setShowHistSuccess] = useState<string | null>(null);

    // ── Approve USDC tx ──
    const { writeContract: writeApprove, data: approveHash, isPending: isApprovePending, error: approveError } = useWriteContract();
    const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

    // ── placeBet tx ──
    const { writeContract: writePlaceBet, data: placeBetHash, isPending: isPlaceBetPending, error: placeBetError } = useWriteContract();
    const { isLoading: isPlaceBetConfirming } = useWaitForTransactionReceipt({ hash: placeBetHash });

    // ── claimPayout tx (current game) ──
    const { writeContract: writeClaim, data: claimHash, isPending: isClaimPending, error: claimError } = useWriteContract();
    const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({ hash: claimHash, query: { enabled: !!claimHash } });

    // ── claimPayout tx (historical / unclaimed) ──
    const { writeContract: writeHistoricalClaim, data: histClaimHash, isPending: isHistClaimPending, error: histClaimError } = useWriteContract();
    const { isLoading: isHistClaimConfirming, isSuccess: isHistClaimSuccess } = useWaitForTransactionReceipt({ hash: histClaimHash, query: { enabled: !!histClaimHash } });

    // Track successful historical claims + auto-dismiss
    useEffect(() => {
        if (isHistClaimSuccess && claimingGameId) {
            const gid = claimingGameId;
            setClaimedGameIds((prev) => new Set(prev).add(gid));
            setShowHistSuccess(gid);
            setClaimingGameId(null);
            const t = setTimeout(() => setShowHistSuccess(null), 5000);
            return () => clearTimeout(t);
        }
    }, [isHistClaimSuccess, claimingGameId]);

    // Auto-dismiss current game claim success
    useEffect(() => {
        if (isClaimSuccess) {
            setShowCurrentSuccess(true);
            const t = setTimeout(() => setShowCurrentSuccess(false), 5000);
            return () => clearTimeout(t);
        }
    }, [isClaimSuccess]);

    // Auto-trigger placeBet after approve succeeds
    useEffect(() => {
        if (isApproveSuccess && selectedTeam && amount && onChainGameId) {
            const teamValue = selectedTeam === 'Crewmates' ? Team.Crewmates : Team.Impostors;
            const amountInUsdc = parseUnits(amount, 6);
            writePlaceBet({
                address: AMONG_NADS_ADDRESS,
                abi: AmongNadsABI,
                functionName: 'placeBet',
                args: [BigInt(onChainGameId), teamValue, amountInUsdc],
            });
        }
    }, [isApproveSuccess]);

    // Reset UI when new lobby starts
    useEffect(() => {
        if (bettingOpen && !userBet.hasBet) {
            setSelectedTeam(null);
            setAmount('');
        }
    }, [bettingOpen, userBet.hasBet]);

    // ── Calculate estimated payout from on-chain game data ──
    const estimatedPayout = (() => {
        if (!gameData || !userBet.hasBet || !userBet.amount || userBet.winningTeam === null) return null;
        const game = gameData as any;
        const totalPool = BigInt(game.totalPool || 0);
        const winningPool = userBet.winningTeam === 0
            ? BigInt(game.crewmatesPool || 0)
            : BigInt(game.impostorsPool || 0);
        if (winningPool === BigInt(0) || userBet.result !== 'win') return null;
        const fee = totalPool * BigInt(500) / BigInt(10000); // 5%
        const distributable = totalPool - fee;
        const betAmount = BigInt(userBet.amount);
        return (betAmount * distributable) / winningPool;
    })();

    // ── handlers ──
    const handlePlaceBet = () => {
        if (!selectedTeam || !amount || parseFloat(amount) < 1) return;
        if (!onChainGameId) return;
        const amountInUsdc = parseUnits(amount, 6);
        writeApprove({
            address: MOCK_USDC_ADDRESS,
            abi: MockUSDCABI,
            functionName: 'approve',
            args: [AMONG_NADS_ADDRESS, amountInUsdc],
        });
    };

    const claimPayout = () => {
        if (!onChainGameId) return;
        writeClaim({
            address: AMONG_NADS_ADDRESS,
            abi: AmongNadsABI,
            functionName: 'claimPayout',
            args: [BigInt(onChainGameId)],
        });
    };

    const claimHistorical = (gameId: string) => {
        setClaimingGameId(gameId);
        writeHistoricalClaim({
            address: AMONG_NADS_ADDRESS,
            abi: AmongNadsABI,
            functionName: 'claimPayout',
            args: [BigInt(gameId)],
        });
    };

    const isPlacingBet = isApprovePending || isApproveConfirming || isPlaceBetPending || isPlaceBetConfirming;
    const betTeamLabel = teamName(userBet.team);
    const betAmountLabel = formatUsdc(userBet.amount);
    const usdcBalanceFormatted = usdcBalance != null ? Number(formatUnits(usdcBalance as bigint, 6)).toFixed(2) : '—';
    const hasZeroUsdc = isConnected && usdcBalance != null && (usdcBalance as bigint) === BigInt(0);
    const canClaim = userBet.result === 'win' && !userBet.hasClaimed && !isClaimSuccess;
    const payoutFormatted = estimatedPayout ? Number(formatUnits(estimatedPayout, 6)).toFixed(2) : betAmountLabel;

    // Filter out already-claimed-this-session games from unclaimed list
    const visibleUnclaimed = unclaimed.payouts.filter(
        (p) => !claimedGameIds.has(p.gameId) && p.gameId !== onChainGameId
    );
    const unclaimedCount = visibleUnclaimed.length + (canClaim ? 1 : 0);

    // ══════════════════════════════════════════════════════════════════════════
    // SHARED SECTIONS — rendered in every state
    // ══════════════════════════════════════════════════════════════════════════

    const balanceBar = isConnected ? (
        <div className="flex justify-between items-center p-2 bg-[#0d2137]/60 rounded-sm mb-3">
            <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">USDC Balance</div>
            <div className="text-[9px] font-pixel text-[#88d8b0] text-glow-mint">
                {usdcBalanceFormatted} <span className="text-[#a8d8ea]/40">USDC</span>
            </div>
        </div>
    ) : null;

    // ── Zero balance warning ──
    const zeroBalanceWarning = hasZeroUsdc ? (
        <div className="flex items-center gap-2 p-2.5 bg-[#ffd700]/5 border border-[#ffd700]/20 rounded-sm mb-3">
            <div className="text-[7px] font-pixel text-[#ffd700]">
                You have 0 USDC.{' '}
                <a href="/faucet" className="underline hover:text-[#ffed4a] transition-colors">
                    Claim from faucet
                </a>{' '}
                to start betting.
            </div>
        </div>
    ) : null;

    // ── Betting countdown badge — shown from the start of betting window ──
    const bettingTimerBadge = bettingOpen && bettingTimer > 0 ? (
        <div className="flex items-center justify-between p-2 bg-[#88d8b0]/5 border border-[#88d8b0]/20 rounded-sm mb-3">
            <div className="text-[7px] font-pixel text-[#88d8b0]/60 uppercase tracking-wider">Betting Closes In</div>
            <div className={`text-[10px] font-pixel ${bettingTimer <= 30 ? 'text-[#ff6b6b] animate-pulse text-glow-red' : 'text-[#88d8b0] text-glow-mint'}`}>
                {formatBetTimer(bettingTimer)}
            </div>
        </div>
    ) : null;

    // ── Combined claim section — always visible ──
    const claimSection = (() => {
        if (!isConnected) return null;

        return (
            <div className="mt-auto pt-3 border-t border-[#88d8b0]/20">
                {/* Header with red badge */}
                <div className="flex items-center gap-2 mb-2">
                    <div className="text-[7px] font-pixel text-[#ffd700] uppercase tracking-wider">
                        Claim Payouts
                    </div>
                    {unclaimedCount > 0 && (
                        <span className="relative flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ff4444] px-1">
                            <span className="text-[7px] font-pixel text-white leading-none">
                                {unclaimedCount}
                            </span>
                            <span className="absolute inset-0 rounded-full bg-[#ff4444] animate-ping opacity-30" />
                        </span>
                    )}
                </div>

                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {/* Current game claim */}
                    {canClaim && (
                        <div className="p-2.5 bg-[#88d8b0]/5 border border-[#88d8b0]/20 rounded-sm">
                            <div className="flex justify-between items-center mb-2">
                                <div className="text-[7px] font-pixel text-[#a8d8ea]/50">
                                    Round #{onChainGameId} — {teamName(userBet.team)}
                                </div>
                                <div className="text-[9px] font-pixel text-[#88d8b0] text-glow-mint">
                                    ~{payoutFormatted} <span className="text-[#a8d8ea]/40">USDC</span>
                                </div>
                            </div>
                            <button
                                onClick={claimPayout}
                                disabled={isClaimPending || isClaimConfirming}
                                className="w-full py-2 rounded-sm text-[8px] font-pixel uppercase tracking-wider transition-all
                                    bg-[#88d8b0] hover:bg-[#9de8c0] text-[#0a1628] pixel-border
                                    disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isClaimPending ? 'Approving...' : isClaimConfirming ? 'Confirming...' : 'Claim Payout'}
                            </button>
                            {claimError && (
                                <div className="text-[7px] font-pixel text-[#ff6b6b] text-center mt-1 truncate">
                                    {claimError.message?.slice(0, 60)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Current game success (auto-dismiss after 5s) */}
                    {showCurrentSuccess && (
                        <div className="p-2.5 bg-[#88d8b0]/5 border border-[#88d8b0]/20 rounded-sm text-center animate-pulse">
                            <div className="text-[8px] font-pixel text-[#88d8b0]">Payout claimed successfully!</div>
                        </div>
                    )}

                    {/* Historical unclaimed payouts */}
                    {visibleUnclaimed.map((payout) => {
                        const isClaiming = claimingGameId === payout.gameId && (isHistClaimPending || isHistClaimConfirming);
                        const justClaimed = showHistSuccess === payout.gameId;

                        if (justClaimed) {
                            return (
                                <div key={payout.gameId} className="p-2.5 bg-[#88d8b0]/5 border border-[#88d8b0]/20 rounded-sm text-center animate-pulse">
                                    <div className="text-[8px] font-pixel text-[#88d8b0]">Round #{payout.gameId} — Claimed!</div>
                                </div>
                            );
                        }

                        return (
                            <div key={payout.gameId} className="p-2.5 bg-[#88d8b0]/5 border border-[#88d8b0]/20 rounded-sm">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-[7px] font-pixel text-[#a8d8ea]/50">
                                        Round #{payout.gameId} — {teamName(payout.team)}
                                    </div>
                                    <div className="text-[9px] font-pixel text-[#88d8b0]">
                                        {formatUsdc(payout.betAmount)} <span className="text-[#a8d8ea]/40">USDC bet</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => claimHistorical(payout.gameId)}
                                    disabled={isClaiming}
                                    className="w-full py-2 rounded-sm text-[8px] font-pixel uppercase tracking-wider transition-all
                                        bg-[#88d8b0] hover:bg-[#9de8c0] text-[#0a1628] pixel-border
                                        disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isClaiming ? 'Claiming...' : 'Claim'}
                                </button>
                            </div>
                        );
                    })}

                    {histClaimError && (
                        <div className="text-[7px] font-pixel text-[#ff6b6b] text-center truncate">
                            {histClaimError.message?.slice(0, 60)}
                        </div>
                    )}

                    {/* Empty state */}
                    {unclaimedCount === 0 && !showCurrentSuccess && (
                        <div className="p-2.5 bg-[#0d2137]/40 border border-[#a8d8ea]/10 rounded-sm text-center">
                            <div className="text-[7px] font-pixel text-[#a8d8ea]/30">No unclaimed payouts</div>
                        </div>
                    )}
                </div>
            </div>
        );
    })();

    // ══════════════════════════════════════════════════════════════════════════
    // MAIN CONTENT — varies by state
    // ══════════════════════════════════════════════════════════════════════════

    // ── RESULT: game settled + user has bet → WIN/LOSE banner ──
    if (userBet.result && userBet.winningTeam !== null) {
        const isWin = userBet.result === 'win';
        return (
            <div className="retro-panel p-4 flex flex-col h-full">
                {balanceBar}
                {bettingTimerBadge}
                {zeroBalanceWarning}
                <div className="text-[8px] font-pixel text-[#ffd700] uppercase tracking-widest mb-3 text-glow-gold">
                    On-Chain Result
                </div>
                <div className={`flex flex-col items-center justify-center rounded-sm p-4 ${
                    isWin ? 'bg-[#88d8b0]/10 border border-[#88d8b0]/30' : 'bg-[#ff6b6b]/10 border border-[#ff6b6b]/30'
                }`}>
                    <div className={`text-lg font-pixel mb-1 ${
                        isWin ? 'text-[#88d8b0] text-glow-mint' : 'text-[#ff6b6b] text-glow-red'
                    }`}>
                        {isWin ? 'YOU WON' : 'YOU LOST'}
                    </div>
                    <div className="text-[8px] font-pixel text-[#a8d8ea]/60 text-center">
                        You bet <span className="text-[#ffd700]">{betAmountLabel} USDC</span> on{' '}
                        <span className={betTeamLabel === 'Crewmates' ? 'text-[#a8d8ea]' : 'text-[#ff6b6b]'}>
                            {betTeamLabel}
                        </span>
                    </div>
                </div>
                <div className="text-[7px] font-pixel text-[#a8d8ea]/30 text-center mt-2">
                    Round #{onChainGameId} — Winner: {teamName(userBet.winningTeam)}
                </div>
                {claimSection}
            </div>
        );
    }

    // ── LOCKED: user bet, waiting for result ──
    if (userBet.hasBet && !bettingOpen) {
        return (
            <div className="retro-panel p-4 flex flex-col h-full">
                {balanceBar}
                {bettingTimerBadge}
                {zeroBalanceWarning}
                <div className="text-[8px] font-pixel text-[#ffd700] uppercase tracking-widest mb-3 text-glow-gold">
                    Your Prediction
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <div className={`w-full rounded-sm border p-3 text-center ${
                        betTeamLabel === 'Crewmates'
                            ? 'bg-[#a8d8ea]/10 border-[#a8d8ea]/30'
                            : 'bg-[#ff6b6b]/10 border-[#ff6b6b]/30'
                    }`}>
                        <div className={`text-sm font-pixel ${
                            betTeamLabel === 'Crewmates' ? 'text-[#a8d8ea]' : 'text-[#ff6b6b]'
                        }`}>
                            {betTeamLabel}
                        </div>
                        <div className="text-[7px] font-pixel text-[#ffd700]/50 mt-0.5">LOCKED IN</div>
                    </div>
                    <div className="text-[8px] font-pixel text-[#a8d8ea]/60 text-center">
                        <span className="text-[#ffd700]">{betAmountLabel} USDC</span> deposited
                    </div>
                    <div className="text-[7px] font-pixel text-[#a8d8ea]/30 text-center">
                        Waiting for game to end...
                    </div>
                </div>
                <div className="text-[7px] font-pixel text-[#a8d8ea]/30 text-center mt-2">
                    Round #{onChainGameId}
                </div>
                {claimSection}
            </div>
        );
    }

    // ── BETTING OPEN: already bet this round ──
    if (userBet.hasBet && bettingOpen) {
        return (
            <div className="retro-panel p-4 flex flex-col h-full">
                {balanceBar}
                {bettingTimerBadge}
                {zeroBalanceWarning}
                <div className="text-[8px] font-pixel text-[#ffd700] uppercase tracking-widest mb-3 text-glow-gold">
                    Bet Placed
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <div className={`w-full rounded-sm border p-3 text-center ${
                        betTeamLabel === 'Crewmates'
                            ? 'bg-[#a8d8ea]/10 border-[#a8d8ea]/30'
                            : 'bg-[#ff6b6b]/10 border-[#ff6b6b]/30'
                    }`}>
                        <div className={`text-sm font-pixel ${
                            betTeamLabel === 'Crewmates' ? 'text-[#a8d8ea]' : 'text-[#ff6b6b]'
                        }`}>
                            {betTeamLabel}
                        </div>
                    </div>
                    <div className="text-[8px] font-pixel text-[#a8d8ea]/60">
                        <span className="text-[#ffd700]">{betAmountLabel} USDC</span> on the line
                    </div>

                </div>
                <div className="text-[7px] font-pixel text-[#a8d8ea]/30 text-center mt-2">
                    Round #{onChainGameId}
                </div>
                {claimSection}
            </div>
        );
    }

    // ── LOBBY: place bet form ──
    return (
        <div className="retro-panel p-4 flex flex-col h-full relative overflow-visible">
            {balanceBar}
                {bettingTimerBadge}
                {zeroBalanceWarning}

            <div className="mb-3">
                <div className="text-[8px] font-pixel text-[#ffd700] uppercase tracking-widest mb-1 text-glow-gold">Predict the Winner</div>
                <div className="text-[7px] font-pixel text-[#a8d8ea]/40">Deposit USDC to place your bet</div>
            </div>

            {/* Team selector */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => bettingOpen && !isPlacingBet && setSelectedTeam('Crewmates')}
                    className={`flex-1 rounded-sm border p-2.5 text-center transition-all ${
                        selectedTeam === 'Crewmates'
                            ? 'bg-[#a8d8ea]/10 border-[#a8d8ea] shadow-[0_0_8px_rgba(168,216,234,0.3)]'
                            : 'bg-[#0d2137]/40 border-[#ffd700]/10 hover:border-[#a8d8ea]/50'
                    } ${!bettingOpen || isPlacingBet ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <div className={`text-[9px] font-pixel ${selectedTeam === 'Crewmates' ? 'text-[#a8d8ea]' : 'text-[#a8d8ea]/50'}`}>Crewmates</div>
                </button>
                <button
                    onClick={() => bettingOpen && !isPlacingBet && setSelectedTeam('Impostors')}
                    className={`flex-1 rounded-sm border p-2.5 text-center transition-all ${
                        selectedTeam === 'Impostors'
                            ? 'bg-[#ff6b6b]/10 border-[#ff6b6b] shadow-[0_0_8px_rgba(255,107,107,0.3)]'
                            : 'bg-[#0d2137]/40 border-[#ffd700]/10 hover:border-[#ff6b6b]/50'
                    } ${!bettingOpen || isPlacingBet ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <div className={`text-[9px] font-pixel ${selectedTeam === 'Impostors' ? 'text-[#ff6b6b]' : 'text-[#ff6b6b]/50'}`}>Impostors</div>
                </button>
            </div>

            {/* Amount input */}
            <div className="mb-4">
                <label className="text-[7px] font-pixel text-[#a8d8ea]/40 uppercase tracking-wider mb-1 block">Amount (USDC)</label>
                <div className="relative">
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={amount}
                        onChange={(e) => bettingOpen && !isPlacingBet && setAmount(e.target.value)}
                        placeholder="0"
                        disabled={!bettingOpen || isPlacingBet}
                        className="w-full bg-[#0a1628] border border-[#ffd700]/20 text-white rounded-sm px-3 py-2 pr-16 text-[10px] font-pixel focus:outline-none focus:border-[#ffd700]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-pixel text-[#a8d8ea]/40">USDC</span>
                </div>
                <div className="text-[7px] font-pixel text-[#a8d8ea]/30 mt-1">Min: 1 USDC</div>
            </div>

            {/* Place bet OR Connect Wallet */}
            {/* Place bet OR Connect Wallet */}
            <ConnectButton.Custom>
                {({ account, mounted }) => {
                    const ready = mounted;
                    const connected = ready && account && account.address;

                    if (connected) {
                        return (
                            <>
                                <button
                                    onClick={handlePlaceBet}
                                    disabled={!bettingOpen || !selectedTeam || !amount || parseFloat(amount) < 1 || isPlacingBet || !onChainGameId}
                                    className="w-full py-2.5 rounded-sm text-[8px] font-pixel uppercase tracking-wider transition-all
                                        bg-[#ff6b6b] hover:bg-[#ff8a8a] text-[#0a1628]
                                        pixel-border
                                        disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isApprovePending ? 'Approving USDC...'
                                        : isApproveConfirming ? 'Confirming Approve...'
                                        : isPlaceBetPending ? 'Placing Bet...'
                                        : isPlaceBetConfirming ? 'Confirming Bet...'
                                        : 'Place Bet'}
                                </button>
                                {(approveError || placeBetError) && (
                                    <div className="text-[7px] font-pixel text-[#ff6b6b] text-center mt-1 truncate">
                                        {(approveError || placeBetError)?.message?.slice(0, 60)}
                                    </div>
                                )}
                            </>
                        );
                    }

                    return (
                        <div className="w-full py-2 flex justify-center">
                            <div className="text-[8px] font-pixel text-[#a8d8ea]/40 text-center">
                                Please Connect Wallet in Navbar ↗
                            </div>
                        </div>
                    );
                }}
            </ConnectButton.Custom>

            {/* gameId indicator */}
            <div className="mt-3 text-[7px] font-pixel text-[#a8d8ea]/30 text-center">
                {onChainGameId !== null && onChainGameId !== undefined ? `Round #${onChainGameId}` : 'Waiting for on-chain round...'}
            </div>

            {claimSection}
        </div>
    );
}
