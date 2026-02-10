import { AmongNadsABI } from "./abi/AmongNads";
import { MockUSDCABI } from "./abi/MockUSDC";

export const AMONG_NADS_ADDRESS = "0x7B7a862f86FE5e9558Ee5b27BfAd56D5C2aA673e";
export const MOCK_USDC_ADDRESS = "0xE157559BE0cd5be4057C7e66d4F07fC28571043C";

export const AMONG_NADS_ABI = AmongNadsABI;
export const MOCK_USDC_ABI = MockUSDCABI;

// Keep legacy export for backward compatibility
export const CONTRACT_ADDRESS = AMONG_NADS_ADDRESS;
