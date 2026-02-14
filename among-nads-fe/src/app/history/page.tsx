'use client'

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { querySubgraph } from '@/graphql/client';
import { formatEther } from 'viem';
import {
    GET_USER_BET_HISTORY,
    GET_RECENT_GAMES,
    GET_ALL_USER_CLAIMS,
} from '@/graphql/queries';

const teamName = (t: number) => (t === 0 ? 'Crewmates' : 'Impostors');
const teamColor = (t: number) => (t === 0 ? '#a8d8ea' : '#ff6b6b');
const formatMon = (raw: string) => Number(formatEther(BigInt(raw))).toFixed(4);
const formatDate = (ts: string) => {
    const d = new Date(Number(ts) * 1000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

interface HistoryRow {
    gameId: string;
    team: number;
    amount: string;
    timestamp: string;
    winningTeam: number | null; // null = not settled
    result: 'win' | 'lose' | 'pending';
    claimed: boolean;
    claimedAmount: string | null;
}

export default function HistoryPage() {
    const { address, isConnected } = useAccount();
    const [rows, setRows] = useState<HistoryRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ wins: 0, losses: 0, pending: 0, totalBet: 0, totalClaimed: 0 });

    const fetchHistory = useCallback(async () => {
        if (!address) {
            setRows([]);
            return;
        }

        setLoading(true);
        const bettor = address.toLowerCase();

        try {
            const [betsData, gamesData, claimsData] = await Promise.all([
                querySubgraph<{
                    betPlaceds: { amount: string; team: string; gameId: string; timestamp_: string }[];
                }>(GET_USER_BET_HISTORY, { bettor }),
                querySubgraph<{
                    gameSettleds: { gameId: string; winningTeam: string; timestamp_: string }[];
                }>(GET_RECENT_GAMES),
                querySubgraph<{
                    payoutClaimeds: { gameId: string; amount: string }[];
                }>(GET_ALL_USER_CLAIMS, { bettor }),
            ]);

            const settledMap = new Map(
                gamesData.gameSettleds.map((g) => [g.gameId, Number(g.winningTeam)])
            );
            const claimMap = new Map(
                claimsData.payoutClaimeds.map((c) => [c.gameId, c.amount])
            );

            let wins = 0, losses = 0, pending = 0, totalBet = 0, totalClaimed = 0;

            const history: HistoryRow[] = betsData.betPlaceds.map((bet) => {
                const team = Number(bet.team);
                const winningTeam = settledMap.get(bet.gameId) ?? null;
                const claimedAmount = claimMap.get(bet.gameId) ?? null;
                let result: 'win' | 'lose' | 'pending' = 'pending';

                if (winningTeam !== null) {
                    result = team === winningTeam ? 'win' : 'lose';
                }

                totalBet += Number(formatEther(BigInt(bet.amount)));
                if (result === 'win') wins++;
                else if (result === 'lose') losses++;
                else pending++;
                if (claimedAmount) totalClaimed += Number(formatEther(BigInt(claimedAmount)));

                return {
                    gameId: bet.gameId,
                    team,
                    amount: bet.amount,
                    timestamp: bet.timestamp_,
                    winningTeam,
                    result,
                    claimed: !!claimedAmount,
                    claimedAmount,
                };
            });

            setRows(history);
            setStats({ wins, losses, pending, totalBet, totalClaimed });
        } catch (err) {
            console.error('[History] Fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, [address]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    return (
        <div className="text-white p-4 sm:px-8">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Title */}
                <div>
                    <h1 className="text-sm font-pixel text-[#ffd700] text-glow-gold uppercase tracking-wider">
                        Bet History
                    </h1>
                    <p className="text-[7px] font-pixel text-[#a8d8ea]/40 mt-1">
                        Your recent on-chain predictions from the subgraph
                    </p>
                </div>

                {!isConnected ? (
                    <div className="retro-panel p-8 text-center">
                        <div className="text-[8px] font-pixel text-[#a8d8ea]/50 mb-4">
                            Connect your wallet to view bet history
                        </div>
                        <ConnectButton.Custom>
                            {({ openConnectModal, mounted }) => (
                                <button
                                    onClick={openConnectModal}
                                    disabled={!mounted}
                                    className="px-6 py-2.5 rounded-sm text-[9px] font-pixel uppercase tracking-wider
                                        bg-[#ffd700] hover:bg-[#ffed4a] text-[#0a1628] pixel-border hover:scale-[1.02] transition-all"
                                >
                                    Connect Wallet
                                </button>
                            )}
                        </ConnectButton.Custom>
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <div className="retro-panel p-3 text-center">
                                <div className="text-sm font-pixel text-[#88d8b0] text-glow-mint">{stats.wins}</div>
                                <div className="text-[7px] font-pixel text-[#88d8b0]/50 uppercase tracking-wider">Wins</div>
                            </div>
                            <div className="retro-panel p-3 text-center">
                                <div className="text-sm font-pixel text-[#ff6b6b] text-glow-red">{stats.losses}</div>
                                <div className="text-[7px] font-pixel text-[#ff6b6b]/50 uppercase tracking-wider">Losses</div>
                            </div>
                            <div className="retro-panel p-3 text-center">
                                <div className="text-sm font-pixel text-[#ffd700]">{stats.pending}</div>
                                <div className="text-[7px] font-pixel text-[#ffd700]/50 uppercase tracking-wider">Pending</div>
                            </div>
                            <div className="retro-panel p-3 text-center">
                                <div className="text-sm font-pixel text-[#a8d8ea]">{stats.totalBet.toFixed(2)}</div>
                                <div className="text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">Total MON Bet</div>
                            </div>
                            <div className="retro-panel p-3 text-center col-span-2 sm:col-span-1">
                                <div className="text-sm font-pixel text-[#88d8b0]">{stats.totalClaimed.toFixed(2)}</div>
                                <div className="text-[7px] font-pixel text-[#88d8b0]/50 uppercase tracking-wider">MON Claimed</div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="retro-panel overflow-hidden">
                            {/* Table header */}
                            <div className="grid grid-cols-12 gap-2 p-3 bg-[#0d2137] border-b border-[#ffd700]/20 text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">
                                <div className="col-span-1">Bet #</div>
                                <div className="col-span-2">Team</div>
                                <div className="col-span-2 text-right">Bet</div>
                                <div className="col-span-2 text-center">Result</div>
                                <div className="col-span-2 text-right">Payout</div>
                                <div className="col-span-3 text-right">Time</div>
                            </div>

                            {loading ? (
                                <div className="p-6 flex justify-center">
                                    <div className="relative w-6 h-6">
                                        <div className="absolute inset-0 rounded-full border-2 border-[#ffd700]/10" />
                                        <div className="absolute inset-0 rounded-full border-2 border-t-[#ffd700] animate-spin" />
                                    </div>
                                </div>
                            ) : rows.length === 0 ? (
                                <div className="p-6 text-center">
                                    <div className="text-[8px] font-pixel text-[#a8d8ea]/30">
                                        No bets found
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-[#a8d8ea]/5">
                                    {rows.map((row) => (
                                        <div
                                            key={row.gameId}
                                            className="grid grid-cols-12 gap-2 p-3 text-[8px] font-pixel hover:bg-[#0d2137]/40 transition-colors items-center"
                                        >
                                            {/* Round */}
                                            <div className="col-span-1 text-[#a8d8ea]/60">
                                                #{row.gameId}
                                            </div>

                                            {/* Team */}
                                            <div className="col-span-2">
                                                <span
                                                    className="px-1.5 py-0.5 rounded-sm text-[7px]"
                                                    style={{
                                                        color: teamColor(row.team),
                                                        backgroundColor: `${teamColor(row.team)}15`,
                                                        border: `1px solid ${teamColor(row.team)}30`,
                                                    }}
                                                >
                                                    {teamName(row.team)}
                                                </span>
                                            </div>

                                            {/* Bet amount */}
                                            <div className="col-span-2 text-right text-[#ffd700]">
                                                {formatMon(row.amount)} <span className="text-[#a8d8ea]/30">MON</span>
                                            </div>

                                            {/* Result */}
                                            <div className="col-span-2 text-center">
                                                {row.result === 'win' && (
                                                    <span className="text-[#88d8b0] text-glow-mint">WIN</span>
                                                )}
                                                {row.result === 'lose' && (
                                                    <span className="text-[#ff6b6b]">LOSE</span>
                                                )}
                                                {row.result === 'pending' && (
                                                    <span className="text-[#ffd700]/50 animate-pulse">...</span>
                                                )}
                                            </div>

                                            {/* Payout */}
                                            <div className="col-span-2 text-right">
                                                {row.claimed && row.claimedAmount ? (
                                                    <span className="text-[#88d8b0]">
                                                        {formatMon(row.claimedAmount)} <span className="text-[#a8d8ea]/30">MON</span>
                                                    </span>
                                                ) : row.result === 'win' ? (
                                                    <span className="text-[#ffd700]/50 text-[7px]">Unclaimed</span>
                                                ) : row.result === 'lose' ? (
                                                    <span className="text-[#a8d8ea]/20">—</span>
                                                ) : (
                                                    <span className="text-[#a8d8ea]/20">—</span>
                                                )}
                                            </div>

                                            {/* Time */}
                                            <div className="col-span-3 text-right text-[#a8d8ea]/30 text-[7px]">
                                                {formatDate(row.timestamp)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Refresh */}
                        <div className="text-center">
                            <button
                                onClick={fetchHistory}
                                disabled={loading}
                                className="px-4 py-1.5 rounded-sm text-[7px] font-pixel uppercase tracking-wider
                                    text-[#a8d8ea]/40 hover:text-[#a8d8ea] border border-[#a8d8ea]/10 hover:border-[#a8d8ea]/30
                                    transition-all disabled:opacity-40"
                            >
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
