// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Test } from "forge-std/Test.sol";
import { AmongNads } from "../src/AmongNads.sol";
import { IAmongNads } from "../src/interfaces/IAmongNads.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract AmongNadsTest is Test {
    AmongNads public game;

    address public alice = address(0x1111111111111111111111111111111111111111);
    address public bob = address(0x2222222222222222222222222222222222222222);
    address public carol = address(0x3333333333333333333333333333333333333333);
    address public eve = address(0x4444444444444444444444444444444444444444);

    // MON constants (18 decimals)
    uint256 constant MON_0_001 = 0.001 ether;
    uint256 constant MON_0_01 = 0.01 ether;
    uint256 constant MON_0_05 = 0.05 ether;
    uint256 constant MON_0_1 = 0.1 ether; // MAX BET
    uint256 constant MON_1 = 1 ether;
    uint256 constant MON_10 = 10 ether;
    uint256 constant MON_100 = 100 ether;

    function setUp() public {
        // Deploy implementation
        AmongNads impl = new AmongNads();

        // Deploy proxy with initialize() calldata
        bytes memory initData = abi.encodeCall(AmongNads.initialize, (address(this)));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        game = AmongNads(payable(proxy));

        // Fund test accounts with MON (ETH in Foundry)
        vm.deal(alice, MON_100);
        vm.deal(bob, MON_100);
        vm.deal(carol, MON_100);
        vm.deal(eve, MON_100);

        // Fund the house pool: owner deposits 10 MON
        vm.deal(address(this), MON_100);
        game.deposit{ value: MON_10 }();
    }

    // Helper: deploy a fresh proxy (for tests that need a clean instance)
    function _deployFreshProxy() internal returns (AmongNads) {
        AmongNads impl = new AmongNads();
        bytes memory initData = abi.encodeCall(AmongNads.initialize, (address(this)));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        return AmongNads(payable(proxy));
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
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve));
        game.upgradeToAndCall(address(newImpl), "");
    }

    function testUpgrade_PreservesState() public {
        // Create some state
        game.seedPool(0, MON_1, MON_1); // 2 MON total
        vm.prank(alice);
        game.placeBet{ value: MON_0_01 }(0, IAmongNads.Team.Crewmates);

        // Upgrade
        AmongNads newImpl = new AmongNads();
        game.upgradeToAndCall(address(newImpl), "");

        // Verify state preserved
        IAmongNads.Game memory g = game.getGame(0);
        assertEq(g.totalPool, MON_1 * 2 + MON_0_01);
        assertEq(g.crewmatesPool, MON_1 + MON_0_01);
        assertEq(g.impostorsPool, MON_1);
        assertEq(game.nextGameId(), 1);
        assertEq(game.houseBalance(), MON_10 - (MON_1 * 2)); // 10 - 2 = 8
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── deposit ──────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testDeposit_Happy() public {
        // setUp already deposited 10 MON, deposit 1 more
        game.deposit{ value: MON_1 }();
        assertEq(game.houseBalance(), MON_10 + MON_1);
        assertEq(address(game).balance, MON_10 + MON_1);
    }

    function testDeposit_OnlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve));
        game.deposit{ value: MON_1 }();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── seedPool ─────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testSeedPool_CreatesGameAndSeeds() public {
        assertEq(game.nextGameId(), 0);

        game.seedPool(0, MON_1, MON_1);

        IAmongNads.Game memory g = game.getGame(0);
        assertEq(uint256(g.state), uint256(IAmongNads.GameState.Open));
        assertEq(g.crewmatesPool, MON_1);
        assertEq(g.impostorsPool, MON_1);
        assertEq(g.crewmatesSeed, MON_1);
        assertEq(g.impostorsSeed, MON_1);
        assertEq(g.totalPool, MON_1 * 2);
        assertEq(game.houseBalance(), MON_10 - (MON_1 * 2));
        assertEq(game.nextGameId(), 1);
        // Check Deadline
        assertEq(g.bettingDeadline, block.timestamp + game.lobbyDuration());
    }

    function testSeedPool_OnlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve));
        game.seedPool(0, MON_1, MON_1);
    }

    function testSeedPool_InsufficientHouseBalance() public {
        // Try to seed more than 10 MON
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.InsufficientHouseBalance.selector, MON_10, MON_10 + MON_1));
        game.seedPool(0, MON_10, MON_1);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── sweep ────────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testSweep_Happy() public {
        uint256 ownerBefore = address(this).balance;
        game.sweep(MON_1);
        assertEq(address(this).balance - ownerBefore, MON_1);
        assertEq(game.houseBalance(), MON_10 - MON_1);
    }

    function testSweep_OnlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve));
        game.sweep(MON_1);
    }

    function testSweep_InsufficientHouseBalance() public {
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.InsufficientHouseBalance.selector, MON_10, MON_10 + 1));
        game.sweep(MON_10 + 1);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── placeBet & Constraints ───────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testPlaceBet_Happy() public {
        assertEq(game.nextGameId(), 0);

        vm.prank(alice);
        game.placeBet{ value: MON_0_01 }(0, IAmongNads.Team.Crewmates);

        IAmongNads.Game memory g = game.getGame(0);
        assertEq(uint256(g.state), uint256(IAmongNads.GameState.Open));
        assertEq(g.totalPool, MON_0_01);
        assertEq(g.crewmatesPool, MON_0_01);
        assertEq(game.nextGameId(), 1);
        assertEq(g.bettingDeadline, block.timestamp + game.lobbyDuration());
    }

    function testPlaceBet_InvalidGameId_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.InvalidGameId.selector, 5));
        game.placeBet{ value: MON_0_01 }(5, IAmongNads.Team.Crewmates);
    }

    function testPlaceBet_BelowMinimum_Reverts() public {
        uint256 tooSmall = 0.0001 ether; // < 0.001 ether min
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.BetBelowMinimum.selector, tooSmall, MON_0_001));
        game.placeBet{ value: tooSmall }(0, IAmongNads.Team.Crewmates);
    }

    function testPlaceBet_AboveMaximum_Reverts() public {
        uint256 tooBig = 0.11 ether; // > 0.1 ether max
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.BetExceedsMaximum.selector, tooBig, MON_0_1));
        game.placeBet{ value: tooBig }(0, IAmongNads.Team.Crewmates);
    }

    function testPlaceBet_DeadlinePassed_Reverts() public {
        game.seedPool(0, MON_1, MON_1); // Game created, deadline set to +180s

        // Warp past deadline
        vm.warp(block.timestamp + game.lobbyDuration() + 1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.BettingDeadlinePassed.selector, 0, block.timestamp - 1));
        game.placeBet{ value: MON_0_01 }(0, IAmongNads.Team.Crewmates);
    }

    function testPlaceBet_DuplicateReverts() public {
        vm.prank(alice);
        game.placeBet{ value: MON_0_01 }(0, IAmongNads.Team.Crewmates);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.AlreadyBet.selector, alice));
        game.placeBet{ value: MON_0_01 }(0, IAmongNads.Team.Impostors);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── settleGame & claimPayout ─────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testFullFlow_ImpostorsWin_WithHousePool() public {
        game.seedPool(0, MON_1, MON_1); // 1 MON each side

        vm.prank(alice);
        game.placeBet{ value: MON_0_1 }(0, IAmongNads.Team.Crewmates); // Max bet
        vm.prank(bob);
        game.placeBet{ value: MON_0_05 }(0, IAmongNads.Team.Impostors);
        vm.prank(carol);
        game.placeBet{ value: MON_0_05 }(0, IAmongNads.Team.Impostors);

        uint256 hbBefore = game.houseBalance();

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Impostors);

        // totalPool = 1 + 1 + 0.1 + 0.05 + 0.05 = 2.2 MON
        uint256 totalPool = 2.2 ether;
        uint256 fee = (totalPool * 10) / 10_000; // 0.1%
        uint256 distributable = totalPool - fee;
        uint256 winPool = MON_1 + MON_0_05 + MON_0_05; // 1.1 MON
        uint256 seedShare = (MON_1 * distributable) / winPool;

        assertEq(game.houseBalance(), hbBefore + fee + seedShare);

        // Claims
        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;

        vm.prank(alice);
        game.claimPayout(0);
        vm.prank(bob);
        game.claimPayout(0);

        // Alice (loser) gets nothing
        assertEq(alice.balance - aliceBefore, 0);

        // Bob (winner) gets share
        // Bob share = (0.05 / 1.1) * 2.09 = 0.095
        uint256 bobPayout = (MON_0_05 * distributable) / winPool;
        assertEq(bob.balance - bobBefore, bobPayout);

        // Fee check: 0.1% of 2.2 = 0.0022
        assertEq(fee, 0.0022 ether);
    }

    function testNoSeed_UserVsUser() public {
        // No seed, just user bets.
        vm.prank(alice);
        game.placeBet{ value: MON_0_1 }(0, IAmongNads.Team.Crewmates);
    }

    // REDOING testNoSeed_UserVsUser with valid amounts
    function testNoSeed_UserVsUser_ValidAmounts() public {
        vm.prank(alice);
        game.placeBet{ value: MON_0_1 }(0, IAmongNads.Team.Crewmates);
        vm.prank(bob);
        game.placeBet{ value: MON_0_1 }(0, IAmongNads.Team.Impostors);

        uint256 hbBefore = game.houseBalance();

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Crewmates);

        // fee = 0.2 * 0.001 = 0.0002
        uint256 fee = (0.2 ether * 10) / 10_000;
        assertEq(game.houseBalance(), hbBefore + fee);

        // Alice claims
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        game.claimPayout(0);
        // distributable = 0.19, alice bet 0.1, winPool = 0.1 → payout = 0.19
        assertEq(alice.balance - aliceBefore, 0.2 ether - fee);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── cancelGame ────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testCancelGame_OpenGame() public {
        game.seedPool(0, MON_1, MON_1);
        vm.prank(alice);
        game.placeBet{ value: MON_0_05 }(0, IAmongNads.Team.Crewmates);

        uint256 hbBefore = game.houseBalance();
        game.cancelGame(0);

        IAmongNads.Game memory g = game.getGame(0);
        assertEq(uint256(g.state), uint256(IAmongNads.GameState.Cancelled));
        // Seeds (2 MON) returned to house
        assertEq(game.houseBalance(), hbBefore + MON_1 * 2);
    }

    function testCancelGame_LockedGame() public {
        game.seedPool(0, MON_1, MON_1);
        vm.prank(alice);
        game.placeBet{ value: MON_0_05 }(0, IAmongNads.Team.Crewmates);
        game.lockGame(0);

        game.cancelGame(0);
        IAmongNads.Game memory g = game.getGame(0);
        assertEq(uint256(g.state), uint256(IAmongNads.GameState.Cancelled));
    }

    function testCancelGame_OnlyOwner() public {
        game.seedPool(0, MON_1, MON_1);
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve));
        game.cancelGame(0);
    }

    function testCancelGame_SettledReverts() public {
        game.seedPool(0, MON_1, MON_1);
        vm.prank(alice);
        game.placeBet{ value: MON_0_05 }(0, IAmongNads.Team.Crewmates);
        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Crewmates);

        vm.expectRevert(abi.encodeWithSelector(IAmongNads.InvalidGameState.selector, 0, IAmongNads.GameState.Settled));
        game.cancelGame(0);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── cancelGameByTimeout ──────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testCancelByTimeout_Happy() public {
        game.seedPool(0, MON_1, MON_1);
        vm.prank(alice);
        game.placeBet{ value: MON_0_05 }(0, IAmongNads.Team.Crewmates);
        game.lockGame(0);

        IAmongNads.Game memory g = game.getGame(0);
        // Warp past bettingDeadline + settlementTimeout
        vm.warp(g.bettingDeadline + game.settlementTimeout() + 1);

        // Anyone can cancel
        vm.prank(eve);
        game.cancelGameByTimeout(0);

        g = game.getGame(0);
        assertEq(uint256(g.state), uint256(IAmongNads.GameState.Cancelled));
    }

    function testCancelByTimeout_TooEarlyReverts() public {
        game.seedPool(0, MON_1, MON_1);
        game.lockGame(0);

        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.SettlementTimeoutNotReached.selector, 0));
        game.cancelGameByTimeout(0);
    }

    function testCancelByTimeout_NotLockedReverts() public {
        game.seedPool(0, MON_1, MON_1);

        vm.expectRevert(abi.encodeWithSelector(IAmongNads.InvalidGameState.selector, 0, IAmongNads.GameState.Open));
        game.cancelGameByTimeout(0);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── claimRefund ──────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testClaimRefund_Happy() public {
        game.seedPool(0, MON_1, MON_1);
        vm.prank(alice);
        game.placeBet{ value: MON_0_05 }(0, IAmongNads.Team.Crewmates);
        vm.prank(bob);
        game.placeBet{ value: MON_0_1 }(0, IAmongNads.Team.Impostors);

        game.cancelGame(0);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;

        vm.prank(alice);
        game.claimRefund(0);
        vm.prank(bob);
        game.claimRefund(0);

        assertEq(alice.balance - aliceBefore, MON_0_05);
        assertEq(bob.balance - bobBefore, MON_0_1);
    }

    function testClaimRefund_NotCancelledReverts() public {
        game.seedPool(0, MON_1, MON_1);
        vm.prank(alice);
        game.placeBet{ value: MON_0_05 }(0, IAmongNads.Team.Crewmates);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.GameNotCancelled.selector, 0));
        game.claimRefund(0);
    }

    function testClaimRefund_DoubleClaimReverts() public {
        game.seedPool(0, MON_1, MON_1);
        vm.prank(alice);
        game.placeBet{ value: MON_0_05 }(0, IAmongNads.Team.Crewmates);
        game.cancelGame(0);

        vm.prank(alice);
        game.claimRefund(0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.AlreadyClaimed.selector, alice));
        game.claimRefund(0);
    }

    function testClaimRefund_NoBetReverts() public {
        game.seedPool(0, MON_1, MON_1);
        game.cancelGame(0);

        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.NoBetToClaim.selector, eve));
        game.claimRefund(0);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── setLobbyDuration & setSettlementTimeout ────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testSetLobbyDuration_Happy() public {
        game.setLobbyDuration(300);
        assertEq(game.lobbyDuration(), 300);

        // New game uses updated duration
        game.seedPool(0, MON_1, MON_1);
        IAmongNads.Game memory g = game.getGame(0);
        assertEq(g.bettingDeadline, block.timestamp + 300);
    }

    function testSetLobbyDuration_OnlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve));
        game.setLobbyDuration(300);
    }

    function testSetLobbyDuration_ZeroReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.InvalidDuration.selector, 0));
        game.setLobbyDuration(0);
    }

    function testSetSettlementTimeout_Happy() public {
        game.setSettlementTimeout(2 hours);
        assertEq(game.settlementTimeout(), 2 hours);

        // Verify timeout uses new value
        game.seedPool(0, MON_1, MON_1);
        vm.prank(alice);
        game.placeBet{ value: MON_0_05 }(0, IAmongNads.Team.Crewmates);
        game.lockGame(0);

        IAmongNads.Game memory g = game.getGame(0);

        // 1 hour should NOT be enough anymore
        vm.warp(g.bettingDeadline + 1 hours + 1);
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.SettlementTimeoutNotReached.selector, 0));
        game.cancelGameByTimeout(0);

        // 2 hours should work
        vm.warp(g.bettingDeadline + 2 hours + 1);
        vm.prank(eve);
        game.cancelGameByTimeout(0);

        g = game.getGame(0);
        assertEq(uint256(g.state), uint256(IAmongNads.GameState.Cancelled));
    }

    function testSetSettlementTimeout_OnlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, eve));
        game.setSettlementTimeout(2 hours);
    }

    function testSetSettlementTimeout_ZeroReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IAmongNads.InvalidDuration.selector, 0));
        game.setSettlementTimeout(0);
    }

    // Needed to receive ETH from sweep()
    receive() external payable { }
}
