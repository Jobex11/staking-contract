require("dotenv").config();

const express = require("express");
const xlsx = require("xlsx");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(express.json());

// MongoDB Atlas ConnectionS
const mongoURI = process.env.MONGO_URI;

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Wallet Schema
const walletSchema = new mongoose.Schema({
  walletAddress: String,
  category: String,
});

// Wallet Model
const Wallet = mongoose.model("Wallet", walletSchema);

// Helper function to parse date strings or serial numbers
const parseDate = (dateValue) => {
  if (typeof dateValue === "string") {
    const [date, time] = dateValue.split(" ");
    return new Date(`${date}T${time}Z`); // Convert to Date object
  } else if (typeof dateValue === "number") {
    return new Date((dateValue - 25569) * 86400 * 1000); // Adjust for epoch
  }
  return null; // Return null if the value is neither string nor number
};

// Endpoint to get wallets from Excel and save them to MongoDB
app.get("/get-wallets", async (req, res) => {
  const filePath = path.join(__dirname, "whitlistedAccount.xlsx"); // Ensure this is correct

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
      if (index === 0) return; // Skip header row
      const wallet = row[0]; // Column A
      const dateTime = parseDate(row[2]); // Column C

      if (!dateTime) {
        console.warn(
          `Invalid date for wallet: ${wallet} with value: ${row[2]}`
        );
        return; // Skip invalid entries
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
        newWallet.save(); // Save each wallet to MongoDB
      }
    });

    console.log("Grouped Wallets:", groupedWallets);
    res.json(groupedWallets);
  } catch (error) {
    console.error("Error reading the Excel file:", error);
    res.status(500).json({ error: "Failed to read Excel file" });
  }
});

// Endpoint to get wallets from MongoDB
app.get("/api/wallets", async (req, res) => {
  try {
    const wallets = await Wallet.find(); // Fetch all wallets
    res.json(wallets); // Send wallets as JSON response
  } catch (error) {
    console.error("Error fetching wallets:", error);
    res.status(500).json({ error: "Failed to fetch wallets" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

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
