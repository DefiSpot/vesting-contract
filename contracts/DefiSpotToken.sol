// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20Capped, ERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract DefispotToken is ERC20Capped, AccessControl {
    uint256 public constant MAX_SUPPLY = 1000000000 ether;
    bytes32 public constant MINTER = keccak256("MINTER");
    bytes32 public constant MINTER_MAKER = keccak256("MINTER_MAKER");

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 initialSpotToMint
    ) ERC20Capped(MAX_SUPPLY) ERC20(_name, _symbol) {
        _mint(msg.sender, initialSpotToMint);
        _grantRole(MINTER_MAKER, msg.sender);
        _setRoleAdmin(DEFAULT_ADMIN_ROLE, MINTER_MAKER);
        _setRoleAdmin(MINTER, MINTER_MAKER);
        _grantRole(MINTER, msg.sender);
    }

    function grantMinterRole(address _account) external onlyRole(MINTER_MAKER) {
        _grantRole(MINTER, _account);
    }

    function mint(uint256 amount) public onlyRole(MINTER) returns (bool) {
        // @Todo Aggregar role rate adjuster.
        _mint(msg.sender, amount);
        return true;
    }
}
