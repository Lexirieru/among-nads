// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./interfaces/IAmongNads.sol";
import "./interfaces/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title AmongNads Prediction Market (v3 — Rolling House Pool, UUPS Upgradeable)
 * @notice ERC20-based prediction betting with a house-pool (bandar) model.
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
contract AmongNads is IAmongNads, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // ── Constants ────────────────────────────────────────────────────────────

    /// @notice Minimum bet size: 1 USDC (6 decimals)
    uint256 public constant MIN_BET = 1e6;

    /// @notice Protocol fee in basis-points (5 % = 500 bps out of 10 000)
    uint256 public constant PROTOCOL_FEE_BPS = 500;

    // ── State ────────────────────────────────────────────────────────────────

    /// @notice Auto-incrementing game counter. Next game will use this ID.
    uint256 public nextGameId;

    /// @notice ERC20 token used for betting (e.g. USDC). Set by owner via setBetToken().
    IERC20 public betToken;

    /// @notice Owner's rolling house-pool balance inside this contract.
    uint256 public houseBalance;

    /// @notice Game metadata keyed by gameId
    mapping(uint256 => Game) public games;

    /// @notice Per-bettor record: gameId → bettor address → Bet
    mapping(uint256 => mapping(address => Bet)) public bets;

    // ── Constructor (disable initializers on implementation) ─────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ── Initializer ─────────────────────────────────────────────────────────

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
    }

    // ── UUPS ────────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ── Owner Configuration ─────────────────────────────────────────────────

    /// @notice Set the ERC20 token used for betting. Can only be called by owner.
    function setBetToken(address _token) external onlyOwner {
        betToken = IERC20(_token);
        emit BetTokenSet(_token);
    }

    // ── House Pool (Rolling Pool) ───────────────────────────────────────────

    /// @notice Owner deposits USDC into the rolling house pool. Call once, reuse across games.
    function deposit(uint256 amount) external override onlyOwner {
        if (address(betToken) == address(0)) revert BetTokenNotSet();
        bool ok = betToken.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();
        houseBalance += amount;
        emit Deposited(amount);
    }

    /// @notice Allocate from houseBalance into a game's pools. No USDC transfer — just accounting.
    ///         Auto-creates the game if it doesn't exist yet.
    function seedPool(uint256 gameId, uint256 crewAmount, uint256 impAmount)
        external override onlyOwner
    {
        uint256 total = crewAmount + impAmount;
        if (houseBalance < total)
            revert InsufficientHouseBalance(houseBalance, total);

        // Lazy game creation
        if (games[gameId].state == GameState.Uninitialized) {
            if (gameId != nextGameId) revert InvalidGameId(gameId);
            _createGame();
        }

        if (games[gameId].state != GameState.Open)
            revert InvalidGameState(gameId, games[gameId].state);

        houseBalance -= total;

        Game storage game = games[gameId];
        game.crewmatesPool += crewAmount;
        game.impostorsPool += impAmount;
        game.crewmatesSeed += crewAmount;
        game.impostorsSeed += impAmount;
        game.totalPool     += total;

        emit PoolSeeded(gameId, crewAmount, impAmount);
    }

    /// @notice Owner withdraws USDC from houseBalance.
    function sweep(uint256 amount) external override onlyOwner {
        if (houseBalance < amount)
            revert InsufficientHouseBalance(houseBalance, amount);
        houseBalance -= amount;
        bool ok = betToken.transfer(owner(), amount);
        if (!ok) revert TransferFailed();
        emit Swept(amount);
    }

    // ── Oracle Functions ─────────────────────────────────────────────────────

    /// @inheritdoc IAmongNads
    function lockGame(uint256 gameId)
        external override onlyOwner
    {
        if (games[gameId].state != GameState.Open)
            revert InvalidGameState(gameId, games[gameId].state);

        games[gameId].state = GameState.Locked;
        emit GameLocked(gameId);
    }

    /// @inheritdoc IAmongNads
    /// @dev Fee + seed's winning share are returned to houseBalance (no external transfer).
    function settleGame(uint256 gameId, Team winningTeam)
        external override onlyOwner
    {
        if (games[gameId].state != GameState.Locked)
            revert InvalidGameState(gameId, games[gameId].state);

        Game storage game = games[gameId];
        game.state       = GameState.Settled;
        game.winningTeam = winningTeam;

        uint256 fee           = (game.totalPool * PROTOCOL_FEE_BPS) / 10_000;
        uint256 distributable = game.totalPool - fee;

        uint256 winningPool   = (winningTeam == Team.Crewmates)
            ? game.crewmatesPool
            : game.impostorsPool;
        uint256 seedInWinning = (winningTeam == Team.Crewmates)
            ? game.crewmatesSeed
            : game.impostorsSeed;

        // Seed's proportional share of the distributable stays in contract → houseBalance
        uint256 seedShare = (winningPool > 0)
            ? (seedInWinning * distributable) / winningPool
            : distributable; // no winners at all → everything back to house

        houseBalance += fee + seedShare;

        emit GameSettled(gameId, winningTeam);
    }

    // ── Bettor Functions ─────────────────────────────────────────────────────

    /// @inheritdoc IAmongNads
    function placeBet(uint256 gameId, Team team, uint256 amount)
        external override
    {
        if (address(betToken) == address(0)) revert BetTokenNotSet();
        if (amount < MIN_BET) revert BetBelowMinimum(amount, MIN_BET);

        // Lazy game creation: first bet for this gameId auto-creates it
        if (games[gameId].state == GameState.Uninitialized) {
            if (gameId != nextGameId) revert InvalidGameId(gameId);
            _createGame();
        }

        if (games[gameId].state != GameState.Open)
            revert InvalidGameState(gameId, games[gameId].state);

        if (bets[gameId][msg.sender].bettor != address(0))
            revert AlreadyBet(msg.sender);

        // Pull USDC from bettor (requires prior approval)
        bool ok = betToken.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        // Record bet
        bets[gameId][msg.sender] = Bet({
            bettor:  msg.sender,
            team:    team,
            amount:  amount,
            claimed: false
        });

        // Update pool counters
        Game storage game = games[gameId];
        game.totalPool += amount;
        if (team == Team.Crewmates) {
            game.crewmatesPool += amount;
        } else {
            game.impostorsPool += amount;
        }

        emit BetPlaced(gameId, msg.sender, team, amount);
    }

    /// @inheritdoc IAmongNads
    function claimPayout(uint256 gameId) external override {
        if (games[gameId].state != GameState.Settled)
            revert InvalidGameState(gameId, games[gameId].state);

        Bet storage bet = bets[gameId][msg.sender];
        if (bet.bettor == address(0))  revert NoBetToClaim(msg.sender);
        if (bet.claimed)               revert AlreadyClaimed(msg.sender);

        bet.claimed = true;

        if (bet.team != games[gameId].winningTeam) {
            // Loser — marked as claimed, no payout
            return;
        }

        Game memory game = games[gameId];
        uint256 protocolFee   = (game.totalPool * PROTOCOL_FEE_BPS) / 10_000;
        uint256 distributable = game.totalPool - protocolFee;

        uint256 winningPool = (game.winningTeam == Team.Crewmates)
            ? game.crewmatesPool
            : game.impostorsPool;

        uint256 payout = (bet.amount * distributable) / winningPool;

        bool ok = betToken.transfer(msg.sender, payout);
        if (!ok) revert TransferFailed();

        emit PayoutClaimed(gameId, msg.sender, payout);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _createGame() internal {
        uint256 gameId = nextGameId++;
        games[gameId] = Game({
            id:            gameId,
            state:         GameState.Open,
            totalPool:     0,
            crewmatesPool: 0,
            impostorsPool: 0,
            crewmatesSeed: 0,
            impostorsSeed: 0,
            winningTeam:   Team.Crewmates // placeholder
        });
        emit GameCreated(gameId);
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
