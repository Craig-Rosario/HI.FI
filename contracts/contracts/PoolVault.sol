// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract PoolVault is AccessControl {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    enum State {
        Collecting,
        Active
    }

    IERC20 public immutable usdc;
    State public state;

    uint256 public totalShares;
    uint256 public nav;
    uint256 public threshold;

    mapping(address => uint256) public shares;

    // EVENTS
    event Deposit(address indexed user, uint256 amount, uint256 sharesMinted);
    event DeploymentRequested(uint256 amount);
    event NAVUpdated(uint256 oldNAV, uint256 newNAV);

    constructor(
        address _usdc,
        uint256 _threshold,
        address relayer
    ) {
        usdc = IERC20(_usdc);
        threshold = _threshold;
        state = State.Collecting;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, relayer);
    }

    // USER FUNCTIONS

    function deposit(uint256 amount) external {
        require(state == State.Collecting, "Pool already active");
        require(amount > 0, "Invalid amount");

        usdc.transferFrom(msg.sender, address(this), amount);

        uint256 mintedShares = totalShares == 0
            ? amount
            : (amount * totalShares) / nav;

        shares[msg.sender] += mintedShares;
        totalShares += mintedShares;
        nav += amount;

        emit Deposit(msg.sender, amount, mintedShares);
    }

    function activatePool() external {
        require(state == State.Collecting, "Already active");
        require(nav >= threshold, "Threshold not met");

        state = State.Active;

        emit DeploymentRequested(nav);
    }

    // RELAYER FUNCTIONS

    function updateNAV(uint256 newNAV) external onlyRole(RELAYER_ROLE) {
        uint256 oldNAV = nav;
        nav = newNAV;

        emit NAVUpdated(oldNAV, newNAV);
    }

    // VIEW FUNCTIONS (for frontend)

    function totalAssets() external view returns (uint256) {
        return nav;
    }

    function convertToAssets(uint256 shareAmount) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shareAmount * nav) / totalShares;
    }

    function convertToShares(uint256 assetAmount) external view returns (uint256) {
        if (totalShares == 0) return assetAmount;
        return (assetAmount * totalShares) / nav;
    }

    function balanceOf(address user) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares[user] * nav) / totalShares;
    }

    function getUserShares(address user) external view returns (uint256) {
        return shares[user];
    }
}
