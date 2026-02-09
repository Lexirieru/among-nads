import { useState, useEffect, useCallback } from "react";
import { querySubgraph } from "@/graphql/client";
import {
  GET_USER_BET_HISTORY,
  GET_RECENT_GAMES,
  GET_ALL_USER_CLAIMS,
} from "@/graphql/queries";

export interface UnclaimedPayout {
  gameId: string;
  team: number;
  betAmount: string; // raw 6-decimal string
  winningTeam: number;
}

interface UnclaimedPayoutsState {
  payouts: UnclaimedPayout[];
  count: number;
  loading: boolean;
}

/**
 * Finds all unclaimed winning bets across past games by cross-referencing:
 *   - user's bet history
 *   - settled games
 *   - user's claim history
 * Polls every `interval` ms.
 */
export function useUnclaimedPayouts(
  address: string | undefined,
  interval = 10000
): UnclaimedPayoutsState {
  const [state, setState] = useState<UnclaimedPayoutsState>({
    payouts: [],
    count: 0,
    loading: false,
  });

  const fetchData = useCallback(async () => {
    if (!address) {
      setState({ payouts: [], count: 0, loading: false });
      return;
    }

    const bettor = address.toLowerCase();

    try {
      const [betsData, gamesData, claimsData] = await Promise.all([
        querySubgraph<{
          betPlaceds: { amount: string; team: string; gameId: string }[];
        }>(GET_USER_BET_HISTORY, { bettor }),
        querySubgraph<{
          gameSettleds: { gameId: string; winningTeam: string }[];
        }>(GET_RECENT_GAMES),
        querySubgraph<{
          payoutClaimeds: { gameId: string }[];
        }>(GET_ALL_USER_CLAIMS, { bettor }),
      ]);

      const bets = betsData.betPlaceds;
      const settledMap = new Map(
        gamesData.gameSettleds.map((g) => [g.gameId, Number(g.winningTeam)])
      );
      const claimedSet = new Set(
        claimsData.payoutClaimeds.map((c) => c.gameId)
      );

      const unclaimed: UnclaimedPayout[] = [];
      for (const bet of bets) {
        const winningTeam = settledMap.get(bet.gameId);
        if (winningTeam === undefined) continue; // game not settled
        if (Number(bet.team) !== winningTeam) continue; // user lost
        if (claimedSet.has(bet.gameId)) continue; // already claimed
        unclaimed.push({
          gameId: bet.gameId,
          team: Number(bet.team),
          betAmount: bet.amount,
          winningTeam,
        });
      }

      setState({ payouts: unclaimed, count: unclaimed.length, loading: false });
    } catch (err) {
      console.error("[useUnclaimedPayouts] Subgraph query failed:", err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [address]);

  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true }));
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!address) return;
    const timer = setInterval(fetchData, interval);
    return () => clearInterval(timer);
  }, [fetchData, interval, address]);

  return state;
}
