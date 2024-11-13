require("dotenv").config();
const express = require("express");
const xlsx = require("xlsx");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const mongoURI = process.env.MONGO_URI;

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define the Wallet schema
const walletSchema = new mongoose.Schema({
  walletAddress: String,
  category: String,
});

const Wallet = mongoose.model("Wallet", walletSchema);

// Define staking rules based on categories
const stakingRules = {
  soldBeforeJune17: { stakePercentage: 0.5, rewardMultiplier: 1.0 },
  purchasedBeforeAugust1AndSoldAfterJune17: {
    stakePercentage: 0.25,
    rewardMultiplier: 4.0,
  },
  purchasedAfterJuly22: { stakePercentage: 0.5, rewardMultiplier: 1.0 },
};

// Function to parse dates from Excel
const parseDate = (dateValue) => {
  if (typeof dateValue === "string") {
    const [date, time] = dateValue.split(" ");
    return new Date(`${date}T${time}Z`);
  } else if (typeof dateValue === "number") {
    return new Date((dateValue - 25569) * 86400 * 1000);
  }
  return null;
};

// Route to group wallets based on purchase/sell history in an Excel file
app.get("/get-wallets", async (req, res) => {
  const filePath = path.join(__dirname, "whitlistedAccount.xlsx");

  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    const groupedWallets = {
      soldBeforeJune17: [],
      purchasedBeforeAugust1AndSoldAfterJune17: [],
      purchasedAfterJuly22: [],
    };

    const june17 = new Date("2024-06-17T00:00:00Z");
    const august1 = new Date("2024-08-01T00:00:00Z");
    const july22 = new Date("2024-07-22T00:00:00Z");

    data.forEach((row, index) => {
      if (index === 0) return;
      const wallet = row[0];
      const dateTime = parseDate(row[2]);

      if (!dateTime) {
        console.warn(
          `Invalid date for wallet: ${wallet} with value: ${row[2]}`
        );
        return;
      }

      let category;
      if (dateTime < june17) {
        category = "soldBeforeJune17";
        groupedWallets.soldBeforeJune17.push(wallet);
      } else if (dateTime > june17 && dateTime < august1) {
        category = "purchasedBeforeAugust1AndSoldAfterJune17";
        groupedWallets.purchasedBeforeAugust1AndSoldAfterJune17.push(wallet);
      } else if (dateTime > july22) {
        category = "purchasedAfterJuly22";
        groupedWallets.purchasedAfterJuly22.push(wallet);
      }

      if (category) {
        const newWallet = new Wallet({ walletAddress: wallet, category });
        newWallet.save();
      }
    });

    console.log("Grouped Wallets:", groupedWallets);
    res.json(groupedWallets);
  } catch (error) {
    console.error("Error reading the Excel file:", error);
    res.status(500).json({ error: "Failed to read Excel file" });
  }
});

// New route to fetch staking and reward details based on wallet address
app.get("/api/wallet-details/:walletAddress", async (req, res) => {
  const { walletAddress } = req.params;

  try {
    const wallet = await Wallet.findOne({ walletAddress });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const category = wallet.category;
    const rule = stakingRules[category];

    if (!rule) {
      return res.status(400).json({ error: "Category rules not defined" });
    }

    const exampleTokenBalance = 17000; // Example balance - replace with actual balance retrieval logic
    const stakeAmount = exampleTokenBalance * rule.stakePercentage;
    const rewardAmount = stakeAmount * rule.rewardMultiplier;

    const walletDetails = {
      walletAddress,
      category,
      stakeAmount,
      rewardAmount,
    };

    res.json(walletDetails);
  } catch (error) {
    console.error("Error fetching wallet details:", error);
    res.status(500).json({ error: "Failed to fetch wallet details" });
  }
});

// Route to fetch all wallets from the database
app.get("/api/wallets", async (req, res) => {
  try {
    const wallets = await Wallet.find();
    res.json(wallets);
  } catch (error) {
    console.error("Error fetching wallets:", error);
    res.status(500).json({ error: "Failed to fetch wallets" });
  }
});

const calculateStakeDetails = (balance, enteredAmount, category) => {
  let maxStakePercentage = 0;

  // Determine stake percentage based on category
  switch (category) {
    case "soldBeforeJune17":
      maxStakePercentage = 100; // Full balance can be staked
      break;
    case "purchasedBeforeAugust1AndSoldAfterJune17":
      maxStakePercentage = 25; // 25% of balance can be staked
      break;
    case "purchasedAfterJuly22":
      maxStakePercentage = 100; // Full balance can be staked after buy condition
      break;
    default:
      throw new Error("Unknown category");
  }

  // Calculate allowed stake amount and reward based on entered amount
  const allowedStakeAmount = (maxStakePercentage / 100) * enteredAmount;
  const totalReward = allowedStakeAmount * 4; // Assuming 400% reward for all categories

  // Calculate reward distribution for days 60, 120, and 180
  const rewardDay60 = totalReward * 0.15; // 15% of total rewards
  const rewardDay120 = totalReward * 0.25; // 25% of total rewards
  const rewardDay180 = totalReward * 0.6; // 60% of total rewards

  return {
    category,
    maxStakePercentage,
    stakeAmount: allowedStakeAmount,
    reward: {
      total: totalReward,
      day60: rewardDay60,
      day120: rewardDay120,
      day180: rewardDay180,
    },
  };
};

