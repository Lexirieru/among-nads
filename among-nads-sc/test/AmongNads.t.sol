// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/AmongNads.sol";
import "../src/interfaces/IAmongNads.sol";
import {
    ERC1967Proxy
} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {
    OwnableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

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
        bytes memory initData = abi.encodeCall(
            AmongNads.initialize,
            (address(this))
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        game = AmongNads(address(proxy));

        // Fund test accounts with MON (ETH in Foundry)
        vm.deal(alice, MON_100);
        vm.deal(bob, MON_100);
        vm.deal(carol, MON_100);
        vm.deal(eve, MON_100);

        // Fund the house pool: owner deposits 10 MON
        vm.deal(address(this), MON_100);
        game.deposit{value: MON_10}();
    }

    // Helper: deploy a fresh proxy (for tests that need a clean instance)
    function _deployFreshProxy() internal returns (AmongNads) {
        AmongNads impl = new AmongNads();
        bytes memory initData = abi.encodeCall(
            AmongNads.initialize,
            (address(this))
        );
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
        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                eve
            )
        );
        game.upgradeToAndCall(address(newImpl), "");
    }

    function testUpgrade_PreservesState() public {
        // Create some state
        game.seedPool(0, MON_1, MON_1); // 2 MON total
        vm.prank(alice);
        game.placeBet{value: MON_0_01}(0, IAmongNads.Team.Crewmates);

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
        game.deposit{value: MON_1}();
        assertEq(game.houseBalance(), MON_10 + MON_1);
        assertEq(address(game).balance, MON_10 + MON_1);
    }

    function testDeposit_OnlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                eve
            )
        );
        game.deposit{value: MON_1}();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── seedPool ─────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testSeedPool_CreatesGameAndSeeds() public {
        assertEq(game.nextGameId(), 0);

        game.seedPool(0, MON_1, MON_1);

        IAmongNads.Game memory g = game.getGame(0);
        assertEq(uint(g.state), uint(IAmongNads.GameState.Open));
        assertEq(g.crewmatesPool, MON_1);
        assertEq(g.impostorsPool, MON_1);
        assertEq(g.crewmatesSeed, MON_1);
        assertEq(g.impostorsSeed, MON_1);
        assertEq(g.totalPool, MON_1 * 2);
        assertEq(game.houseBalance(), MON_10 - (MON_1 * 2));
        assertEq(game.nextGameId(), 1);
        // Check Deadline
        assertEq(g.bettingDeadline, block.timestamp + 180);
    }

    function testSeedPool_OnlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                eve
            )
        );
        game.seedPool(0, MON_1, MON_1);
    }

    function testSeedPool_InsufficientHouseBalance() public {
        // Try to seed more than 10 MON
        vm.expectRevert(
            abi.encodeWithSelector(
                IAmongNads.InsufficientHouseBalance.selector,
                MON_10,
                MON_10 + MON_1
            )
        );
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
        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector,
                eve
            )
        );
        game.sweep(MON_1);
    }

    function testSweep_InsufficientHouseBalance() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAmongNads.InsufficientHouseBalance.selector,
                MON_10,
                MON_10 + 1
            )
        );
        game.sweep(MON_10 + 1);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── placeBet & Constraints ───────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testPlaceBet_Happy() public {
        assertEq(game.nextGameId(), 0);

        vm.prank(alice);
        game.placeBet{value: MON_0_01}(0, IAmongNads.Team.Crewmates);

        IAmongNads.Game memory g = game.getGame(0);
        assertEq(uint(g.state), uint(IAmongNads.GameState.Open));
        assertEq(g.totalPool, MON_0_01);
        assertEq(g.crewmatesPool, MON_0_01);
        assertEq(game.nextGameId(), 1);
        assertEq(g.bettingDeadline, block.timestamp + 180);
    }

    function testPlaceBet_InvalidGameId_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IAmongNads.InvalidGameId.selector, 5)
        );
        game.placeBet{value: MON_0_01}(5, IAmongNads.Team.Crewmates);
    }

    function testPlaceBet_BelowMinimum_Reverts() public {
        uint256 tooSmall = 0.0001 ether; // < 0.001 ether min
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAmongNads.BetBelowMinimum.selector,
                tooSmall,
                MON_0_001
            )
        );
        game.placeBet{value: tooSmall}(0, IAmongNads.Team.Crewmates);
    }

    function testPlaceBet_AboveMaximum_Reverts() public {
        uint256 tooBig = 0.11 ether; // > 0.1 ether max
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAmongNads.BetExceedsMaximum.selector,
                tooBig,
                MON_0_1
            )
        );
        game.placeBet{value: tooBig}(0, IAmongNads.Team.Crewmates);
    }

    function testPlaceBet_DeadlinePassed_Reverts() public {
        game.seedPool(0, MON_1, MON_1); // Game created, deadline set to +180s

        // Warp past deadline
        vm.warp(block.timestamp + 181);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAmongNads.BettingDeadlinePassed.selector,
                0,
                block.timestamp - 1
            )
        );
        game.placeBet{value: MON_0_01}(0, IAmongNads.Team.Crewmates);
    }

    function testPlaceBet_DuplicateReverts() public {
        vm.prank(alice);
        game.placeBet{value: MON_0_01}(0, IAmongNads.Team.Crewmates);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IAmongNads.AlreadyBet.selector, alice)
        );
        game.placeBet{value: MON_0_01}(0, IAmongNads.Team.Impostors);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── settleGame & claimPayout ─────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════════

    function testFullFlow_ImpostorsWin_WithHousePool() public {
        game.seedPool(0, MON_1, MON_1); // 1 MON each side

        vm.prank(alice);
        game.placeBet{value: MON_0_1}(0, IAmongNads.Team.Crewmates); // Max bet
        vm.prank(bob);
        game.placeBet{value: MON_0_05}(0, IAmongNads.Team.Impostors);
        vm.prank(carol);
        game.placeBet{value: MON_0_05}(0, IAmongNads.Team.Impostors);

        uint256 hbBefore = game.houseBalance();

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Impostors);

        // totalPool = 1 + 1 + 0.1 + 0.05 + 0.05 = 2.2 MON
        uint256 totalPool = 2.2 ether;
        uint256 fee = (totalPool * 500) / 10_000; // 5% = 0.11
        uint256 distributable = totalPool - fee; // 2.09
        uint256 winPool = MON_1 + MON_0_05 + MON_0_05; // 1.1 MON
        uint256 seedShare = (MON_1 * distributable) / winPool; // (1 / 1.1) * 2.09 = 1.9

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

        // Fee check
        assertEq(fee, 0.11 ether);
    }

    function testNoSeed_UserVsUser() public {
        // No seed, just user bets.
        vm.prank(alice);
        game.placeBet{value: MON_0_1}(0, IAmongNads.Team.Crewmates);
    }

    // REDOING testNoSeed_UserVsUser with valid amounts
    function testNoSeed_UserVsUser_ValidAmounts() public {
        vm.prank(alice);
        game.placeBet{value: MON_0_1}(0, IAmongNads.Team.Crewmates);
        vm.prank(bob);
        game.placeBet{value: MON_0_1}(0, IAmongNads.Team.Impostors);

        uint256 hbBefore = game.houseBalance();

        game.lockGame(0);
        game.settleGame(0, IAmongNads.Team.Crewmates);

        // fee = 0.2 * 0.05 = 0.01
        uint256 fee = (0.2 ether * 500) / 10_000;
        assertEq(game.houseBalance(), hbBefore + fee);

        // Alice claims
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        game.claimPayout(0);
        // distributable = 0.19, alice bet 0.1, winPool = 0.1 → payout = 0.19
        assertEq(alice.balance - aliceBefore, 0.2 ether - fee);
    }

    // Needed to receive ETH from sweep()
    receive() external payable {}
}
