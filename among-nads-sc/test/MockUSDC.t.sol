// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC public usdc;

    address public alice = address(0x1111111111111111111111111111111111111111);
    address public bob   = address(0x2222222222222222222222222222222222222222);
    address public eve   = address(0x4444444444444444444444444444444444444444);

    function setUp() public {
        usdc = new MockUSDC();
    }

    // ── Metadata ───────────────────────────────────────────────────────────

    function testMetadata() public view {
        assertEq(usdc.name(),     "Mock USDC");
        assertEq(usdc.symbol(),   "USDC");
        assertEq(usdc.decimals(), 6);
    }

    // ── Mint ───────────────────────────────────────────────────────────────

    function testMint_Owner() public {
        usdc.mint(alice, 100e6);
        assertEq(usdc.balanceOf(alice), 100e6);
        assertEq(usdc.totalSupply(), 100e6);
    }

    function testMint_OnlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(MockUSDC.NotOwner.selector);
        usdc.mint(alice, 100e6);
    }

    // ── Transfer ───────────────────────────────────────────────────────────

    function testTransfer_Happy() public {
        usdc.mint(alice, 50e6);

        vm.prank(alice);
        usdc.transfer(bob, 20e6);

        assertEq(usdc.balanceOf(alice), 30e6);
        assertEq(usdc.balanceOf(bob),   20e6);
    }

    function testTransfer_InsufficientBalance() public {
        usdc.mint(alice, 10e6);

        vm.prank(alice);
        vm.expectRevert(MockUSDC.InsufficientBalance.selector);
        usdc.transfer(bob, 20e6);
    }

    // ── Approve + TransferFrom ─────────────────────────────────────────────

    function testApproveAndTransferFrom() public {
        usdc.mint(alice, 100e6);

        vm.prank(alice);
        usdc.approve(bob, 50e6);
        assertEq(usdc.allowance(alice, bob), 50e6);

        vm.prank(bob);
        usdc.transferFrom(alice, bob, 30e6);

        assertEq(usdc.balanceOf(alice), 70e6);
        assertEq(usdc.balanceOf(bob),   30e6);
        assertEq(usdc.allowance(alice, bob), 20e6);
    }

    function testTransferFrom_InsufficientAllowance() public {
        usdc.mint(alice, 100e6);

        vm.prank(alice);
        usdc.approve(bob, 10e6);

        vm.prank(bob);
        vm.expectRevert(MockUSDC.InsufficientAllowance.selector);
        usdc.transferFrom(alice, bob, 20e6);
    }

    function testTransferFrom_MaxAllowanceNoDecrease() public {
        usdc.mint(alice, 100e6);

        vm.prank(alice);
        usdc.approve(bob, type(uint256).max);

        vm.prank(bob);
        usdc.transferFrom(alice, bob, 50e6);

        // Max allowance should not decrease
        assertEq(usdc.allowance(alice, bob), type(uint256).max);
    }

    // ── Faucet ─────────────────────────────────────────────────────────────

    function testFaucet_Happy() public {
        vm.prank(alice);
        usdc.faucet();

        assertEq(usdc.balanceOf(alice), 100e6); // 100 USDC
    }

    function testFaucet_Cooldown() public {
        vm.prank(alice);
        usdc.faucet();

        // Try again immediately — should revert
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MockUSDC.FaucetCooldown.selector, block.timestamp + 6 hours)
        );
        usdc.faucet();
    }

    function testFaucet_AfterCooldown() public {
        vm.prank(alice);
        usdc.faucet();
        assertEq(usdc.balanceOf(alice), 100e6);

        // Warp 6 hours forward
        vm.warp(block.timestamp + 6 hours);

        vm.prank(alice);
        usdc.faucet();
        assertEq(usdc.balanceOf(alice), 200e6); // 100 + 100
    }

    function testFaucet_DifferentUsersNoConflict() public {
        vm.prank(alice);
        usdc.faucet();

        vm.prank(bob);
        usdc.faucet();

        assertEq(usdc.balanceOf(alice), 100e6);
        assertEq(usdc.balanceOf(bob),   100e6);
    }
}
