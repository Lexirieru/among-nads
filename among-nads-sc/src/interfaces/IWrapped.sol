// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IWrapped
 * @author Cholee Protocol Team
 * @notice Interface for wrapped native token contracts (like WETH)
 * @dev This interface extends ERC20 functionality with deposit and withdraw functions
 *      for converting between native tokens and their wrapped equivalents
 */
interface IWrapped is IERC20 {
    /// @notice Deposits native tokens and mints equivalent wrapped tokens
    /// @dev The amount of wrapped tokens minted equals msg.value
    function deposit() external payable;

    /// @notice Withdraws wrapped tokens and returns equivalent native tokens
    /// @param wad The amount of wrapped tokens to withdraw and burn
    function withdraw(uint256 wad) external;
}
