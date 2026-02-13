// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IAmongNads } from "./interfaces/IAmongNads.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ReentrancyGuardTransient } from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

/**
 * @title AmongNads Prediction Market (v3 — Rolling House Pool, UUPS Upgradeable)
 * @notice ERC20-based prediction betting with a house-pool model.
 *
 * Key features:
 *   - Rolling house pool: owner deposits USDC once, reuses across games.
 *   - seedPool(): allocates from houseBalance into a game's pools (no transfer).
 *   - Lazy game creation: seedPool() or first placeBet() auto-creates game.
 *   - Pari-mutuel payout: (userBet / winningPool) * distributable.
 *   - At settlement: fee + seed's winning share return to houseBalance automatically.
 *   - UUPS upgradeable: owner can upgrade implementation via proxy.
 *
 * Flow:
 *   1. Owner calls deposit(amount) once to fund the house pool
 *   2. Backend calls seedPool(nextGameId, crewAmt, impAmt) → game auto-created, both sides seeded
 *   3. Users call placeBet(gameId, team, amount) while state = Open
 *   4. Backend calls lockGame(gameId)           → state = Locked
 *   5. Backend calls settleGame(gameId, winner) → state = Settled, house recovers fee + seed share
 *   6. Winners call claimPayout(gameId)
 *   7. Owner calls sweep(amount) to withdraw profit anytime
 */
