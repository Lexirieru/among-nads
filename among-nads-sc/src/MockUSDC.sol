// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title MockUSDC
 * @notice Minimal ERC20 with 6 decimals, owner-only minting, and a public faucet.
 *         Designed for testnet use with Among Nads prediction market.
 *
 *  Faucet: 100 USDC per call, 6-hour cooldown per address.
 */
contract MockUSDC {
    // ── Metadata ─────────────────────────────────────────────────────────────

    string public constant name     = "Mock USDC";
    string public constant symbol   = "USDC";
    uint8  public constant decimals = 6;

    // ── Faucet Config ────────────────────────────────────────────────────────

    uint256 public constant FAUCET_AMOUNT   = 100 * 1e6;  // 100 USDC
    uint256 public constant FAUCET_COOLDOWN = 6 hours;

    // ── State ────────────────────────────────────────────────────────────────

    address public owner;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public lastFaucet;

    // ── Events ───────────────────────────────────────────────────────────────

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ── Errors ───────────────────────────────────────────────────────────────

    error NotOwner();
    error InsufficientBalance();
    error InsufficientAllowance();
    error FaucetCooldown(uint256 availableAt);

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ── Owner Functions ──────────────────────────────────────────────────────

    /// @notice Mint tokens to any address. Owner only.
    function mint(address to, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        _mint(to, amount);
    }

    // ── Faucet ───────────────────────────────────────────────────────────────

    /// @notice Mint 100 USDC to the caller. 6-hour cooldown per address.
    function faucet() external {
        uint256 availableAt = lastFaucet[msg.sender] + FAUCET_COOLDOWN;
        if (block.timestamp < availableAt) revert FaucetCooldown(availableAt);

        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    // ── ERC20 ────────────────────────────────────────────────────────────────

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            allowance[from][msg.sender] = allowed - amount;
        }
        return _transfer(from, to, amount);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        if (balanceOf[from] < amount) revert InsufficientBalance();
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply    += amount;
        balanceOf[to]  += amount;
        emit Transfer(address(0), to, amount);
    }
}
