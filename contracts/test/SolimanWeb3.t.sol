// SPDX-License-Identifier: MIT
pragma solidity 0.8.31;

import {Test} from "forge-std/Test.sol";
import {SolimanWeb3} from "../src/SolimanWeb3.sol";

/// @notice Unit tests — T013 modernization suite (RED before T014 implementation).
/// US5 mint behavior tests append here (tasks T057).
contract SolimanWeb3Test is Test {
    SolimanWeb3 internal token;

    function setUp() public {
        token = new SolimanWeb3();
    }

    function test_ConstructorMetadata() public view {
        assertEq(token.name(), "Soliman Web3", "name trimmed (R5 #7)");
        assertEq(token.symbol(), "SW3", "symbol");
    }
}
