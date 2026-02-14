import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ── Chain definition (Monad Mainnet) ─────────────────────────────────────────
const monadMainnet = defineChain({
  id: 143,
  name: "Monad Mainnet",
  nativeCurrency: { decimals: 18, name: "Monad", symbol: "MON" },
  rpcUrls: { default: { http: ["https://monad-mainnet.drpc.org"] } },
});

// ── ABI — V2 (Native MON, Refactored) ─────────────────────────────────────────
const AMONG_NADS_ABI = [
  {
    name: "nextGameId",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "hasUserBets",
    type: "function" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "seedPool",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "crewAmount", type: "uint256" },
      { name: "impAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "lockGame",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "settleGame",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "winningTeam", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "deposit",
    type: "function" as const,
    stateMutability: "payable" as const,
    inputs: [],
    outputs: [],
  },
  {
    name: "cancelGame",
    type: "function" as const,
    stateMutability: "nonpayable" as const,
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
] as const;

// ── Team enum values (must match IAmongNads.Team) ────────────────────────────
export const Team = {
  Crewmates: 0,
  Impostors: 1,
} as const;

// ── Singleton client ─────────────────────────────────────────────────────────
class ContractClient {
  private walletClient;
  private publicClient;
  private contractAddress: Address;
  private currentGameId: bigint | null = null;
  private _gameOnChain = false;

  // Seed amounts (USDC 6 decimals). Configurable via env.
  private seedCrewmates: bigint;
  private seedImpostors: bigint;

  constructor() {
    const rpcUrl = process.env.RPC_URL || "https://monad-mainnet.drpc.org";
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddr = process.env.CONTRACT_ADDRESS;

    if (!privateKey || !contractAddr) {
      throw new Error("PRIVATE_KEY and CONTRACT_ADDRESS must be set in .env");
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);

    this.walletClient = createWalletClient({
      account,
      chain: monadMainnet,
      transport: http(rpcUrl),
    });

    this.publicClient = createPublicClient({
      chain: monadMainnet,
      transport: http(rpcUrl),
    });

    this.contractAddress = contractAddr as Address;

    // Default seed: 1 MON each side. Override with SEED_CREWMATES / SEED_IMPOSTORS env vars.
    this.seedCrewmates = BigInt(
      process.env.SEED_CREWMATES || "1000000000000000000",
    ); // 1 MON
    this.seedImpostors = BigInt(
      process.env.SEED_IMPOSTORS || "1000000000000000000",
    ); // 1 MON

    console.log(
      `[ContractClient] Connected to AmongNads @ ${this.contractAddress}`,
    );
  }

  /** Returns the on-chain gameId for the current round (null if not yet fetched). */
  get gameId(): bigint | null {
    return this.currentGameId;
  }

  /** Whether the current game was seeded+locked on-chain (needs settle at end). */
  get gameOnChain(): boolean {
    return this._gameOnChain;
  }

  // ── View calls (free, no gas) ─────────────────────────────────────────────

  /**
   * Reads nextGameId from the contract (free view call).
   * Stores it as currentGameId for broadcast.
   */
  async fetchNextGameId(): Promise<bigint> {
    const nextId = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: AMONG_NADS_ABI,
      functionName: "nextGameId",
    })) as bigint;

    this.currentGameId = nextId;
    this._gameOnChain = false;
    console.log(`[ContractClient] nextGameId: ${nextId}`);
    return nextId;
  }

  /**
   * Checks if any real users have placed bets on this game (free view call).
   * Returns false for uninitialized games or seed-only games.
   */
  async hasUserBets(gameId: bigint): Promise<boolean> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: AMONG_NADS_ABI,
      functionName: "hasUserBets",
      args: [gameId],
    });
    return result as boolean;
  }

  // ── Write calls (costs gas) ───────────────────────────────────────────────

  /**
   * Seeds the house pool for a game. Allocates from houseBalance (no ERC20 transfer).
   * Also lazily creates the game if it doesn't exist yet.
   */
  async seedPool(gameId: bigint): Promise<void> {
    console.log(
      `[ContractClient] seedPool(${gameId}, crew=${this.seedCrewmates}, imp=${this.seedImpostors})...`,
    );
    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: AMONG_NADS_ABI,
      functionName: "seedPool",
      args: [gameId, this.seedCrewmates, this.seedImpostors],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    console.log(`[ContractClient] Pool seeded (tx: ${hash})`);
  }

  /**
   * Locks the current game (no more bets accepted).
   */
  async lockGame(gameId: bigint): Promise<void> {
    console.log(`[ContractClient] lockGame(${gameId})...`);
    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: AMONG_NADS_ABI,
      functionName: "lockGame",
      args: [gameId],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    this._gameOnChain = true;
    console.log(`[ContractClient] Game locked (tx: ${hash})`);
  }

  /**
   * Settles the current game with the winning team.
   * Fee + seed share auto-return to houseBalance.
   */
  async settleGame(winner: "Crewmates" | "Impostors"): Promise<void> {
    if (this.currentGameId === null) {
      console.warn("[ContractClient] settleGame() skipped — no active gameId");
      return;
    }
    const teamValue = winner === "Crewmates" ? Team.Crewmates : Team.Impostors;
    console.log(
      `[ContractClient] settleGame(${this.currentGameId}, ${winner})...`,
    );
    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: AMONG_NADS_ABI,
      functionName: "settleGame",
      args: [this.currentGameId, teamValue],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    this._gameOnChain = false;
    console.log(
      `[ContractClient] Game settled — winner: ${winner} (tx: ${hash})`,
    );
  }
}

// Export singleton
export const contractClient = new ContractClient();
