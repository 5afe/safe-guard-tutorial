// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { BaseGuard } from "@safe-global/safe-contracts/contracts/base/GuardManager.sol";
import { Enum } from "@safe-global/safe-contracts/contracts/common/Enum.sol";

contract NoDelegatecallGuard is BaseGuard {

    error DelegatecallNotAllowed();

    function checkTransaction(
        address /*to*/,
        uint256 /*value*/,
        bytes memory /*data*/,
        Enum.Operation operation,
        uint256 /*safeTxGas*/,
        uint256 /*baseGas*/,
        uint256 /*gasPrice*/,
        address /*gasToken*/,
        address payable /*refundReceiver*/,
        bytes memory /*signatures*/,
        address /*msgSender*/
    ) external {
        if(operation == Enum.Operation.DelegateCall) {
            revert DelegatecallNotAllowed();
        }
    }

    function checkAfterExecution(bytes32 txHash, bool success) external {

    }
}
