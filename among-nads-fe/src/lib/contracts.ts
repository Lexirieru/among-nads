import { AmongNadsABI } from "./abi/AmongNads";
import { MockUSDCABI } from "./abi/MockUSDC";

export const AMONG_NADS_ADDRESS = "0x0D11aFf6dBFc2d3AbAB713DC587a7E7bB62aA5A3";
export const MOCK_USDC_ADDRESS = "0xE157559BE0cd5be4057C7e66d4F07fC28571043C";

export const AMONG_NADS_ABI = AmongNadsABI;
export const MOCK_USDC_ABI = MockUSDCABI;

// Keep legacy export for backward compatibility
export const CONTRACT_ADDRESS = AMONG_NADS_ADDRESS;
