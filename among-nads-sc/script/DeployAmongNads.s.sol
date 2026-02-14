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

        vm.stopBroadcast();

        console.log("block.chainid", block.chainid);
        console.log("AmongNads implementation:", address(impl));
        console.log("AmongNads proxy:", address(proxy));
    }
}

// RUN
// forge script script/DeployAmongNads.s.sol --broadcast --verify --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/
// forge script script/DeployAmongNads.s.sol -vvv
