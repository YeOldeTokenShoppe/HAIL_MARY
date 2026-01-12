// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.20;

// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/utils/Pausable.sol";

// /**
//  * @title RL80StakingTestnet
//  * @notice Simplified testnet staking with short lock periods for testing
//  *         - Configurable lock duration (default 10 minutes for testing)
//  *         - Direct ETH distribution (no queuing mechanism)
//  *         - Test helper functions for skipping locks
//  */
// contract RL80StakingTestnet is ReentrancyGuard, Ownable, Pausable {
//     using SafeERC20 for IERC20;

//     // ---------------------------------
//     // Config
//     // ---------------------------------
//     IERC20 public immutable rl80Token;
//     uint256 public lockDuration = 10 minutes; // Short default for testing
    
//     // ---------------------------------
//     // State Variables
//     // ---------------------------------
//     uint256 public totalStaked;
//     uint256 public rewardPerTokenStored;
    
//     mapping(address => uint256) public balances;
//     mapping(address => uint256) public userRewardPerTokenPaid;
//     mapping(address => uint256) public rewards;
//     mapping(address => uint256) public unlockTime;
    
//     // ---------------------------------
//     // Events
//     // ---------------------------------
//     event Staked(address indexed user, uint256 amount, uint256 unlockAt);
//     event Withdrawn(address indexed user, uint256 amount);
//     event RewardsDistributed(address indexed distributor, uint256 amount);
//     event RewardsClaimed(address indexed user, uint256 amount);
    
//     // ---------------------------------
//     // Constructor
//     // ---------------------------------
//     constructor(address _rl80Token) Ownable(msg.sender) {
//         require(_rl80Token != address(0), "Invalid token");
//         rl80Token = IERC20(_rl80Token);
//     }
    
//     // ---------------------------------
//     // Modifiers
//     // ---------------------------------
//     modifier updateReward(address account) {
//         if (account != address(0)) {
//             rewards[account] = earned(account);
//             userRewardPerTokenPaid[account] = rewardPerTokenStored;
//         }
//         _;
//     }
    
//     // ---------------------------------
//     // View Functions
//     // ---------------------------------
    
//     /**
//      * @notice Calculate earned rewards for an account
//      * @param account The account to check
//      * @return The amount of ETH rewards earned
//      */
//     function earned(address account) public view returns (uint256) {
//         return ((balances[account] * 
//                 (rewardPerTokenStored - userRewardPerTokenPaid[account])) / 1e18) 
//                 + rewards[account];
//     }
    
//     /**
//      * @notice Get the staked balance of an account
//      * @param account The account to check
//      * @return The staked balance
//      */
//     function stakedOf(address account) external view returns (uint256) {
//         return balances[account];
//     }
    
//     /**
//      * @notice Get time until unlock in human readable format
//      * @param account The account to check
//      * @return timeLeft Seconds until unlock
//      * @return readable Human readable string
//      */
//     function getUnlockStatus(address account) 
//         external 
//         view 
//         returns (uint256 timeLeft, string memory readable) 
//     {
//         if (block.timestamp >= unlockTime[account]) {
//             return (0, "Unlocked");
//         }
        
//         timeLeft = unlockTime[account] - block.timestamp;
        
//         if (timeLeft < 60) {
//             readable = "Less than 1 minute";
//         } else if (timeLeft < 3600) {
//             uint256 mins = timeLeft / 60;
//             readable = string(abi.encodePacked(
//                 uintToString(mins),
//                 " minutes"
//             ));
//         } else {
//             uint256 hrs = timeLeft / 3600;
//             readable = string(abi.encodePacked(
//                 uintToString(hrs),
//                 " hours"
//             ));
//         }
//     }
    
//     // ---------------------------------
//     // Staking Functions
//     // ---------------------------------
    
//     /**
//      * @notice Stake RL80 tokens
//      * @param amount The amount to stake
//      */
//     function stake(uint256 amount) 
//         external 
//         nonReentrant 
//         whenNotPaused 
//         updateReward(msg.sender) 
//     {
//         require(amount > 0, "Cannot stake 0");
        
//         // Update balances
//         balances[msg.sender] += amount;
//         totalStaked += amount;
        
//         // Set unlock time for new stakes
//         if (unlockTime[msg.sender] < block.timestamp) {
//             unlockTime[msg.sender] = block.timestamp + lockDuration;
//         } else {
//             // Extend lock if adding to existing stake
//             unlockTime[msg.sender] = block.timestamp + lockDuration;
//         }
        
//         // Transfer tokens
//         rl80Token.safeTransferFrom(msg.sender, address(this), amount);
        
//         emit Staked(msg.sender, amount, unlockTime[msg.sender]);
//     }
    
//     /**
//      * @notice Withdraw staked tokens (after lock period)
//      * @param amount The amount to withdraw
//      */
//     function withdraw(uint256 amount) 
//         external 
//         nonReentrant 
//         whenNotPaused 
//         updateReward(msg.sender) 
//     {
//         require(amount > 0, "Cannot withdraw 0");
//         require(balances[msg.sender] >= amount, "Insufficient balance");
//         require(block.timestamp >= unlockTime[msg.sender], "Still locked");
        
//         // Update balances
//         balances[msg.sender] -= amount;
//         totalStaked -= amount;
        
//         // Transfer tokens back
//         rl80Token.safeTransfer(msg.sender, amount);
        
//         emit Withdrawn(msg.sender, amount);
//     }
    
