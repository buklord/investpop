const hre = require("hardhat");

// ── Chain-specific USDT contract addresses ────────────────────────────────────
const USDT_ADDRESSES = {
  56:  "0x55d398326f99059fF775485246999027B3197955", // BSC Mainnet (BEP-20 USDT)
  97:  "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", // BSC Testnet
};

async function main() {
  const chainId = hre.network.config.chainId;
  console.log(`\nDeploying VaultQuokkaDeposit to chain ${chainId}...`);

  const usdtAddress  = USDT_ADDRESSES[chainId];
  if (!usdtAddress) throw new Error(`No USDT address configured for chain ${chainId}`);

  // Treasury = the VaultQuokka wallet that receives USDT deposits
  // Set TREASURY_ADDRESS in .env.local or replace below with your real address
  const treasury = process.env.TREASURY_ADDRESS;
  if (!treasury || treasury === "0x0000000000000000000000000000000000000000") {
    throw new Error("Set TREASURY_ADDRESS in .env.local — this is where USDT deposits will go");
  }

  const minUsd = 10;      // $10 minimum
  const maxUsd = 50000;   // $50,000 maximum

  const Contract = await hre.ethers.getContractFactory("VaultQuokkaDeposit");
  const contract = await Contract.deploy(usdtAddress, treasury, minUsd, maxUsd);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\n✅ VaultQuokkaDeposit deployed!`);
  console.log(`   Contract address : ${address}`);
  console.log(`   USDT token       : ${usdtAddress}`);
  console.log(`   Treasury         : ${treasury}`);
  console.log(`   Min deposit      : $${minUsd} USDT`);
  console.log(`   Max deposit      : $${maxUsd} USDT`);
  console.log(`\n👉 Add this to .env.local:`);
  console.log(`   NEXT_PUBLIC_DEPOSIT_CONTRACT_BSC=${address}`);
  console.log(`\n👉 Verify on BSCScan:`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${address} "${usdtAddress}" "${treasury}" ${minUsd} ${maxUsd}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