// Route to fetch staking details for an entered amount
app.get("/staking-details/:walletAddress/:enteredAmount", async (req, res) => {
  try {
    const { walletAddress, enteredAmount } = req.params;
    const wallet = await Wallet.findOne({ walletAddress });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Calculate staking and reward details
    const details = calculateStakeDetails(
      wallet.balance,
      Number(enteredAmount),
      wallet.category
    );

    res.json({
      walletAddress: wallet.walletAddress,
      category: details.category,
      maxStakePercentage: details.maxStakePercentage,
      stakeAmount: details.stakeAmount,
      reward: details.reward,
    });
  } catch (error) {
    console.error("Error fetching staking details:", error);
    res.status(500).json({ error: "Failed to fetch staking details" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

/*
require("dotenv").config();

const express = require("express");
const xlsx = require("xlsx");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const mongoURI = process.env.MONGO_URI;

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const walletSchema = new mongoose.Schema({
  walletAddress: String,
  category: String,
});

const Wallet = mongoose.model("Wallet", walletSchema);

const parseDate = (dateValue) => {
  if (typeof dateValue === "string") {
    const [date, time] = dateValue.split(" ");
    return new Date(`${date}T${time}Z`); 
  } else if (typeof dateValue === "number") {
    return new Date((dateValue - 25569) * 86400 * 1000); 
  }
  return null; 
};

app.get("/get-wallets", async (req, res) => {
  const filePath = path.join(__dirname, "whitlistedAccount.xlsx"); 

  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    const groupedWallets = {
      soldBeforeJune17: [],
      purchasedBeforeAugust1AndSoldAfterJune17: [],
      purchasedAfterJuly22: [],
    };

    const june17 = new Date("2024-06-17T00:00:00Z");
    const august1 = new Date("2024-08-01T00:00:00Z");
    const july22 = new Date("2024-07-22T00:00:00Z");

    data.forEach((row, index) => {
      if (index === 0) return; 
      const wallet = row[0]; 
      const dateTime = parseDate(row[2]); 

      if (!dateTime) {
        console.warn(
          `Invalid date for wallet: ${wallet} with value: ${row[2]}`
        );
        return; 
      }

      let category;
      if (dateTime < june17) {
        category = "soldBeforeJune17";
        groupedWallets.soldBeforeJune17.push(wallet);
      } else if (dateTime > june17 && dateTime < august1) {
        category = "purchasedBeforeAugust1AndSoldAfterJune17";
        groupedWallets.purchasedBeforeAugust1AndSoldAfterJune17.push(wallet);
      } else if (dateTime > july22) {
        category = "purchasedAfterJuly22";
        groupedWallets.purchasedAfterJuly22.push(wallet);
      }

      if (category) {
        const newWallet = new Wallet({ walletAddress: wallet, category });
        newWallet.save(); 
      }
    });

    console.log("Grouped Wallets:", groupedWallets);
    res.json(groupedWallets);
  } catch (error) {
    console.error("Error reading the Excel file:", error);
    res.status(500).json({ error: "Failed to read Excel file" });
  }
});

app.get("/api/wallets", async (req, res) => {
  try {
    const wallets = await Wallet.find(); 
    res.json(wallets); 
  } catch (error) {
    console.error("Error fetching wallets:", error);
    res.status(500).json({ error: "Failed to fetch wallets" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
*/

/*
const express = require("express");
const xlsx = require("xlsx");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const parseDate = (dateValue) => {
  if (typeof dateValue === "string") {
    const [date, time] = dateValue.split(" ");
    return new Date(`${date}T${time}Z`);
  } else if (typeof dateValue === "number") {
    return new Date((dateValue - 25569) * 86400 * 1000);
  }
  return null;
};

app.get("/get-wallets", (req, res) => {
  const filePath = path.join(__dirname, "whitlistedAccount.xlsx");

  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    console.log("Raw Data:", data);

    const groupedWallets = {
      soldBeforeJune17: [],
      purchasedBeforeAugust1AndSoldAfterJune17: [],
      purchasedAfterJuly22: [],
    };

    const june17 = new Date("2024-06-17T00:00:00Z");
    const august1 = new Date("2024-08-01T00:00:00Z");
    const july22 = new Date("2024-07-22T00:00:00Z");

    data.forEach((row, index) => {
      if (index === 0) return;
      const wallet = row[0];
      const dateTime = parseDate(row[2]);

      if (!dateTime) {
        console.warn(
          `Invalid date for wallet: ${wallet} with value: ${row[2]}`
        );
        return;
      }

      if (dateTime < june17) {
        groupedWallets.soldBeforeJune17.push(wallet);
      } else if (dateTime > june17 && dateTime < august1) {
        groupedWallets.purchasedBeforeAugust1AndSoldAfterJune17.push(wallet);
      } else if (dateTime > july22) {
        groupedWallets.purchasedAfterJuly22.push(wallet);
      }
    });

    // Log the grouped wallets to the console
    console.log("Grouped Wallets:", groupedWallets);

    // Respond with the grouped wallets
    res.json(groupedWallets);
  } catch (error) {
    console.error("Error reading the Excel file:", error);
    res.status(500).json({ error: "Failed to read Excel file" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

*/

/*

// index.js
const express = require("express");
const xlsx = require("xlsx");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/get-wallets", (req, res) => {
  const filePath = path.join(__dirname, "whitlistedAccount.xlsx"); 
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; 
    const worksheet = workbook.Sheets[sheetName];

    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }); 

    console.log("Raw Data:", data);

    const walletFromIndex = 0; 
    const filteredWallets = data
      .filter((row, index) => index > 0 && row[walletFromIndex]) 
      .map((row) => row[walletFromIndex]); 
    console.log("Filtered Wallets:", filteredWallets);

    res.json(filteredWallets);
  } catch (error) {
    console.error("Error reading the Excel file:", error);
    res.status(500).json({ error: "Failed to read Excel file" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

*/
