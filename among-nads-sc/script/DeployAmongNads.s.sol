// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../src/AmongNads.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

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

        vm.stopBroadcast();

        console.log("AmongNads implementation:", address(impl));
        console.log("AmongNads proxy:", address(proxy));
        console.log("NOTE: Call setBetToken(usdcAddress) on the PROXY address");
    }
}
