// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ArcUSDC - Wrapped USDC for HI.FI
 * @notice Deploy on Base Sepolia, then deploy PoolVault with this address
 * @dev Constructor param:
 *      _usdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (USDC on Base Sepolia)
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract ArcUSDC {
    string public constant name = "Arc USDC";
    string public constant symbol = "arcUSDC";
    uint8 public constant decimals = 6;
    
    IERC20 public immutable usdc;
    
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    
    // Deploy with:
    // _usdc: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia USDC)
    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }
    
    // Deposit USDC to get arcUSDC (1:1)
    function deposit(uint256 amount) external {
        require(amount > 0, "Zero amount");
        
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "USDC transfer failed");
        
        balanceOf[msg.sender] += amount;
        totalSupply += amount;
        
        emit Transfer(address(0), msg.sender, amount);
        emit Deposit(msg.sender, amount);
    }
    
    // Withdraw USDC by burning arcUSDC (1:1)
    function withdraw(uint256 amount) external {
        require(amount > 0, "Zero amount");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        
        bool success = usdc.transfer(msg.sender, amount);
        require(success, "USDC transfer failed");
        
        emit Transfer(msg.sender, address(0), amount);
        emit Withdraw(msg.sender, amount);
    }
    
    // Standard ERC20 functions
    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Invalid recipient");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Invalid recipient");
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
}
