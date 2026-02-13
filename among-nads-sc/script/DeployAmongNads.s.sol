// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console } from "forge-std/Script.sol";
import { AmongNads } from "../src/AmongNads.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployAmongNads is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy implementation
        AmongNads impl = new AmongNads();

        // 2. Deploy proxy + initialize
        bytes memory initData = abi.encodeCall(AmongNads.initialize, (deployer));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        // 3. Configure game parameters
        AmongNads game = AmongNads(payable(address(proxy)));
        uint256 lobbyDuration = uint256(180);
        uint256 settlementTimeout = uint256(1 hours);
        game.setLobbyDuration(lobbyDuration);
        game.setSettlementTimeout(settlementTimeout);

        vm.stopBroadcast();

        console.log("AmongNads implementation:", address(impl));
        console.log("AmongNads proxy:", address(proxy));
        console.log("Lobby duration:", lobbyDuration);
        console.log("Settlement timeout:", settlementTimeout);
    }
}
