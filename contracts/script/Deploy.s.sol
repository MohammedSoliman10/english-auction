// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Script} from "forge-std/Script.sol";
import {SolimanWeb3} from "../src/SolimanWeb3.sol";
import {EnglishAuction} from "../src/EnglishAuction.sol";

/// @title Deploy — one-shot demo-chain deployment (chain-interface §3)
/// @notice Deploys SolimanWeb3, mints token 0 to the deployer (the demo seller),
///         then deploys EnglishAuction(nft, 0, startingBid, duration).
///         Outputs are consumed by `scripts/deploy.sh` → `backend/.env`.
/// @dev Inputs via env: `STARTING_BID_WEI` (default 1e15 = 0.001 ETH),
///      `DURATION_SECONDS` (default 604800 = 7 days; demo 60).
contract Deploy is Script {
    uint256 public constant DEFAULT_STARTING_BID_WEI = 1 ether / 1000; // 0.001 ETH
    uint256 public constant DEFAULT_DURATION_SECONDS = 7 days;

    function run() external returns (address nft, address auction) {
        uint256 startingBid = vm.envOr("STARTING_BID_WEI", DEFAULT_STARTING_BID_WEI);
        uint256 duration = vm.envOr("DURATION_SECONDS", DEFAULT_DURATION_SECONDS);
        require(duration > 0, "duration=0");

        vm.startBroadcast();

        SolimanWeb3 token = new SolimanWeb3();
        token.mintNFT("ipfs://english-auction/demo-metadata-0");
        EnglishAuction sale = new EnglishAuction(address(token), 0, startingBid, duration);

        vm.stopBroadcast();

        nft = address(token);
        auction = address(sale);
    }
}
