// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../src/AmongNads.sol";

contract DeployAmongNads is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        AmongNads game = new AmongNads();

        vm.stopBroadcast();

        console.log("AmongNads deployed to:", address(game));
        console.log("NOTE: Call setBetToken(usdcAddress) to configure the bet token");
    }
}
