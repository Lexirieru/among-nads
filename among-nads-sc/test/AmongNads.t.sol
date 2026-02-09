// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/AmongNads.sol";
import "../src/MockUSDC.sol";
import "../src/interfaces/IAmongNads.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract AmongNadsTest is Test {
    AmongNads public game;
    MockUSDC  public usdc;

    address public alice = address(0x1111111111111111111111111111111111111111);
    address public bob   = address(0x2222222222222222222222222222222222222222);
    address public carol = address(0x3333333333333333333333333333333333333333);
    address public eve   = address(0x4444444444444444444444444444444444444444);

    uint256 constant USDC_1    = 1e6;
    uint256 constant USDC_10   = 10e6;
    uint256 constant USDC_20   = 20e6;
    uint256 constant USDC_30   = 30e6;
    uint256 constant USDC_40   = 40e6;
    uint256 constant USDC_50   = 50e6;
    uint256 constant USDC_100  = 100e6;
    uint256 constant USDC_500  = 500e6;
    uint256 constant USDC_1000 = 1000e6;
    uint256 constant USDC_10K  = 10_000e6;

    function setUp() public {
        usdc = new MockUSDC();

        // Deploy implementation
        AmongNads impl = new AmongNads();

        // Deploy proxy with initialize() calldata
        bytes memory initData = abi.encodeCall(AmongNads.initialize, (address(this)));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        game = AmongNads(address(proxy));

        game.setBetToken(address(usdc));

        // Mint USDC to test accounts and approve
        usdc.mint(alice, USDC_100);
        usdc.mint(bob,   USDC_100);
        usdc.mint(carol, USDC_100);
        usdc.mint(eve,   USDC_100);

        vm.prank(alice);
        usdc.approve(address(game), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(game), type(uint256).max);
        vm.prank(carol);
        usdc.approve(address(game), type(uint256).max);
        vm.prank(eve);
        usdc.approve(address(game), type(uint256).max);

        // Fund the house pool: owner deposits 10,000 USDC
        usdc.mint(address(this), USDC_10K);
        usdc.approve(address(game), type(uint256).max);
        game.deposit(USDC_10K);
    }

    // Helper: deploy a fresh proxy (for tests that need a clean instance)
    function _deployFreshProxy() internal returns (AmongNads) {
        AmongNads impl = new AmongNads();
        bytes memory initData = abi.encodeCall(AmongNads.initialize, (address(this)));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        return AmongNads(address(proxy));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── UUPS Upgrade ──────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testUpgrade_OwnerCanUpgrade() public {
        AmongNads newImpl = new AmongNads();
        game.upgradeToAndCall(address(newImpl), "");
        // Should succeed without revert
    }

    function testUpgrade_NonOwnerReverts() public {
        AmongNads newImpl = new AmongNads();
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(
            OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve
        ));
        game.upgradeToAndCall(address(newImpl), "");
    }

    function testUpgrade_PreservesState() public {
        // Create some state
        game.seedPool(0, USDC_500, USDC_500);
        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);

        // Upgrade
        AmongNads newImpl = new AmongNads();
        game.upgradeToAndCall(address(newImpl), "");

        // Verify state preserved
        IAmongNads.Game memory g = game.getGame(0);
        assertEq(g.totalPool, USDC_1000 + USDC_10);
        assertEq(g.crewmatesPool, USDC_500 + USDC_10);
        assertEq(g.impostorsPool, USDC_500);
        assertEq(game.nextGameId(), 1);
        assertEq(game.houseBalance(), USDC_10K - USDC_1000);
    }

    function testInitialize_CannotReinitialize() public {
        vm.expectRevert();
        game.initialize(eve);
    }

    function testImplementation_CannotInitialize() public {
        AmongNads impl = new AmongNads();
        vm.expectRevert();
        impl.initialize(address(this));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── setBetToken ──────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testSetBetToken_Happy() public {
        AmongNads fresh = _deployFreshProxy();
        fresh.setBetToken(address(usdc));
        assertEq(address(fresh.betToken()), address(usdc));
    }

    function testSetBetToken_OnlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(
            OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve
        ));
        game.setBetToken(address(usdc));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── deposit ──────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testDeposit_Happy() public {
        // setUp already deposited 10K, deposit more
        usdc.mint(address(this), USDC_1000);
        game.deposit(USDC_1000);
        assertEq(game.houseBalance(), USDC_10K + USDC_1000);
        assertEq(usdc.balanceOf(address(game)), USDC_10K + USDC_1000);
    }

    function testDeposit_OnlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(
            OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve
        ));
        game.deposit(USDC_100);
    }

    function testDeposit_BetTokenNotSet() public {
        AmongNads fresh = _deployFreshProxy();
        vm.expectRevert(IAmongNads.BetTokenNotSet.selector);
        fresh.deposit(USDC_100);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── seedPool ─────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testSeedPool_CreatesGameAndSeeds() public {
        assertEq(game.nextGameId(), 0);

        game.seedPool(0, USDC_500, USDC_500);

        IAmongNads.Game memory g = game.getGame(0);
        assertEq(uint(g.state), uint(IAmongNads.GameState.Open));
        assertEq(g.crewmatesPool, USDC_500);
        assertEq(g.impostorsPool, USDC_500);
        assertEq(g.crewmatesSeed, USDC_500);
        assertEq(g.impostorsSeed, USDC_500);
        assertEq(g.totalPool, USDC_1000);
        assertEq(game.houseBalance(), USDC_10K - USDC_1000);
        assertEq(game.nextGameId(), 1);
    }

    function testSeedPool_OnlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(
            OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve
        ));
        game.seedPool(0, USDC_500, USDC_500);
    }

    function testSeedPool_InsufficientHouseBalance() public {
        vm.expectRevert(abi.encodeWithSelector(
            IAmongNads.InsufficientHouseBalance.selector, USDC_10K, USDC_10K + USDC_1000
        ));
        game.seedPool(0, USDC_10K, USDC_1000);
    }

    function testSeedPool_CanSeedExistingOpenGame() public {
        // First seed creates game
        game.seedPool(0, USDC_500, USDC_500);
        // Second seed adds more to the same game
        game.seedPool(0, USDC_100, USDC_100);

        IAmongNads.Game memory g = game.getGame(0);
        assertEq(g.crewmatesSeed, USDC_500 + USDC_100);
        assertEq(g.impostorsSeed, USDC_500 + USDC_100);
        assertEq(g.totalPool, USDC_1000 + USDC_100 * 2);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── sweep ────────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testSweep_Happy() public {
        uint256 ownerBefore = usdc.balanceOf(address(this));
        game.sweep(USDC_1000);
        assertEq(usdc.balanceOf(address(this)) - ownerBefore, USDC_1000);
        assertEq(game.houseBalance(), USDC_10K - USDC_1000);
    }

    function testSweep_OnlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(
            OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve
        ));
        game.sweep(USDC_100);
    }

    function testSweep_InsufficientHouseBalance() public {
        vm.expectRevert(abi.encodeWithSelector(
            IAmongNads.InsufficientHouseBalance.selector, USDC_10K, USDC_10K + 1
        ));
        game.sweep(USDC_10K + 1);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── Lazy Game Creation (via placeBet) ────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testPlaceBet_LazyCreatesGame() public {
        assertEq(game.nextGameId(), 0);

        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);

        IAmongNads.Game memory g = game.getGame(0);
        assertEq(uint(g.state), uint(IAmongNads.GameState.Open));
        assertEq(g.totalPool, USDC_10);
        assertEq(g.crewmatesPool, USDC_10);
        assertEq(g.crewmatesSeed, 0); // no seed, just user bet
        assertEq(game.nextGameId(), 1);
    }

    function testPlaceBet_InvalidGameId_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.InvalidGameId.selector, 5));
        game.placeBet(5, IAmongNads.Team.Crewmates, USDC_10);
    }

    function testPlaceBet_BetTokenNotSet_Reverts() public {
        AmongNads fresh = _deployFreshProxy();
        vm.prank(alice);
        vm.expectRevert(IAmongNads.BetTokenNotSet.selector);
        fresh.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);
    }

    function testPlaceBet_BelowMinimum_Reverts() public {
        uint256 tooSmall = 500_000; // 0.5 USDC < 1 USDC min
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(
            IAmongNads.BetBelowMinimum.selector, tooSmall, USDC_1
        ));
        game.placeBet(0, IAmongNads.Team.Crewmates, tooSmall);
    }

    function testPlaceBet_DuplicateReverts() public {
        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.AlreadyBet.selector, alice));
        game.placeBet(0, IAmongNads.Team.Impostors, USDC_10);
    }

    function testPlaceBet_RejectsWhenLocked() public {
        game.seedPool(0, USDC_500, USDC_500);
        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);
        game.lockGame(0);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(
            IAmongNads.InvalidGameState.selector, 0, uint(IAmongNads.GameState.Locked)
        ));
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── hasBets / hasUserBets ────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testHasBets_FalseWhenNoGame() public view {
        assertFalse(game.hasBets(0));
    }

    function testHasBets_TrueAfterSeed() public {
        game.seedPool(0, USDC_500, USDC_500);
        assertTrue(game.hasBets(0));
    }

    function testHasUserBets_FalseWhenOnlySeed() public {
        game.seedPool(0, USDC_500, USDC_500);
        assertFalse(game.hasUserBets(0));
    }

    function testHasUserBets_TrueAfterUserBet() public {
        game.seedPool(0, USDC_500, USDC_500);
        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);
        assertTrue(game.hasUserBets(0));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── lockGame ─────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testLockGame_Happy() public {
        game.seedPool(0, USDC_500, USDC_500);
        game.lockGame(0);

        IAmongNads.Game memory g = game.getGame(0);
        assertEq(uint(g.state), uint(IAmongNads.GameState.Locked));
    }

    function testLockGame_OnlyOwner() public {
        game.seedPool(0, USDC_500, USDC_500);
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(
            OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve
        ));
        game.lockGame(0);
    }

    function testLockGame_RejectsIfNotOpen() public {
        vm.expectRevert(abi.encodeWithSelector(
            IAmongNads.InvalidGameState.selector, 0, uint(IAmongNads.GameState.Uninitialized)
        ));
        game.lockGame(0);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── settleGame (houseBalance accounting) ─────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testSettleGame_Happy() public {
        game.seedPool(0, USDC_500, USDC_500);
        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Crewmates);

        IAmongNads.Game memory g = game.getGame(0);
        assertEq(uint(g.state), uint(IAmongNads.GameState.Settled));
        assertEq(uint(g.winningTeam), uint(IAmongNads.Team.Crewmates));
    }

    function testSettleGame_SeedOnlyRecoversAll() public {
        // Seed only, no user bets. House should get everything back.
        game.seedPool(0, USDC_500, USDC_500);
        uint256 hbBefore = game.houseBalance();

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Crewmates);

        // fee = 1000 * 500 / 10000 = 50
        // distributable = 950
        // seedInWinning = 500, winningPool = 500
        // seedShare = (500/500) * 950 = 950
        // houseBalance += 50 + 950 = 1000
        assertEq(game.houseBalance(), hbBefore + USDC_1000);
    }

    function testSettleGame_FeeAndSeedShareToHouse() public {
        // Seed 500/500, alice bets 10 on Crewmates. Crewmates win.
        game.seedPool(0, USDC_500, USDC_500);
        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);

        uint256 hbBefore = game.houseBalance();

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Crewmates);

        // totalPool = 1010, fee = 50.5 (50_500_000 in 6 dec)
        uint256 totalPool = USDC_1000 + USDC_10;
        uint256 fee = (totalPool * 500) / 10_000;
        uint256 distributable = totalPool - fee;
        // winningPool = 510 (500 seed + 10 alice), seedInWinning = 500
        uint256 seedShare = (USDC_500 * distributable) / (USDC_500 + USDC_10);

        assertEq(game.houseBalance(), hbBefore + fee + seedShare);
    }

    function testSettleGame_OnlyOwner() public {
        game.seedPool(0, USDC_500, USDC_500);
        game.lockGame(0);

        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(
            OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve
        ));
        game.settleGame(0, IAmongNads.Team.Crewmates);
    }

    function testSettleGame_RejectsIfNotLocked() public {
        game.seedPool(0, USDC_500, USDC_500);

        vm.expectRevert(abi.encodeWithSelector(
            IAmongNads.InvalidGameState.selector, 0, uint(IAmongNads.GameState.Open)
        ));
        game.settleGame(0, IAmongNads.Team.Crewmates);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── claimPayout ──────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Scenario: house pool + user bets
     *   Seed: 500 Crewmates, 500 Impostors
     *   Alice bets 20 USDC on Crewmates
     *   Bob   bets 30 USDC on Crewmates
     *   Carol bets 50 USDC on Impostors
     *   Winner: Crewmates
     *
     *   totalPool       = 1100 USDC
     *   fee             = 1100 * 500 / 10000 = 55 USDC
     *   distributable   = 1045 USDC
     *   crewmatesPool   = 550 (500 seed + 20 alice + 30 bob)
     *
     *   Alice payout = (20 / 550) * 1045 = 38.000000 (38_000_000)
     *   Bob   payout = (30 / 550) * 1045 = 57.000000 (57_000_000)
     *   Carol payout = 0 (loser)
     *   Seed share   = (500 / 550) * 1045 = 950.000000 → houseBalance
     */
    function testClaimPayout_WithHousePool() public {
        game.seedPool(0, USDC_500, USDC_500);

        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_20);
        vm.prank(bob);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_30);
        vm.prank(carol);
        game.placeBet(0, IAmongNads.Team.Impostors, USDC_50);

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Crewmates);

        uint256 totalPool = USDC_1000 + USDC_100; // 1100
        uint256 fee = (totalPool * 500) / 10_000;  // 55
        uint256 distributable = totalPool - fee;    // 1045
        uint256 winPool = USDC_500 + USDC_50;       // 550 (500 seed + 20 + 30)

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore   = usdc.balanceOf(bob);
        uint256 carolBefore = usdc.balanceOf(carol);

        vm.prank(alice);
        game.claimPayout(0);
        vm.prank(bob);
        game.claimPayout(0);
        vm.prank(carol);
        game.claimPayout(0);

        assertEq(usdc.balanceOf(alice) - aliceBefore, (USDC_20 * distributable) / winPool);
        assertEq(usdc.balanceOf(bob)   - bobBefore,   (USDC_30 * distributable) / winPool);
        assertEq(usdc.balanceOf(carol) - carolBefore,  0);
    }

    function testClaimPayout_DoubleClaim_Reverts() public {
        game.seedPool(0, USDC_500, USDC_500);
        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Crewmates);

        vm.prank(alice);
        game.claimPayout(0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.AlreadyClaimed.selector, alice));
        game.claimPayout(0);
    }

    function testClaimPayout_NoBet_Reverts() public {
        game.seedPool(0, USDC_500, USDC_500);
        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Crewmates);

        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.NoBetToClaim.selector, eve));
        game.claimPayout(0);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── House Pool: single user bet scenarios ────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Single user bets on winning side.
     *   Seed: 500/500, Alice bets 10 on Crewmates. Crewmates win.
     *   crewmatesPool = 510, impostorsPool = 500, total = 1010
     *   fee = 50.5, distributable = 959.5
     *   Alice payout = (10/510) * 959.5 = 18.81 (approx)
     *   seedShare = (500/510) * 959.5 = 940.69 → houseBalance
     */
    function testHousePool_SingleUserWins() public {
        game.seedPool(0, USDC_500, USDC_500);

        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);

        uint256 hbBefore = game.houseBalance();

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Crewmates);

        // Alice claims
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        game.claimPayout(0);

        uint256 totalPool = USDC_1000 + USDC_10;
        uint256 fee = (totalPool * 500) / 10_000;
        uint256 distributable = totalPool - fee;
        uint256 alicePayout = (USDC_10 * distributable) / (USDC_500 + USDC_10);

        assertEq(usdc.balanceOf(alice) - aliceBefore, alicePayout);
        // Alice profit: payout - bet
        assertTrue(alicePayout > USDC_10);

        // House lost a bit (alice's profit came from house seed)
        uint256 seedShare = (USDC_500 * distributable) / (USDC_500 + USDC_10);
        assertEq(game.houseBalance(), hbBefore + fee + seedShare);
    }

    /**
     * Single user bets on losing side.
     *   Seed: 500/500, Alice bets 10 on Crewmates. Impostors win.
     *   impostorsPool = 500 (all seed), crewmatesPool = 510
     *   fee = 50.5, distributable = 959.5
     *   seedShare = (500/500) * 959.5 = 959.5 → all goes to houseBalance
     *   Alice gets nothing.
     */
    function testHousePool_SingleUserLoses() public {
        game.seedPool(0, USDC_500, USDC_500);

        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);

        uint256 hbBefore = game.houseBalance();

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Impostors);

        // Alice claims (loser — no payout)
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        game.claimPayout(0);
        assertEq(usdc.balanceOf(alice), aliceBefore); // nothing

        // House gets everything: fee + full distributable (since only seed on winning side)
        uint256 totalPool = USDC_1000 + USDC_10;
        uint256 fee = (totalPool * 500) / 10_000;
        uint256 distributable = totalPool - fee;
        // seedInWinning = 500, winningPool = 500 → seedShare = distributable
        assertEq(game.houseBalance(), hbBefore + fee + distributable);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── Rolling pool: multi-game flow ────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testRollingPool_MultiGame() public {
        // Game 0: seed 500/500, alice bets 10 crewmates, crewmates win
        game.seedPool(0, USDC_500, USDC_500);
        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_10);

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Crewmates);

        vm.prank(alice);
        game.claimPayout(0);

        uint256 hbAfterGame0 = game.houseBalance();
        assertTrue(hbAfterGame0 > 0); // house still has funds

        // Game 1: seed from remaining houseBalance
        game.seedPool(1, USDC_500, USDC_500);
        vm.prank(bob);
        game.placeBet(1, IAmongNads.Team.Impostors, USDC_20);

        game.lockGame(1);
        game.settleGame(1, IAmongNads.Team.Impostors);

        vm.prank(bob);
        game.claimPayout(1);

        // Both games settled
        assertEq(uint(game.getGame(0).state), uint(IAmongNads.GameState.Settled));
        assertEq(uint(game.getGame(1).state), uint(IAmongNads.GameState.Settled));
        assertEq(game.nextGameId(), 2);

        // House balance still positive (rolling pool works)
        assertTrue(game.houseBalance() > 0);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── No-bets flow ─────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testNoBetsFlow_NoOnChainCalls() public view {
        // When nobody seeds or bets, nextGameId stays at 0
        assertEq(game.nextGameId(), 0);
        assertFalse(game.hasBets(0));
        assertFalse(game.hasUserBets(0));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── Pure user-vs-user (no seed) ──────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testNoSeed_UserVsUser() public {
        // No seed, just user bets. Fee goes to houseBalance.
        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_50);
        vm.prank(bob);
        game.placeBet(0, IAmongNads.Team.Impostors, USDC_50);

        uint256 hbBefore = game.houseBalance();

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Crewmates);

        // fee = 100 * 500 / 10000 = 5 USDC
        // seedInWinning = 0 → seedShare = 0
        // houseBalance += fee only
        uint256 fee = (USDC_100 * 500) / 10_000;
        assertEq(game.houseBalance(), hbBefore + fee);

        // Alice claims
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        game.claimPayout(0);
        // distributable = 95, alice bet 50, winPool = 50 → payout = 95
        assertEq(usdc.balanceOf(alice) - aliceBefore, USDC_100 - fee);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── Full E2E with house pool ─────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Full flow:
     *   1. Owner deposited 10K in setUp
     *   2. Seed game 0: 500/500
     *   3. Alice bets 40 Crewmates, Bob bets 10 Impostors, Carol bets 50 Impostors
     *   4. Impostors win
     *   5. Alice (loser), Bob + Carol (winners) claim
     *   6. Verify house balance and payouts
     */
    function testFullFlow_ImpostorsWin_WithHousePool() public {
        game.seedPool(0, USDC_500, USDC_500);

        vm.prank(alice);
        game.placeBet(0, IAmongNads.Team.Crewmates, USDC_40);
        vm.prank(bob);
        game.placeBet(0, IAmongNads.Team.Impostors, USDC_10);
        vm.prank(carol);
        game.placeBet(0, IAmongNads.Team.Impostors, USDC_50);

        uint256 hbBefore = game.houseBalance();

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Impostors);

        // totalPool = 1100, fee = 55
        uint256 totalPool = USDC_1000 + USDC_100;
        uint256 fee = (totalPool * 500) / 10_000; // 55e6
        uint256 distributable = totalPool - fee;   // 1045e6
        uint256 winPool = USDC_500 + USDC_10 + USDC_50; // 560 (seed 500 + bob 10 + carol 50)
        uint256 seedShare = (USDC_500 * distributable) / winPool;

        assertEq(game.houseBalance(), hbBefore + fee + seedShare);

        // Claims
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore   = usdc.balanceOf(bob);
        uint256 carolBefore = usdc.balanceOf(carol);

        vm.prank(alice);
        game.claimPayout(0);
        vm.prank(bob);
        game.claimPayout(0);
        vm.prank(carol);
        game.claimPayout(0);

        assertEq(usdc.balanceOf(alice) - aliceBefore, 0); // loser
        assertEq(usdc.balanceOf(bob)   - bobBefore,   (USDC_10  * distributable) / winPool);
        assertEq(usdc.balanceOf(carol) - carolBefore,  (USDC_50 * distributable) / winPool);
    }
}
