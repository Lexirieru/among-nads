import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export type Player = {
  id: string; // Socket ID or Agent ID
  name?: string;
  role?: "Crewmate" | "Impostor";
  room?: string;
  alive?: boolean;
  isBot?: boolean;
  avatar?: string;
};

export type GamePhase = "LOBBY" | "ACTION" | "MEETING" | "ENDED";

export type GameState = {
  id: string;
  players: Record<string, Player>;
  phase: GamePhase;
  timer: number;
  messages: { sender: string; content: string; timestamp?: number; type?: "chat" | "meeting" }[];
  winner?: string | null;
  taskProgress?: { completed: number; total: number };
  sabotage?: { name: string; timer: number } | null;
  meetingContext?: {
    reporter?: string;
    bodyFound?: string;
    votesReceived: Record<string, string>;
  };
  onChainGameId?: string | null; // on-chain gameId broadcast from backend (string because bigint doesn't serialize over JSON)
  bettingOpen?: boolean; // true during LOBBY + first 2 min of ACTION
  bettingTimer?: number; // seconds remaining until betting closes
  bettingOpensIn?: number; // seconds until betting opens again (when closed)
};

const CHARACTER_POOL = [
  "/characters/molandak-black-tg.png",
  "/characters/molandak-cyan-tg.png",
  "/characters/molandak-dark-blue-tg.png",
  "/characters/molandak-green-tg.png",
  "/characters/molandak-grey-tg.png",
  "/characters/molandak-light-purple-tg.png",
  "/characters/molandak-pink-tg.png",
  "/characters/molandak-purple-tg.png",
  "/characters/molandak-red-tg.png",
  "/characters/molandak-yellow-tg.png",
];

/** Assign karakter secara urutan dari pool agar setiap player dapat warna unik */
let characterIndex = 0;
function pickNextCharacter(): string {
  const char = CHARACTER_POOL[characterIndex % CHARACTER_POOL.length];
  characterIndex++;
  return char;
}

export function useGameState(gameId: string = "sim-1") {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Ref untuk simpan mapping playerId -> karakter yang sudah di-assign
  // Pakai ref agar tidak trigger re-render dan konsisten di semua callback
  const avatarMap = useRef<Record<string, string>>({});

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  /** Inject avatar dari local map ke players. Assign baru kalau player belum ada di map. */
  const injectAvatars = useCallback((players: Record<string, Player>): Record<string, Player> => {
    const result: Record<string, Player> = {};
    for (const [id, player] of Object.entries(players)) {
      if (!avatarMap.current[id]) {
        avatarMap.current[id] = pickNextCharacter();
      }
      result[id] = { ...player, avatar: avatarMap.current[id] };
    }
    return result;
  }, []);

  useEffect(() => {
    const newSocket = io(BACKEND_URL);

    newSocket.on("connect", () => {
      console.log("Connected to backend as Spectator");
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected");
      setIsConnected(false);
    });

    // Initial load
    newSocket.on("lobby_update", (data: GameState) => {
      setGameState({
        ...data,
        players: injectAvatars(data.players),
      });
    });

    // Tick updates (Full State)
    newSocket.on("game_state_update", (data: GameState) => {
      // Game reset di backend → players kosong → clear avatar map
      if (Object.keys(data.players).length === 0) {
        avatarMap.current = {};
        characterIndex = 0;
      }
      setGameState((prev) => ({
        ...data,
        players: injectAvatars(data.players),
        messages: prev?.messages || [],
      }));
    });

    // Event updates
    newSocket.on("phase_change", (phase: GamePhase) => {
      setGameState((prev) => (prev ? { ...prev, phase } : null));
    });

    // Chat updates
    newSocket.on("new_message", (msg: { sender: string; content: string; timestamp?: number; type?: "chat" | "meeting" }) => {
      setGameState((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...(prev.messages || []), msg],
        };
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [injectAvatars]);

  const sendMessage = (content: string) => {
    if (socket) {
      socket.emit("send_message", { gameId, message: content });
    }
  };

  return { gameState, isConnected, sendMessage };
}
