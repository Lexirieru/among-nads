'use client'

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { querySubgraph } from '@/graphql/client';
import { GET_LEADERBOARD_DATA } from '@/graphql/queries';

const shortAddr = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const fmtMon = (wei: bigint) => {
    const n = Number(formatEther(wei));
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(4)}`;
};

const fmtMonAbs = (wei: bigint) =>
    Number(formatEther(wei)).toFixed(4);

interface LeaderRow {
    rank: number;
    address: string;
    totalBet: bigint;
    totalClaimed: bigint;
    pnl: bigint;
    games: number;
    wins: number;
    winRate: number;
}

export default function LeaderboardPage() {
    const { address } = useAccount();
    const [rows, setRows] = useState<LeaderRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchLeaderboard = useCallback(async () => {
        setLoading(true);
        try {
            const data = await querySubgraph<{
                betPlaceds: { bettor: string; amount: string; team: string; gameId: string }[];
                payoutClaimeds: { bettor: string; amount: string; gameId: string }[];
                gameSettleds: { gameId: string; winningTeam: string }[];
            }>(GET_LEADERBOARD_DATA);

            // Map: gameId → winningTeam
            const winMap = new Map(
                data.gameSettleds.map((g) => [g.gameId, Number(g.winningTeam)])
            );

            // Aggregate per bettor
            const map = new Map<string, {
                totalBet: bigint;       // only settled games
                totalClaimed: bigint;
                games: Set<string>;     // all games (for count)
                settledGames: Set<string>; // settled games only (for win rate)
                wins: number;
                betsByGame: Map<string, number>; // gameId → team
            }>();

            for (const bet of data.betPlaceds) {
                const addr = bet.bettor.toLowerCase();
                if (!map.has(addr)) {
                    map.set(addr, {
                        totalBet: BigInt(0),
                        totalClaimed: BigInt(0),
                        games: new Set(),
                        settledGames: new Set(),
                        wins: 0,
                        betsByGame: new Map(),
                    });
                }
                const entry = map.get(addr)!;
                entry.games.add(bet.gameId);
                entry.betsByGame.set(bet.gameId, Number(bet.team));
                // Only count bets from settled games toward PnL
                if (winMap.has(bet.gameId)) {
                    entry.totalBet += BigInt(bet.amount);
                    entry.settledGames.add(bet.gameId);
                }
            }

            // Count wins (bet on correct side for settled games)
            for (const [addr, entry] of map.entries()) {
                for (const [gameId, team] of entry.betsByGame.entries()) {
                    const winner = winMap.get(gameId);
                    if (winner !== undefined && team === winner) {
                        entry.wins++;
                    }
                }
            }

            for (const claim of data.payoutClaimeds) {
                const addr = claim.bettor.toLowerCase();
                if (!map.has(addr)) continue;
                map.get(addr)!.totalClaimed += BigInt(claim.amount);
            }

            // Build sorted rows
            const result: LeaderRow[] = Array.from(map.entries())
                .map(([addr, e]) => ({
                    rank: 0,
                    address: addr,
                    totalBet: e.totalBet,
                    totalClaimed: e.totalClaimed,
                    pnl: e.totalClaimed - e.totalBet,
                    games: e.settledGames.size,
                    wins: e.wins,
                    winRate: e.settledGames.size > 0 ? Math.round((e.wins / e.settledGames.size) * 100) : 0,
                }))
                .sort((a, b) => (b.pnl > a.pnl ? 1 : b.pnl < a.pnl ? -1 : 0));

            result.forEach((r, i) => { r.rank = i + 1; });
            setRows(result);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('[Leaderboard] fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLeaderboard();
        const t = setInterval(fetchLeaderboard, 30000);
        return () => clearInterval(t);
    }, [fetchLeaderboard]);

    const myRow = address
        ? rows.find((r) => r.address === address.toLowerCase())
        : null;

    const rankBadge = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    return (
        <div className="text-white p-4 sm:px-8">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Title */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-sm font-pixel text-[#ffd700] text-glow-gold uppercase tracking-wider">
                            Leaderboard
                        </h1>
                        <p className="text-[7px] font-pixel text-[#a8d8ea]/40 mt-1">
                            Ranked by PnL — live from Goldsky
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {lastUpdated && (
                            <span className="text-[7px] font-pixel text-[#a8d8ea]/30">
                                {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={fetchLeaderboard}
                            disabled={loading}
                            className="px-3 py-1.5 rounded-sm text-[7px] font-pixel uppercase tracking-wider
                                text-[#a8d8ea]/40 hover:text-[#a8d8ea] border border-[#a8d8ea]/10 hover:border-[#a8d8ea]/30
                                transition-all disabled:opacity-40"
                        >
                            {loading ? '...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {/* My position card (if connected + in leaderboard) */}
                {myRow && (
                    <div className="retro-panel p-3 border border-[#ffd700]/30 bg-[#ffd700]/5">
                        <div className="text-[7px] font-pixel text-[#ffd700]/60 uppercase tracking-wider mb-2">
                            Your Position
                        </div>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="text-[10px] font-pixel text-[#ffd700]">
                                {rankBadge(myRow.rank)}
                            </div>
                            <div className="text-center">
                                <div className={`text-sm font-pixel ${myRow.pnl >= BigInt(0) ? 'text-[#88d8b0] text-glow-mint' : 'text-[#ff6b6b] text-glow-red'}`}>
                                    {fmtMon(myRow.pnl)} MON
                                </div>
                                <div className="text-[6px] font-pixel text-[#a8d8ea]/40 uppercase">PnL</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] font-pixel text-[#a8d8ea]">{myRow.games}</div>
                                <div className="text-[6px] font-pixel text-[#a8d8ea]/40 uppercase">Games</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] font-pixel text-[#88d8b0]">{myRow.winRate}%</div>
                                <div className="text-[6px] font-pixel text-[#a8d8ea]/40 uppercase">Win Rate</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] font-pixel text-[#a8d8ea]">{fmtMonAbs(myRow.totalBet)}</div>
                                <div className="text-[6px] font-pixel text-[#a8d8ea]/40 uppercase">Bet</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] font-pixel text-[#88d8b0]">{fmtMonAbs(myRow.totalClaimed)}</div>
                                <div className="text-[6px] font-pixel text-[#a8d8ea]/40 uppercase">Claimed</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="retro-panel overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 p-3 bg-[#0d2137] border-b border-[#ffd700]/20 text-[7px] font-pixel text-[#a8d8ea]/50 uppercase tracking-wider">
                        <div className="col-span-1">Rank</div>
                        <div className="col-span-4">Address</div>
                        <div className="col-span-2 text-right">PnL</div>
                        <div className="col-span-1 text-center">Games</div>
                        <div className="col-span-1 text-center">Win%</div>
                        <div className="col-span-2 text-right">Bet</div>
                        <div className="col-span-1 text-right">Claimed</div>
                    </div>

                    {loading && rows.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="text-[8px] font-pixel text-[#a8d8ea]/40 animate-pulse">
                                Loading from subgraph...
                            </div>
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="text-[8px] font-pixel text-[#a8d8ea]/30">No bets yet</div>
                        </div>
                    ) : (
                        <div className="divide-y divide-[#a8d8ea]/5">
                            {rows.map((row) => {
                                const isMe = address?.toLowerCase() === row.address;
                                const isPos = row.pnl >= BigInt(0);
                                return (
                                    <div
                                        key={row.address}
                                        className={`grid grid-cols-12 gap-2 p-3 text-[8px] font-pixel items-center transition-colors ${
                                            isMe
                                                ? 'bg-[#ffd700]/5 border-l-2 border-[#ffd700]/50'
                                                : 'hover:bg-[#0d2137]/40'
                                        }`}
                                    >
                                        {/* Rank */}
                                        <div className="col-span-1 text-[#a8d8ea]/60">
                                            {row.rank <= 3
                                                ? <span>{rankBadge(row.rank)}</span>
                                                : <span className="text-[#a8d8ea]/40">#{row.rank}</span>
                                            }
                                        </div>

                                        {/* Address */}
                                        <div className={`col-span-4 font-pixel text-[7px] truncate ${isMe ? 'text-[#ffd700]' : 'text-[#a8d8ea]/70'}`}>
                                            {isMe ? `${shortAddr(row.address)} (you)` : shortAddr(row.address)}
                                        </div>

                                        {/* PnL */}
                                        <div className={`col-span-2 text-right font-pixel ${isPos ? 'text-[#88d8b0] text-glow-mint' : 'text-[#ff6b6b]'}`}>
                                            {fmtMon(row.pnl)}
                                        </div>

                                        {/* Games */}
                                        <div className="col-span-1 text-center text-[#a8d8ea]/60">
                                            {row.games}
                                        </div>

                                        {/* Win rate */}
                                        <div className="col-span-1 text-center">
                                            <span className={row.winRate >= 50 ? 'text-[#88d8b0]' : 'text-[#a8d8ea]/40'}>
                                                {row.winRate}%
                                            </span>
                                        </div>

                                        {/* Total bet */}
                                        <div className="col-span-2 text-right text-[#ffd700]/70">
                                            {fmtMonAbs(row.totalBet)}
                                        </div>

                                        {/* Total claimed */}
                                        <div className="col-span-1 text-right text-[#88d8b0]/70">
                                            {fmtMonAbs(row.totalClaimed)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {rows.length > 0 && (
                    <div className="text-center text-[7px] font-pixel text-[#a8d8ea]/20">
                        {rows.length} unique bettors · auto-refreshes every 30s
                    </div>
                )}
            </div>
        </div>
    );
}
