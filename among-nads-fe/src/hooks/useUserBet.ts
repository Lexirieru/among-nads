import { useState, useEffect, useCallback } from "react";
import { querySubgraph } from "@/graphql/client";
import { GET_USER_BET, GET_GAME_RESULT, GET_USER_CLAIM } from "@/graphql/queries";

export type BetResult = "win" | "lose" | null;

interface UserBetState {
  hasBet: boolean;
  team: number | null;       // 0 = Crewmates, 1 = Impostors
  amount: string | null;     // raw amount string (6 decimals)
  winningTeam: number | null; // null if game not settled
  result: BetResult;
  hasClaimed: boolean;
  claimedAmount: string | null;
  loading: boolean;
}

const INITIAL_STATE: UserBetState = {
  hasBet: false,
  team: null,
  amount: null,
  winningTeam: null,
  result: null,
  hasClaimed: false,
  claimedAmount: null,
  loading: false,
};

/**
 * Queries the subgraph for a user's bet, game result, and claim status.
 * Polls every `interval` ms when a gameId and address are provided.
 */
export function useUserBet(
  gameId: string | null | undefined,
  address: string | undefined,
  interval = 5000
): UserBetState {
  const [state, setState] = useState<UserBetState>(INITIAL_STATE);

  const fetchData = useCallback(async () => {
    if (!gameId || !address) {
      setState(INITIAL_STATE);
      return;
    }

    const bettor = address.toLowerCase();

    try {
      // Fetch bet, game result, and claim in parallel
      const [betData, gameData, claimData] = await Promise.all([
        querySubgraph<{ betPlaceds: { amount: string; team: number; gameId: string }[] }>(
          GET_USER_BET,
          { bettor, gameId }
        ),
        querySubgraph<{ gameSettleds: { winningTeam: number; gameId: string }[] }>(
          GET_GAME_RESULT,
          { gameId }
        ),
        querySubgraph<{ payoutClaimeds: { amount: string; gameId: string }[] }>(
          GET_USER_CLAIM,
          { bettor, gameId }
        ),
      ]);

      const bet = betData.betPlaceds[0] || null;
      const settled = gameData.gameSettleds[0] || null;
      const claim = claimData.payoutClaimeds[0] || null;

      let result: BetResult = null;
      if (bet && settled) {
        result = bet.team === settled.winningTeam ? "win" : "lose";
      }

      setState({
        hasBet: !!bet,
        team: bet ? Number(bet.team) : null,
        amount: bet ? bet.amount : null,
        winningTeam: settled ? Number(settled.winningTeam) : null,
        result,
        hasClaimed: !!claim,
        claimedAmount: claim ? claim.amount : null,
        loading: false,
      });
    } catch (err) {
      console.error("[useUserBet] Subgraph query failed:", err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [gameId, address]);

  // Initial fetch
  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true }));
    fetchData();
  }, [fetchData]);

  // Poll
  useEffect(() => {
    if (!gameId || !address) return;
    const timer = setInterval(fetchData, interval);
    return () => clearInterval(timer);
  }, [fetchData, interval, gameId, address]);

  return state;
}
