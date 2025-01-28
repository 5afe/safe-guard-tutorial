import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, ZeroAddress } from "ethers";
import { Safe, Safe__factory, SafeProxyFactory } from "../typechain-types";
import { execTransaction } from "./utils/utils";
import { NoDelegatecallGuard } from "../typechain-types/contracts/NoDelegatecallGuard";

describe("NoDelegatecallGuard", async function () {
  let deployer: Signer;
  let alice: Signer;
  let masterCopy: Safe;
  let proxyFactory: SafeProxyFactory;
  let safeFactory: Safe__factory;
  let safe: Safe;
  let exampleGuard: NoDelegatecallGuard;
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

    // Deploy the NoDelegatecallGuard contract
    exampleGuard = await (
      await ethers.getContractFactory("NoDelegatecallGuard", deployer)
    ).deploy();

    safe = await ethers.getContractAt("Safe", safeAddress);

    // Set the guard in the safe
    const setGuardData = masterCopy.interface.encodeFunctionData("setGuard", [
      exampleGuard.target,
    ]);

    // Execute the transaction to set the Guard
    await execTransaction([alice], safe, safe.target, 0, setGuardData, 0);
  });

  it("Should not allow delegatecall", async function () {
    const wallets = [alice];

    await expect(
      execTransaction(wallets, safe, ZeroAddress, 0, "0x", 1)
    ).to.be.revertedWithCustomError(exampleGuard, "DelegatecallNotAllowed");
  });

  it("Should allow call", async function () {
    const wallets = [alice];

    expect(await execTransaction(wallets, safe, ZeroAddress, 0, "0x", 0));
  });

  it("Should allow to replace the guard", async function () {
    const wallets = [alice];

    const setGuardData = masterCopy.interface.encodeFunctionData("setGuard", [
      ZeroAddress,
    ]);
    expect(
      await execTransaction(
        wallets,
        safe,
        await safe.getAddress(),
        0,
        setGuardData,
        0
      )
    );
  });
});
