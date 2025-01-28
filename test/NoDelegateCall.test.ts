import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, Signer, ZeroAddress } from "ethers";
import { Safe, Safe__factory, SafeProxyFactory } from "../typechain-types";
import { execTransaction } from "./utils/utils";

describe("Example module tests", async function () {
  let deployer: Signer;
  let alice: Signer;
  let masterCopy: Safe;
  let proxyFactory: SafeProxyFactory;
  let safeFactory: Safe__factory;
  let safe: Safe;
  let exampleGuard: Contract;

  // Setup signers and deploy contracts before running tests
  before(async () => {
    [deployer, alice] = await ethers.getSigners();

    safeFactory = await ethers.getContractFactory("Safe", deployer);
    masterCopy = await safeFactory.deploy();

    proxyFactory = await (
      await ethers.getContractFactory("SafeProxyFactory", deployer)
    ).deploy();
  });

  // Setup contracts: Deploy a new token contract, create a new Safe, deploy the TokenWithdrawModule contract, and enable the module in the Safe.
  const setupContracts = async (
    walletOwners: Signer[],
    threshold: number
  ) => {
    const ownerAddresses = await Promise.all(
      walletOwners.map(async (walletOwner) => await walletOwner.getAddress())
    );

    const safeData = masterCopy.interface.encodeFunctionData("setup", [
      ownerAddresses,
      threshold,
      ZeroAddress,
      "0x",
      ZeroAddress,
      ZeroAddress,
      0,
      ZeroAddress,
    ]);

    // Read the safe address by executing the static call to createProxyWithNonce function
    const safeAddress = await proxyFactory.createProxyWithNonce.staticCall(
      await masterCopy.getAddress(),
      safeData,
      0n
    );

    // Create the proxy with nonce
    await proxyFactory.createProxyWithNonce(
      await masterCopy.getAddress(),
      safeData,
      0n
    );

    if (safeAddress === ZeroAddress) {
      throw new Error("Safe address not found");
    }

    // Deploy the TokenWithdrawModule contract
    exampleGuard = await (
      await ethers.getContractFactory("NoDegegateCallGuard", deployer)
    ).deploy();

    safe = await ethers.getContractAt("Safe", safeAddress);

    // Enable the module in the safe
    const enableModuleData = masterCopy.interface.encodeFunctionData(
      "setGuard",
      [exampleGuard.target]
    );

    // Execute the transaction to enable the module
    await execTransaction(
      walletOwners.slice(0, threshold),
      safe,
      safe.target,
      0,
      enableModuleData,
      0
    );
  };

  // Test case to verify token transfer to bob
  it("Should successfully transfer tokens to bob", async function () {
    const wallets = [alice];
    await setupContracts(wallets, 1);
    // Execute the transaction to enable the module
    await expect ( execTransaction(
        wallets,
        safe,
        ZeroAddress,
        0,
        "0x",
        1
    )).to.be.revertedWithCustomError(exampleGuard, "DelegateCallNotAllowed");

    expect(await execTransaction(
      wallets,
      safe,
      ZeroAddress,
      0,
      "0x",
      0
  ));
  });
});