//     /**
//      * @notice Withdraw all staked tokens (after lock period)
//      */
//     function withdrawAll() public 
//         nonReentrant 
//         whenNotPaused 
//         updateReward(msg.sender) 
//     {
//         uint256 amount = balances[msg.sender];
//         require(amount > 0, "Nothing to withdraw");
//         require(block.timestamp >= unlockTime[msg.sender], "Still locked");
        
//         // Update balances
//         balances[msg.sender] = 0;
//         totalStaked -= amount;
        
//         // Transfer tokens back
//         rl80Token.safeTransfer(msg.sender, amount);
        
//         emit Withdrawn(msg.sender, amount);
//     }
    
//     // ---------------------------------
//     // Reward Functions
//     // ---------------------------------
    
//     /**
//      * @notice Distribute ETH rewards to all stakers proportionally
//      * @param amount The amount of ETH to distribute
//      */
//     function distributeRewards(uint256 amount) external payable {
//         require(msg.value == amount, "Incorrect ETH sent");
//         require(totalStaked > 0, "No stakers");
        
//         rewardPerTokenStored += (amount * 1e18) / totalStaked;
        
//         emit RewardsDistributed(msg.sender, amount);
//     }
    
//     /**
//      * @notice Claim accumulated ETH rewards (after lock period)
//      */
//     function claimRewards() 
//         public 
//         nonReentrant 
//         whenNotPaused 
//         updateReward(msg.sender) 
//     {
//         require(block.timestamp >= unlockTime[msg.sender], "Still in initial lock");
        
//         uint256 reward = rewards[msg.sender];
//         require(reward > 0, "No rewards");
        
//         rewards[msg.sender] = 0;
        
//         (bool ok, ) = payable(msg.sender).call{value: reward}("");
//         require(ok, "Transfer failed");
        
//         emit RewardsClaimed(msg.sender, reward);
//     }
    
//     /**
//      * @notice Claim rewards and withdraw all in one transaction
//      */
//     function exit() external {
//         // First update rewards
//         if (earned(msg.sender) > 0 && block.timestamp >= unlockTime[msg.sender]) {
//             claimRewards();
//         }
//         withdrawAll();
//     }
    
//     // ---------------------------------
//     // Testnet-Only Functions
//     // ---------------------------------
    
//     /**
//      * @notice Set custom lock duration for testing scenarios
//      * @param _seconds Lock duration in seconds (min 1 minute for testnet)
//      */
//     function setTestnetLockDuration(uint256 _seconds) external onlyOwner {
//         require(_seconds >= 1 minutes, "Too short");
//         require(_seconds <= 1 days, "Too long for testnet");
//         lockDuration = _seconds;
//     }
    
//     /**
//      * @notice Skip lock period for specific tester (testnet only!)
//      * @param tester Address to unlock immediately
//      */
//     function skipLockForTester(address tester) external onlyOwner {
//         unlockTime[tester] = block.timestamp;
//     }
    
//     // ---------------------------------
//     // Admin Functions
//     // ---------------------------------
    
//     /**
//      * @notice Update the lock duration for new stakes
//      * @param _lockDuration New lock duration in seconds
//      */
//     function setLockDuration(uint256 _lockDuration) external onlyOwner {
//         require(_lockDuration > 0, "Invalid duration");
//         lockDuration = _lockDuration;
//     }
    
//     /**
//      * @notice Pause the contract
//      */
//     function pause() external onlyOwner {
//         _pause();
//     }
    
//     /**
//      * @notice Unpause the contract
//      */
//     function unpause() external onlyOwner {
//         _unpause();
//     }
    
//     /**
//      * @notice Emergency withdraw for users when paused
//      */
//     function emergencyWithdraw() external nonReentrant whenPaused {
//         uint256 amount = balances[msg.sender];
//         require(amount > 0, "Nothing staked");
        
//         balances[msg.sender] = 0;
//         totalStaked -= amount;
        
//         rl80Token.safeTransfer(msg.sender, amount);
        
//         emit Withdrawn(msg.sender, amount);
//     }
    
//     /**
//      * @notice Rescue stuck ETH (only excess, not owed rewards)
//      * @param to Address to send ETH to
//      * @param amount Amount to rescue
//      */
//     function rescueETH(address to, uint256 amount) external onlyOwner {
//         require(to != address(0), "Invalid address");
        
//         uint256 available = address(this).balance;
//         require(amount <= available, "Insufficient balance");
        
//         (bool ok, ) = payable(to).call{value: amount}("");
//         require(ok, "Transfer failed");
//     }
    
//     /**
//      * @notice Rescue stuck tokens (not RL80)
//      * @param token Token to rescue
//      * @param to Address to send tokens to
//      * @param amount Amount to rescue
//      */
//     function rescueTokens(
//         address token,
//         address to,
//         uint256 amount
//     ) external onlyOwner {
//         require(token != address(rl80Token), "Cannot rescue staking token");
//         require(to != address(0), "Invalid address");
        
//         IERC20(token).safeTransfer(to, amount);
//     }
    
//     // ---------------------------------
//     // Helper Functions
//     // ---------------------------------
    
//     /**
//      * @notice Helper function to convert uint to string
//      */
//     function uintToString(uint256 v) internal pure returns (string memory) {
//         if (v == 0) return "0";
//         uint256 digits;
//         uint256 temp = v;
//         while (temp != 0) {
//             digits++;
//             temp /= 10;
//         }
//         bytes memory buffer = new bytes(digits);
//         while (v != 0) {
//             digits -= 1;
//             buffer[digits] = bytes1(uint8(48 + uint256(v % 10)));
//             v /= 10;
//         }
//         return string(buffer);
//     }
    
//     // ---------------------------------
//     // Receive ETH
//     // ---------------------------------
//     receive() external payable {}
// }