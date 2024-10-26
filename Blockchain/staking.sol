// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);

    function balanceOf(address account) external view returns (uint256);
}

contract RBStaking {
    address public admin; // Current owner
    IERC20 public rbToken;

    // Eligible wallet address arrays
    address[] public soldBeforeJune17;
    address[] public purchasedBeforeAug1HeldOrSoldAfterJune17;
    address[] public purchasedAfterJuly22;

    // Mapping to track staking details
    struct Stake {
        uint256 stakedAmount;
        uint256 startTime;
        uint256 totalReward;
        uint256 claimedReward;
        bool staked;
    }

    mapping(address => Stake) public stakes;

    // Event declarations
    event WalletAdded(address indexed wallet, uint8 category);
    event Staked(address indexed staker, uint256 amount);
    event RewardClaimed(address indexed staker, uint256 reward);
    event Withdrawn(address indexed staker, uint256 amount);
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    ); // Event for ownership transfer

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    constructor(address _rbToken) {
        admin = msg.sender;
        rbToken = IERC20(_rbToken);
    }

    // Function to add eligible wallet addresses
    function addWallet(address _wallet, uint8 category) external onlyAdmin {
        require(category >= 1 && category <= 3, "Invalid category");
        if (category == 1) {
            soldBeforeJune17.push(_wallet);
        } else if (category == 2) {
            purchasedBeforeAug1HeldOrSoldAfterJune17.push(_wallet);
        } else if (category == 3) {
            purchasedAfterJuly22.push(_wallet);
        }
        emit WalletAdded(_wallet, category);
    }

    // Function to view all eligible wallet addresses in a specific category
    function getEligibleWallets(
        uint8 category
    ) external view returns (address[] memory) {
        require(category >= 1 && category <= 3, "Invalid category");
        if (category == 1) {
            return soldBeforeJune17;
        } else if (category == 2) {
            return purchasedBeforeAug1HeldOrSoldAfterJune17;
        } else {
            return purchasedAfterJuly22;
        }
    }

    // Staking function
    function stake(uint256 amount) external {
        require(amount > 0, "Staking amount must be greater than 0");
        require(!stakes[msg.sender].staked, "Already staking");

        uint256 totalReward = calculateReward(amount);
        stakes[msg.sender] = Stake({
            stakedAmount: amount,
            startTime: block.timestamp,
            totalReward: totalReward,
            claimedReward: 0,
            staked: true
        });

        rbToken.transferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    // Function to claim rewards based on staking duration
    function claimReward() external {
        Stake storage userStake = stakes[msg.sender];
        require(userStake.staked, "No active stake");

        uint256 claimableReward = calculateClaimableReward(userStake);
        require(claimableReward > 0, "No rewards available to claim");

        userStake.claimedReward += claimableReward;
        rbToken.transfer(msg.sender, claimableReward);
        emit RewardClaimed(msg.sender, claimableReward);
    }

    // Function to withdraw staked tokens after the total locking period
    function withdraw() external {
        Stake memory userStake = stakes[msg.sender];
        require(userStake.staked, "No active stake");
        require(
            block.timestamp >= userStake.startTime + 360 days,
            "Staking period not complete"
        );

        uint256 totalAmount = userStake.stakedAmount +
            userStake.totalReward -
            userStake.claimedReward;
        stakes[msg.sender].staked = false;

        rbToken.transfer(msg.sender, totalAmount);
        emit Withdrawn(msg.sender, totalAmount);
    }

    // Helper function to calculate total rewards based on staked amount
    function calculateReward(uint256 amount) internal pure returns (uint256) {
        // Total reward calculation logic (400% reward for staked amount)
        return amount * 4;
    }

    // Helper function to calculate claimable rewards based on staking duration
    function calculateClaimableReward(
        Stake storage userStake
    ) internal view returns (uint256) {
        uint256 elapsedTime = block.timestamp - userStake.startTime;
        uint256 claimableReward = 0;

        // Calculate claimable rewards based on elapsed time
        if (
            elapsedTime >= 60 days &&
            userStake.claimedReward < (userStake.totalReward * 15) / 100
        ) {
            claimableReward +=
                (userStake.totalReward * 15) /
                100 -
                userStake.claimedReward;
        }
        if (
            elapsedTime >= 180 days &&
            userStake.claimedReward < (userStake.totalReward * 40) / 100
        ) {
            claimableReward +=
                (userStake.totalReward * 25) /
                100 -
                userStake.claimedReward;
        }
        if (
            elapsedTime >= 360 days &&
            userStake.claimedReward < userStake.totalReward
        ) {
            claimableReward +=
                (userStake.totalReward * 60) /
                100 -
                userStake.claimedReward;
        }

        return claimableReward;
    }

    // Admin function to remove a wallet from a specific category
    function removeWalletFromCategory(
        address _wallet,
        uint8 category
    ) external onlyAdmin {
        require(category >= 1 && category <= 3, "Invalid category");
        address[] storage walletArray;
        if (category == 1) {
            walletArray = soldBeforeJune17;
        } else if (category == 2) {
            walletArray = purchasedBeforeAug1HeldOrSoldAfterJune17;
        } else {
            walletArray = purchasedAfterJuly22;
        }

        for (uint i = 0; i < walletArray.length; i++) {
            if (walletArray[i] == _wallet) {
                walletArray[i] = walletArray[walletArray.length - 1];
                walletArray.pop();
                break;
            }
        }
    }

    // Function to transfer ownership to a new address
    function transferOwnership(address newOwner) external onlyAdmin {
        require(newOwner != address(0), "New owner cannot be the zero address");
        emit OwnershipTransferred(admin, newOwner);
        admin = newOwner; // Update the admin to the new owner's address
    }
}
//the real staking contract for 360days
//0x685167de0EE47b59DF1c61519f8928da613a90D2
