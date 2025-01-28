import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, ZeroAddress } from "ethers";
import { Safe, Safe__factory, SafeProxyFactory } from "../typechain-types";
import { execTransaction } from "./utils/utils";
import { NoDelegateCallGuard } from "../typechain-types/contracts/NoDelegateCallGuard.sol/NoDelegatecallGuard";

describe("Example module tests", async function () {
  let deployer: Signer;
  let alice: Signer;
  let masterCopy: Safe;
  let proxyFactory: SafeProxyFactory;
  let safeFactory: Safe__factory;
  let safe: Safe;
  let exampleGuard: NoDelegateCallGuard;
  const threshold = 1;

  // Setup signers and deploy contracts before running tests
  beforeEach(async () => {
    [deployer, alice] = await ethers.getSigners();

    safeFactory = await ethers.getContractFactory("Safe", deployer);
    masterCopy = await safeFactory.deploy();

    proxyFactory = await (
      await ethers.getContractFactory("SafeProxyFactory", deployer)
    ).deploy();

    const ownerAddresses = [await alice.getAddress()];

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
      await ethers.getContractFactory("NoDelegatecallGuard", deployer)
    ).deploy();

    safe = await ethers.getContractAt("Safe", safeAddress);

    // Enable the module in the safe
    const enableGuardData = masterCopy.interface.encodeFunctionData(
      "setGuard",
      [exampleGuard.target]
    );

    // Execute the transaction to enable the module
    await execTransaction([alice], safe, safe.target, 0, enableGuardData, 0);
  });

  // Test case to verify token transfer to bob
  it("Should not allow delegatecall", async function () {
    const wallets = [alice];
    // Execute the transaction to enable the module
    await expect(
      execTransaction(wallets, safe, ZeroAddress, 0, "0x", 1)
    ).to.be.revertedWithCustomError(exampleGuard, "DelegateCallNotAllowed");
  });

  // Test case to verify token transfer to bob
  it("Should allow call", async function () {
    const wallets = [alice];

    expect(await execTransaction(wallets, safe, ZeroAddress, 0, "0x", 0));
  });
});
