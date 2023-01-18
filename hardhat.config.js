require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-truffle5");
require("dotenv").config("./.env");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("blockNumber", "Prints the latest block number", async (taskArgs, hre) => {
  const blockNumber = await web3.eth.getBlockNumber();
  console.log(`latest block number: ${blockNumber}`);
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import("hardhat/config").HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.11",
        settings: {},
      },
      {
        version: "0.8.0",
        settings: {},
      },
      {
        version: "0.7.6",
        settings: {},
      },
      {
        version: "0.6.12",
        settings: {},
      },
      {
        version: "0.6.8",
        settings: {},
      },
      {
        version: "0.6.6",
        settings: {},
      },
      {
        version: "0.5.0",
        settings: {},
      },
      {
        version: "0.4.11",
        settings: {},
      },
    ],
    overrides: {
      "contracts/libraries/TickBitmap.sol": {
        version: "0.7.6",
        settings: {}
      }
    },
  },
  defaultNetwork: "localhost",
  networks: {
    hardhat: {
      forking: {
        url: process.env.BSC_ARCHIVE_1,
        blockNumber: Number(process.env.BSC_BLOCK_NUMBER), 
      },
      allowUnlimitedContractSize: true,
      chainId: Number(process.env.BSC_CHAIN_ID),
    },
    polygon: {
      url: "https://matic-mainnet-full-rpc.bwarelabs.com",
      accounts: [process.env.PRIVATE_KEY],
    },
    bsc: {
      url: "https://bsc-dataseed1.ninicoin.io",
      accounts: [process.env.PRIVATE_KEY],
    },
    bsc_testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: [process.env.PRIVATE_KEY],
    },
    izumi: {
      url: "https://rpc.izumi.finance",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  mocha: {
    timeout: 0,
  },
};
