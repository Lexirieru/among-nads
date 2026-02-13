// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IAmongNads {
    // ── Enums ────────────────────────────────────────────────────────────────

    /// @notice Lifecycle of a prediction round.
    ///         Default (0) = Uninitialized, meaning the game does not exist yet.
    enum GameState {
        Uninitialized, // default — game not yet created
        Open, // LOBBY — bets accepted
        Locked, // ACTION started — no new bets
        Settled, // ENDED — payouts available
        Cancelled // CANCELLED — refunds available
    }

    /// @notice Which team a bettor predicts will win.
    enum Team {
        Crewmates,
        Impostors
    }

    // ── Structs ──────────────────────────────────────────────────────────────

    /// @notice Aggregated state for one prediction round.
    struct Game {
        uint256 id;
        GameState state;
        uint256 bettingDeadline; // timestamp after which bets are rejected
        uint256 totalPool; // sum of all deposits (MON)
        uint256 crewmatesPool; // sum deposited on Crewmates
        uint256 impostorsPool; // sum deposited on Impostors
        uint256 crewmatesSeed; // owner's house-pool seed on Crewmates
        uint256 impostorsSeed; // owner's house-pool seed on Impostors
        Team winningTeam; // set at settlement
    }

    /// @notice Per-bettor record inside a game.
    struct Bet {
        address bettor;
        Team team;
        uint256 amount; // deposit size in MON
        bool claimed; // true after payout
    }

    // ── Events ───────────────────────────────────────────────────────────────

    event GameCreated(uint256 indexed gameId, uint256 bettingDeadline);
    event BetPlaced(uint256 indexed gameId, address indexed bettor, Team team, uint256 amount);
    event GameLocked(uint256 indexed gameId);
    event GameSettled(uint256 indexed gameId, Team winningTeam);
    event PayoutClaimed(uint256 indexed gameId, address indexed bettor, uint256 amount);
    event Deposited(uint256 amount);
    event PoolSeeded(uint256 indexed gameId, uint256 crewAmount, uint256 impAmount);
    event Swept(uint256 amount);
    event GameCancelled(uint256 indexed gameId);
    event RefundClaimed(uint256 indexed gameId, address indexed bettor, uint256 amount);
    event LobbyDurationUpdated(uint256 newDuration);
    event SettlementTimeoutUpdated(uint256 newTimeout);

    // ── Errors ───────────────────────────────────────────────────────────────

    error InvalidGameState(uint256 gameId, GameState current);
    error InvalidGameId(uint256 gameId);
    error BetBelowMinimum(uint256 sent, uint256 minimum);
    error BetExceedsMaximum(uint256 sent, uint256 maximum);
    error BettingDeadlinePassed(uint256 gameId, uint256 deadline);
    error AlreadyBet(address bettor);
    error NoBetToClaim(address bettor);
    error AlreadyClaimed(address bettor);
    error TransferFailed();
    error InsufficientHouseBalance(uint256 available, uint256 required);
    error GameNotCancelled(uint256 gameId);
    error SettlementTimeoutNotReached(uint256 gameId);
    error InvalidDuration(uint256 value);

    // ── External Functions ───────────────────────────────────────────────────

    /// @notice Place a prediction bet on a team using Native MON.
    ///         Auto-creates the game on-chain if it doesn't exist yet (lazy creation).
    ///         Amount is `msg.value`.
    function placeBet(uint256 gameId, Team team) external payable;

    /// @notice Oracle locks betting when ACTION phase starts.
    function lockGame(uint256 gameId) external;

    /// @notice Oracle settles the round and auto-withdraws protocol fee.
    function settleGame(uint256 gameId, Team winningTeam) external;

    /// @notice Winning bettors call this to pull their share.
    function claimPayout(uint256 gameId) external;

    /// @notice Owner deposits MON into the rolling house pool.
    function deposit() external payable;

    /// @notice Owner seeds a game's pools from houseBalance (no MON transfer, just accounting).
    function seedPool(uint256 gameId, uint256 crewAmount, uint256 impAmount) external;

    /// @notice Owner withdraws MON from houseBalance.
    function sweep(uint256 amount) external;

    /// @notice Owner cancels a game (Open or Locked). Seeds return to houseBalance.
    function cancelGame(uint256 gameId) external;

    /// @notice Anyone can cancel a game stuck in Locked state past the settlement timeout.
    function cancelGameByTimeout(uint256 gameId) external;

    /// @notice Bettors reclaim their bet from a cancelled game.
    function claimRefund(uint256 gameId) external;

    /// @notice Owner sets the lobby (betting) duration for new games.
    function setLobbyDuration(uint256 newDuration) external;

    /// @notice Owner sets the settlement timeout for locked games.
    function setSettlementTimeout(uint256 newTimeout) external;

    // ── View Functions ───────────────────────────────────────────────────────

    /// @notice Current state of a prediction round.
    function getGame(uint256 gameId) external view returns (Game memory);

    /// @notice Lookup a single bettor's record inside a game.
    function getBet(uint256 gameId, address bettor) external view returns (Bet memory);

    /// @notice Whether a game has any bets (totalPool > 0, including seed).
    function hasBets(uint256 gameId) external view returns (bool);

    /// @notice Whether a game has user bets (totalPool > seed).
    ///         Backend uses this to decide whether to send lock/settle txs.
    function hasUserBets(uint256 gameId) external view returns (bool);
}