contract AmongNads is IAmongNads, Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardTransient {
    // ── Constants ────────────────────────────────────────────────────────────

    /// @notice Minimum bet size: 0.001 MON (1e15)
    uint256 public constant MIN_BET = 0.001 ether;

    /// @notice Maximum bet size: 0.1 MON (1e17) to prevent whale dominance
    uint256 public constant MAX_BET = 0.1 ether;

    /// @notice Protocol fee in basis-points (0.1 % = 10 bps out of 10 000)
    uint256 public constant PROTOCOL_FEE_BPS = 10;

    // ── State ────────────────────────────────────────────────────────────────

    /// @notice Counter for game IDs.
    uint256 public nextGameId;

    /// @notice Owner's rolling house-pool balance inside this contract.
    uint256 public houseBalance;

    /// @notice Game metadata keyed by gameId
    mapping(uint256 => Game) public games;

    /// @notice Per-bettor record: gameId → bettor address → Bet
    mapping(uint256 => mapping(address => Bet)) public bets;

    /// @notice Duration of the lobby phase in seconds (default: 3 minutes)
    uint256 public lobbyDuration;

    /// @notice Max time a game can stay Locked before anyone can cancel it (default: 1 hour)
    uint256 public settlementTimeout;

    // ── Constructor (disable initializers on implementation) ─────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ── Initializer ─────────────────────────────────────────────────────────

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __Context_init();
        lobbyDuration = 180;
        settlementTimeout = 1 hours;
    }

    // ── UUPS ────────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner { }

    // ── House Pool (Rolling Pool) ───────────────────────────────────────────

    /// @notice Owner deposits MON into the rolling house pool. Call once, reuse across games.
    function deposit() external payable override onlyOwner {
        houseBalance += msg.value;
        emit Deposited(msg.value);
    }

    /// @notice Allocate from houseBalance into a game's pools. No transfer — just accounting.
    ///         Auto-creates the game if it doesn't exist yet.
    function seedPool(uint256 gameId, uint256 crewAmount, uint256 impAmount) external override onlyOwner {
        uint256 total = crewAmount + impAmount;
        if (houseBalance < total) revert InsufficientHouseBalance(houseBalance, total);

        // Lazy game creation
        if (games[gameId].state == GameState.Uninitialized) {
            if (gameId != nextGameId) revert InvalidGameId(gameId);
            _createGame();
        }

        if (games[gameId].state != GameState.Open) revert InvalidGameState(gameId, games[gameId].state);

        houseBalance -= total;

        Game storage game = games[gameId];
        game.crewmatesPool += crewAmount;
        game.impostorsPool += impAmount;
        game.crewmatesSeed += crewAmount;
        game.impostorsSeed += impAmount;
        game.totalPool += total;

        emit PoolSeeded(gameId, crewAmount, impAmount);
    }

    /// @notice Owner withdraws MON from houseBalance.
    function sweep(uint256 amount) external override onlyOwner nonReentrant {
        if (houseBalance < amount) revert InsufficientHouseBalance(houseBalance, amount);
        houseBalance -= amount;

        (bool ok,) = owner().call{ value: amount }("");
        if (!ok) revert TransferFailed();

        emit Swept(amount);
    }

    // ── Configuration ──────────────────────────────────────────────────────

    /// @inheritdoc IAmongNads
    function setLobbyDuration(uint256 newDuration) external override onlyOwner {
        if (newDuration == 0) revert InvalidDuration(newDuration);
        lobbyDuration = newDuration;
        emit LobbyDurationUpdated(newDuration);
    }

    /// @inheritdoc IAmongNads
    function setSettlementTimeout(uint256 newTimeout) external override onlyOwner {
        if (newTimeout == 0) revert InvalidDuration(newTimeout);
        settlementTimeout = newTimeout;
        emit SettlementTimeoutUpdated(newTimeout);
    }

    // ── Oracle Functions ─────────────────────────────────────────────────────

    /// @inheritdoc IAmongNads
    function lockGame(uint256 gameId) external override onlyOwner {
        if (games[gameId].state != GameState.Open) revert InvalidGameState(gameId, games[gameId].state);

        games[gameId].state = GameState.Locked;
        emit GameLocked(gameId);
    }

    /// @inheritdoc IAmongNads
    /// @dev Fee + seed's winning share are returned to houseBalance (no external transfer).
    function settleGame(uint256 gameId, Team winningTeam) external override onlyOwner {
        if (games[gameId].state != GameState.Locked) revert InvalidGameState(gameId, games[gameId].state);

        Game storage game = games[gameId];
        game.state = GameState.Settled;
        game.winningTeam = winningTeam;

        uint256 fee = (game.totalPool * PROTOCOL_FEE_BPS) / 10_000;
        uint256 distributable = game.totalPool - fee;

        uint256 winningPool = (winningTeam == Team.Crewmates) ? game.crewmatesPool : game.impostorsPool;
        uint256 seedInWinning = (winningTeam == Team.Crewmates) ? game.crewmatesSeed : game.impostorsSeed;

        // Seed's proportional share of the distributable stays in contract → houseBalance
        uint256 seedShare = (winningPool > 0) ? (seedInWinning * distributable) / winningPool : distributable; // no winners at all → everything back to house

        houseBalance += fee + seedShare;

        emit GameSettled(gameId, winningTeam);
    }

    // ── Bettor Functions ─────────────────────────────────────────────────────

    /// @inheritdoc IAmongNads
    function placeBet(uint256 gameId, Team team) external payable override {
        uint256 amount = msg.value;

        if (amount < MIN_BET) revert BetBelowMinimum(amount, MIN_BET);
        if (amount > MAX_BET) revert BetExceedsMaximum(amount, MAX_BET);

        // Lazy game creation: first bet for this gameId auto-creates it
        if (games[gameId].state == GameState.Uninitialized) {
            if (gameId != nextGameId) revert InvalidGameId(gameId);
            _createGame();
        }

        Game storage game = games[gameId];

        if (game.state != GameState.Open) {
            revert InvalidGameState(gameId, game.state);
        }

        // DEADLINE CHECK (Anti-Cheat)
        if (block.timestamp > game.bettingDeadline) {
            revert BettingDeadlinePassed(gameId, game.bettingDeadline);
        }

        if (bets[gameId][_msgSender()].bettor != address(0)) {
            revert AlreadyBet(_msgSender());
        }

        // Record bet
        bets[gameId][_msgSender()] = Bet({ bettor: _msgSender(), team: team, amount: amount, claimed: false });

        // Update pool counters
        game.totalPool += amount;
        if (team == Team.Crewmates) {
            game.crewmatesPool += amount;
        } else {
            game.impostorsPool += amount;
        }

        emit BetPlaced(gameId, _msgSender(), team, amount);
    }

    /// @inheritdoc IAmongNads
    function claimPayout(uint256 gameId) external override nonReentrant {
        if (games[gameId].state != GameState.Settled) {
            revert InvalidGameState(gameId, games[gameId].state);
        }

        Bet storage bet = bets[gameId][_msgSender()];
        if (bet.bettor == address(0)) revert NoBetToClaim(_msgSender());
        if (bet.claimed) revert AlreadyClaimed(_msgSender());

        bet.claimed = true;

        if (bet.team != games[gameId].winningTeam) {
            // Loser — marked as claimed, no payout
            return;
        }

        Game memory game = games[gameId];
        uint256 protocolFee = (game.totalPool * PROTOCOL_FEE_BPS) / 10_000;
        uint256 distributable = game.totalPool - protocolFee;

        uint256 winningPool = (game.winningTeam == Team.Crewmates) ? game.crewmatesPool : game.impostorsPool;

        uint256 payout = (bet.amount * distributable) / winningPool;

        (bool ok,) = _msgSender().call{ value: payout }("");
        if (!ok) revert TransferFailed();

        emit PayoutClaimed(gameId, _msgSender(), payout);
    }

    // ── Cancel & Refund ───────────────────────────────────────────────────────

    /// @inheritdoc IAmongNads
    function cancelGame(uint256 gameId) external override onlyOwner {
        GameState state = games[gameId].state;
        if (state != GameState.Open && state != GameState.Locked) revert InvalidGameState(gameId, state);
        _cancelGame(gameId);
    }

    /// @inheritdoc IAmongNads
    function cancelGameByTimeout(uint256 gameId) external override {
        Game storage game = games[gameId];
        if (game.state != GameState.Locked) revert InvalidGameState(gameId, game.state);
        // bettingDeadline marks when betting closed; settlement must happen within SETTLEMENT_TIMEOUT after that
        if (block.timestamp <= game.bettingDeadline + settlementTimeout) revert SettlementTimeoutNotReached(gameId);
        _cancelGame(gameId);
    }

    /// @inheritdoc IAmongNads
    function claimRefund(uint256 gameId) external override nonReentrant {
        if (games[gameId].state != GameState.Cancelled) revert GameNotCancelled(gameId);

        Bet storage bet = bets[gameId][_msgSender()];
        if (bet.bettor == address(0)) revert NoBetToClaim(_msgSender());
        if (bet.claimed) revert AlreadyClaimed(_msgSender());

        bet.claimed = true;
        uint256 refundAmount = bet.amount;

        (bool ok,) = _msgSender().call{ value: refundAmount }("");
        if (!ok) revert TransferFailed();

        emit RefundClaimed(gameId, _msgSender(), refundAmount);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _cancelGame(uint256 gameId) internal {
        Game storage game = games[gameId];
        game.state = GameState.Cancelled;

        // Return seeds to house balance
        uint256 seedTotal = game.crewmatesSeed + game.impostorsSeed;
        houseBalance += seedTotal;

        emit GameCancelled(gameId);
    }

    function _createGame() internal {
        uint256 gameId = nextGameId++;
        games[gameId] = Game({
            id: gameId,
            state: GameState.Open,
            bettingDeadline: block.timestamp + lobbyDuration,
            totalPool: 0,
            crewmatesPool: 0,
            impostorsPool: 0,
            crewmatesSeed: 0,
            impostorsSeed: 0,
            winningTeam: Team.Crewmates // placeholder
        });
        emit GameCreated(gameId, block.timestamp + lobbyDuration);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    /// @inheritdoc IAmongNads
    function getGame(uint256 gameId) external view override returns (Game memory) {
        return games[gameId];
    }

    /// @inheritdoc IAmongNads
    function getBet(uint256 gameId, address bettor) external view override returns (Bet memory) {
        return bets[gameId][bettor];
    }

    /// @inheritdoc IAmongNads
    function hasBets(uint256 gameId) external view override returns (bool) {
        return games[gameId].totalPool > 0;
    }

    /// @inheritdoc IAmongNads
    function hasUserBets(uint256 gameId) external view override returns (bool) {
        Game memory game = games[gameId];
        return game.totalPool > (game.crewmatesSeed + game.impostorsSeed);
    }
}
