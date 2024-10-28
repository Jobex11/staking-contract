import { useState, useEffect } from "react";
import Web3 from "web3";
import axios from "axios";

import stakingABI from "./stakingABI";
import tokenABI from "./tokenABI";

const tokenAddress = "0x6e0E7BB5dE6f479575A05BA060D2cE71183E2954";
const stakingAddress = "0x7aFDCeD74908FA3AD2B41177827EF46Be66FeE0f";

const App = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [amount, setAmount] = useState("");
  // wallets start
  const [wallets, setWallets] = useState([]);

  useEffect(() => {
    const fetchWallets = async () => {
      try {
        const response = await axios.get(
          "https://stakingcontract-8441.onrender.com/api/wallets"
        );
        setWallets(response.data);
      } catch (error) {
        console.error("Error fetching wallets:", error);
      }
    };

    fetchWallets();
  }, []);

  //wallet ends

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const web3 = new Web3(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const accounts = await web3.eth.getAccounts();
        setWalletAddress(accounts[0]);
      } catch (error) {
        console.error("Wallet connection error:", error);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      const web3 = new Web3(window.ethereum);
      web3.eth.getAccounts().then((accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]); // Automatically set to the connected address
        }
      });

      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        } else {
          setWalletAddress(null);
        }
      });
    }
  }, []);

  const approveToken = async () => {
    if (!walletAddress || !amount) {
      alert("Wallet address and amount are required.");
      return;
    }
    try {
      const web3 = new Web3(window.ethereum);
      const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
      const result = await tokenContract.methods
        .approve(stakingAddress, web3.utils.toWei(amount, "ether"))
        .send({ from: walletAddress });
      console.log("Approval successful:", result);
    } catch (error) {
      console.error("Approval error:", error);
      alert(`Approval failed: ${error.message}`);
    }
  };

  const stakeTokens = async () => {
    if (!walletAddress || !amount) {
      alert("Wallet address and amount are required.");
      return;
    }
    try {
      const web3 = new Web3(window.ethereum);
      const stakingContract = new web3.eth.Contract(stakingABI, stakingAddress);
      const weiAmount = web3.utils.toWei(amount, "ether");

      // Estimate the gas needed
      const estimatedGas = await stakingContract.methods
        .stake(weiAmount)
        .estimateGas({ from: walletAddress });

      // Send transaction with increased gas limit
      const result = await stakingContract.methods.stake(weiAmount).send({
        from: walletAddress,
        gas: Math.floor(estimatedGas * 4), // Increase by 20% to ensure sufficient gas
      });
      console.log("Stake successful:", result);
    } catch (error) {
      console.error("Stake error:", error);
      alert(`Staking failed: ${error.message}`);
    }
  };

  const claimRewards = async () => {
    if (!walletAddress) {
      alert("Wallet address is required.");
      return;
    }
    try {
      const web3 = new Web3(window.ethereum);
      const stakingContract = new web3.eth.Contract(stakingABI, stakingAddress);
      const result = await stakingContract.methods
        .claimReward()
        .send({ from: walletAddress });
      console.log("Claim reward successful:", result);
    } catch (error) {
      console.error("Claim reward error:", error);
      alert(`Claim reward failed: ${error.message}`);
    }
  };

  const withdrawTokens = async () => {
    if (!walletAddress || !amount) {
      alert("Wallet address and amount are required.");
      return;
    }
    try {
      const web3 = new Web3(window.ethereum);
      const stakingContract = new web3.eth.Contract(stakingABI, stakingAddress);
      const result = await stakingContract.methods
        .withdraw(web3.utils.toWei(amount, "ether"))
        .send({ from: walletAddress });
      console.log("Withdraw successful:", result);
    } catch (error) {
      console.error("Withdraw error:", error);
      alert(`Withdraw failed: ${error.message}`);
    }
  };

  return (
    <div>
      <div className="content">
        <button
          onClick={walletAddress ? () => setWalletAddress(null) : connectWallet}
        >
          {walletAddress ? "Disconnect Wallet" : "Connect Wallet"}
        </button>
        <p>Connected Wallet: {walletAddress || "No wallet connected"}</p>
        <input
          type="text"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div>
          <button onClick={approveToken}>Approve</button>
        </div>
        <div>
          <button onClick={stakeTokens}>Stake</button>
        </div>
        <div>
          <button onClick={claimRewards}>Claim Rewards</button>
        </div>
        <div>
          <button onClick={withdrawTokens}>Withdraw</button>
        </div>
      </div>

      <div>
        <h1>Whitelisted wallets for RB stake</h1>
        <ul>
          {wallets.map((wallet) => (
            <li key={wallet._id}>
              {wallet.walletAddress} - {wallet.category}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default App;

/*

import Web3 from "web3";
import PropTypes from "prop-types";

const App = ({
  tokenAddress,
  stakingContractAddress,
  tokenABI,
  stakingABI,
}) => {
  const [account, setAccount] = useState("");
  const [web3, setWeb3] = useState(null);
  const [amountToStake, setAmountToStake] = useState("");
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadWeb3 = async () => {
    if (window.ethereum) {
      const web3Instance = new Web3(window.ethereum);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const accounts = await web3Instance.eth.getAccounts();
      setAccount(accounts[0]);
      setWeb3(web3Instance);
    } else {
      alert("Please install MetaMask!");
    }
  };

  const getContracts = () => {
    const erc20Token = new web3.eth.Contract(tokenABI, tokenAddress);
    const stakingContract = new web3.eth.Contract(
      stakingABI,
      stakingContractAddress
    );
    return { erc20Token, stakingContract };
  };

  const approveTokens = async () => {
    const { erc20Token } = getContracts();
    const amountInWei = web3.utils.toWei(amountToStake, "ether");

    setLoading(true);
    try {
      await erc20Token.methods
        .approve(stakingContractAddress, amountInWei)
        .send({ from: account });
      setIsApproved(true);
      setLoading(false);
    } catch (error) {
      console.error("Approval failed:", error);
      setErrorMessage("Approval failed. Please try again.");
      setLoading(false);
    }
  };

  const stakeTokens = async () => {
    if (!isApproved) {
      setErrorMessage("Please approve tokens before staking.");
      return;
    }

    const { stakingContract } = getContracts();
    const amountInWei = web3.utils.toWei(amountToStake, "ether");

    setLoading(true);
    try {
      await stakingContract.methods.stake(amountInWei).send({ from: account });
      setLoading(false);
      alert("Stake successful!");
    } catch (error) {
      console.error("Staking failed:", error);
      setErrorMessage("Staking failed. Please try again.");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeb3();
  }, []);

  return (
    <div>
      <h1>Staking DApp</h1>
      <p>Connected Account: {account}</p>

      <input
        type="number"
        placeholder="Amount to Stake"
        value={amountToStake}
        onChange={(e) => setAmountToStake(e.target.value)}
      />

      <button onClick={approveTokens} disabled={loading}>
        {loading ? "Approving..." : "Approve Tokens"}
      </button>

      <button onClick={stakeTokens} disabled={!isApproved || loading}>
        {loading ? "Staking..." : "Stake Tokens"}
      </button>

      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
    </div>
  );
};

App.propTypes = {
  tokenAddress: PropTypes.string.isRequired,
  stakingContractAddress: PropTypes.string.isRequired,
  tokenABI: PropTypes.array.isRequired,
  stakingABI: PropTypes.array.isRequired,
};

export default App;
*/
