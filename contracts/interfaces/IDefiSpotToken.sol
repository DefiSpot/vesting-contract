// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IDefiSpotToken{
    function mint(uint256 amount) external returns (bool);
}