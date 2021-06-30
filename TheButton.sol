// SPDX-License-Identifier: MIT

pragma solidity =0.8.4;

/** 
 * @title The Button
 * @author Austin Born <austinborn212@gmail.com>
 * @notice Implements functionality akin to r/thebutton, where users "press" the button by submitting funds and if no one presses it within 3 blocks,
 *  the last presser can claim the treasure of all submitted funds.
 */
contract TheButton {

  uint private constant TREASURE_WAIT = 3;

  uint public immutable press_fee; // Nominated in ETH
  address public last_presser;
  uint public last_press_block;

  event ButtonPressed(uint presser, uint block);
  event FallbackCalled(address caller, uint funds_received);
  event TreasureClaimed(address claimant, uint treasure);

  constructor(uint _press_fee) public {
    press_fee = _press_fee;
  }

  function press_button() external payable {
    require(msg.value == PRESS_FEE, "Caller must pay fee to press the button.");
    require(msg.sender != last_presser, "Why would you press the button again??");

    last_presser = msg.sender;
    last_press_block = block.number;

    emit ButtonPressed(last_presser, last_press_block);
  }

  function claim_treasure() external {
    require(msg.sender == last_presser, "Caller did not press the button last.");
    require(block.number >= last_press_block + TREASURE_WAIT, "Patience is a virtue.");

    uint treasure = address(this).balance;
    (bool success,) = last_presser.call.value(treasure)();
    require(success, "Attempt to send treasure failed.");

    emit TreasureClaimed(msg.sender, treasure);
  }

  // Fallback
  fallback() external payable {
    emit FallbackCalled(msg.sender, msg.value);
  }
}
