
import LockAda from '../components/LockAda';
import ClaimFunds from '../components/ClaimFunds';
import CancelVesting from '../components/CancelVesting';
import Head from 'next/head'
import type { NextPage } from 'next'
import styles from '../styles/Home.module.css'
import { useState, useEffect } from "react";
import WalletInfo from '../components/WalletInfo';
import {
  Assets,
  Address,
  ByteArrayData,
  Cip30Handle,
  Cip30Wallet,
  ConstrData,
  Datum,
  hexToBytes,
  IntData,
  ListData,
  MintingPolicyHash,
  NetworkParams,
  Program,
  Value,
  TxOutput,
  Tx,
  TxId,
  UTxO,
  WalletHelper
  } from "@hyperionbt/helios";

import path from 'path';
import { promises as fs } from 'fs';

declare global {
  interface Window {
      cardano:any;
  }
}

export async function getServerSideProps() {

  try {
    const contractDirectory = path.join(process.cwd(), 'contracts/');
    const fileContents = await fs.readFile(contractDirectory + 'vesting.hl', 'utf8');
    const contractScript = fileContents.toString();

    const valScript = {
      script: contractScript
    }

    return { props: valScript }
  } catch (err) {
    console.log('getServerSideProps', err);
  }
  // Contract not found
  return { props: {} };

}

const Home: NextPage = (props : any) => {

  const optimize = false;
  const script = props.script as string;
  const networkParamsUrl = process.env.NEXT_PUBLIC_NETWORK_PARAMS_URL as string;
  const blockfrostAPI = process.env.NEXT_PUBLIC_BLOCKFROST_API as string;
  const apiKey : string = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY as string;

  const [walletAPI, setWalletAPI] = useState<undefined | any>(undefined);
  const [tx, setTx] = useState({ txId : '' });
  const [threadToken, setThreadToken] = useState({ tt : '' });
  const [walletInfo, setWalletInfo] = useState({ balance : ''});
  const [walletIsEnabled, setWalletIsEnabled] = useState(false);
  const [whichWalletSelected, setWhichWalletSelected] = useState(undefined);

  useEffect(() => {
    const checkWallet = async () => {

      setWalletIsEnabled(await checkIfWalletFound());
    }
    checkWallet();
  }, [whichWalletSelected]);

  useEffect(() => {
    const enableSelectedWallet = async () => {
      if (walletIsEnabled) {
        const api = await enableWallet();
        setWalletAPI(api);
      }
    }
    enableSelectedWallet();
  }, [walletIsEnabled]);

  useEffect(() => {
    const updateWalletInfo = async () => {

        if (walletIsEnabled) {
            const _balance = await getBalance() as string;
            setWalletInfo({
              ...walletInfo,
              balance : _balance
            });
        }
    }
    updateWalletInfo();
  }, [walletAPI]);

  // user selects what wallet to connect to
  const handleWalletSelect = (obj : any) => {
    const whichWalletSelected = obj.target.value
    setWhichWalletSelected(whichWalletSelected);
  }

  const checkIfWalletFound = async () => {

    let walletFound = false;

    const walletChoice = whichWalletSelected;
    if (walletChoice === "nami") {
        walletFound = !!window?.cardano?.nami;
    } else if (walletChoice === "eternl") {
        walletFound = !!window?.cardano?.eternl;
    }
    return walletFound;
  }

  const enableWallet = async () => {

    try {
      const walletChoice = whichWalletSelected;
      if (walletChoice === "nami") {
          const handle: Cip30Handle = await window.cardano.nami.enable();
          const walletAPI = new Cip30Wallet(handle);
          return walletAPI;
        } else if (walletChoice === "eternl") {
          const handle: Cip30Handle = await window.cardano.eternl.enable();
          const walletAPI = new Cip30Wallet(handle);
          return walletAPI;
        }
    } catch (err) {
        console.log('enableWallet error', err);
    }
  }

  const getBalance = async () => {
    try {
        const walletHelper = new WalletHelper(walletAPI);
        const balanceAmountValue  = await walletHelper.calcBalance();
        const balanceAmount = balanceAmountValue.lovelace;
        const walletBalance : BigInt = BigInt(balanceAmount);
        return walletBalance.toLocaleString();
    } catch (err) {
        console.log('getBalance error: ', err);
    }
  }

  const lockAda = async (params : any) => {

    // Re-enable wallet API since wallet account may have been changed
    const api = await enableWallet();
    setWalletAPI(api);

    const benAddr = params[0] as string;
    const adaQty = params[1] as number;
    const dueDate = params[2] as string;
    const deadline = new Date(dueDate + "T00:00");

    const benPkh = Address.fromBech32(benAddr).pubKeyHash;
    const lovelaceAmt = Number(adaQty) * 1000000;
    const maxTxFee: number = 500000; // maximum estimated transaction fee
    const minChangeAmt: number = 1000000; // minimum lovelace needed to be sent back as change
    const adaAmountVal = new Value(BigInt(lovelaceAmt));
    const minUTXOVal = new Value(BigInt(lovelaceAmt + maxTxFee + minChangeAmt));

    // Get wallet UTXOs
    const walletHelper = new WalletHelper(walletAPI);
    const utxos = await walletHelper.pickUtxos(minUTXOVal);

    // Get change address
    const changeAddr = await walletHelper.changeAddress;

    // Determine the UTXO used for collateral
    const colatUtxo = await walletHelper.pickCollateral();

    // Compile the Helios script
    const compiledScript = Program.new(script).compile(optimize);

    // Extract the validator script address
    const valAddr = Address.fromValidatorHash(compiledScript.validatorHash);

    // Use the change address to derive the owner pkh
    const ownerPkh = changeAddr.pubKeyHash;

    // Construct the datum
    const datum = new ListData([new ByteArrayData(ownerPkh.bytes),
                                  new ByteArrayData(benPkh.bytes),
                                  new IntData(BigInt(deadline.getTime()))]);

    const inlineDatum = Datum.inline(datum);

    // Start building the transaction
    const tx = new Tx();

    // Add the UTXO as inputs
    tx.addInputs(utxos[0]);

    const mintScript =`minting nft

    const TX_ID: ByteArray = #` + utxos[0][0].txId.hex + `
    const txId: TxId = TxId::new(TX_ID)
    const outputId: TxOutputId = TxOutputId::new(txId, ` + utxos[0][0].utxoIdx + `)
    
    func main(ctx: ScriptContext) -> Bool {
        tx: Tx = ctx.tx;
        mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();
    
        assetclass: AssetClass = AssetClass::new(
            mph, 
            "Vesting Key".encode_utf8()
        );
        value_minted: Value = tx.minted;
    
        // Validator logic starts
        (value_minted == Value::new(assetclass, 1)).trace("NFT1: ") &&
        tx.inputs.any((input: TxInput) -> Bool {
                                        (input.output_id == outputId).trace("NFT2: ")
                                        }
        )
    }`

    // Compile the helios minting script
    const mintProgram = Program.new(mintScript).compile(optimize);

    // Add the script as a witness to the transaction
    tx.attachScript(mintProgram);

    // Construct the NFT that we will want to send as an output
    const nftTokenName = ByteArrayData.fromString("Vesting Key").toHex();
    const tokens: [number[], bigint][] = [[hexToBytes(nftTokenName), BigInt(1)]];

    // Create an empty Redeemer because we must always send a Redeemer with
    // a plutus script transaction even if we don't actually use it.
    const mintRedeemer = new ConstrData(0, []);

    // Indicate the minting we want to include as part of this transaction
    tx.mintTokens(
      mintProgram.mintingPolicyHash,
      tokens,
      mintRedeemer
    )

    const lockedVal = new Value(adaAmountVal.lovelace, new Assets([[mintProgram.mintingPolicyHash, tokens]]));

    // Add the destination address and the amount of Ada to lock including a datum
    tx.addOutput(new TxOutput(valAddr, lockedVal, inlineDatum));

    // Add the collateral
    tx.addCollateral(colatUtxo);

    const networkParams = new NetworkParams(
      await fetch(networkParamsUrl)
          .then(response => response.json())
    )
    console.log("tx before final", tx.dump());

    // Send any change back to the buyer
    await tx.finalize(networkParams, changeAddr);
    console.log("tx after final", tx.dump());

    console.log("Verifying signature...");
    const signatures = await walletAPI.signTx(tx);
    tx.addSignatures(signatures);

    console.log("Submitting transaction...");
    const txHash = await walletAPI.submitTx(tx);

    console.log("txHash", txHash.hex);
    setTx({ txId: txHash.hex });
    setThreadToken({ tt: mintProgram.mintingPolicyHash.hex });
  }

  // Get the utxo with the vesting key token at the script address
  const getKeyUtxo = async (scriptAddress : string, keyMPH : string, keyName : string ) => {

    console.log("getKeyUTXO:keyMPH", keyMPH);
    console.log("getKeyUTXO:keyName", keyName);

    const blockfrostUrl : string = blockfrostAPI + "/addresses/" + scriptAddress + "/utxos/" + keyMPH + keyName;
    console.log("blockfrost url", blockfrostUrl);

    let resp = await fetch(blockfrostUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        project_id: apiKey,
      },
    });

    if (resp?.status > 299) {
      throw console.error("vesting key token not found", resp);
    }
    const payload = await resp.json();

    if (payload.length == 0) {
      throw console.error("vesting key token not found");
    }
    const lovelaceAmount = payload[0].amount[0].quantity;
    const mph = MintingPolicyHash.fromHex(keyMPH);
    const tokenName = hexToBytes(keyName);

    const value = new Value(BigInt(lovelaceAmount), new Assets([
        [mph, [
            [tokenName, BigInt(1)],
        ]]
    ]));

    return new UTxO(
      TxId.fromHex(payload[0].tx_hash),
      BigInt(payload[0].output_index),
      new TxOutput(
        Address.fromBech32(scriptAddress),
        value,
        Datum.inline(ListData.fromCbor(hexToBytes(payload[0].inline_datum)))
      )
    );
  }

  const claimFunds = async (params : any) => {

    // Re-enable wallet API since wallet account may have been changed
    const api = await enableWallet();
    setWalletAPI(api);

    const keyMPH = params[0] as string;
    const minAda : number = 2000000; // minimum lovelace needed to send an NFT
    const maxTxFee: number = 500000; // maximum estimated transaction fee
    const minChangeAmt: number = 1000000; // minimum lovelace needed to be sent back as change
    const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));

    // Get wallet UTXOs
    const walletHelper = new WalletHelper(walletAPI);
    const utxos = await walletHelper.pickUtxos(minUTXOVal);

    // Get change address
    const changeAddr = await walletHelper.changeAddress;

    // Determine the UTXO used for collateral
    const colatUtxo = await walletHelper.pickCollateral();

    // Compile the Helios script
    const compiledScript = Program.new(script).compile(optimize);

    // Extract the validator script address
    const valAddr = Address.fromValidatorHash(compiledScript.validatorHash);

    // Use the change address as the claimer address
    const claimAddress = changeAddr;

    // Start building the transaction
    const tx = new Tx();

    // Add UTXO inputs
    tx.addInputs(utxos[0]);

    // Create the Claim redeemer to spend the UTXO locked
    // at the script address
    const valRedeemer = new ConstrData(1, []);

    // Get the UTXO that has the vesting key token in it
    const valUtxo = await getKeyUtxo(valAddr.toBech32(), keyMPH, ByteArrayData.fromString("Vesting Key").toHex());
    tx.addInput(valUtxo, valRedeemer);

    // Send the value of the of the valUTXO to the recipient
    tx.addOutput(new TxOutput(claimAddress, valUtxo.value));

    // Specify when this transaction is valid from.   This is needed so
    // time is included in the transaction which will be use by the validator
    // script.  Add two hours for time to live and offset the current time
    // by 5 mins.
    const currentTime = new Date().getTime();
    const earlierTime = new Date(currentTime - 5 * 60 * 1000);
    const laterTime = new Date(currentTime + 2 * 60 * 60 * 1000);

    tx.validFrom(earlierTime);
    tx.validTo(laterTime);

    // Add the recipients pkh
    tx.addSigner(claimAddress.pubKeyHash);

    // Add the validator script to the transaction
    tx.attachScript(compiledScript);

    // Add the collateral
    tx.addCollateral(colatUtxo);

    const networkParams = new NetworkParams(
      await fetch(networkParamsUrl)
          .then(response => response.json())
    )
    console.log("tx before final", tx.dump());

    // Send any change back to the buyer
    await tx.finalize(networkParams, changeAddr);
    console.log("tx after final", tx.dump());

    console.log("Verifying signature...");
    const signatures = await walletAPI.signTx(tx);
    tx.addSignatures(signatures);

    console.log("Submitting transaction...");
    const txHash = await walletAPI.submitTx(tx);

    console.log("txHash", txHash.hex);
    setTx({ txId: txHash.hex });
  }

  const cancelVesting = async (params : any) => {

    // Re-enable wallet API since wallet account may have been changed
    const api = await enableWallet();
    setWalletAPI(api);
    
    const keyMPH = params[0] as string;
    const minAda : number = 2000000; // minimum lovelace needed to send an NFT
    const maxTxFee: number = 500000; // maximum estimated transaction fee
    const minChangeAmt: number = 1000000; // minimum lovelace needed to be sent back as change
    const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));

    // Get wallet UTXOs
    const walletHelper = new WalletHelper(walletAPI);
    const utxos = await walletHelper.pickUtxos(minUTXOVal);

    // Get change address
    const changeAddr = await walletHelper.changeAddress;

    // Determine the UTXO used for collateral
    const colatUtxo = await walletHelper.pickCollateral();

    // Compile the Helios script
    const compiledScript = Program.new(script).compile(optimize);

    // Extract the validator script address
    const valAddr = Address.fromValidatorHash(compiledScript.validatorHash);

    // Use the change address as the owner address
    const ownerAddress = changeAddr;

    // Start building the transaction
    const tx = new Tx();
    tx.addInputs(utxos[0]);

    // Create the Cancel redeemer to spend the UTXO locked
    // at the script address
    const valRedeemer = new ConstrData(0, []);

    // Get the UTXO that has the vesting key token in it
    const valUtxo = await getKeyUtxo(valAddr.toBech32(), keyMPH, ByteArrayData.fromString("Vesting Key").toHex());
    tx.addInput(valUtxo, valRedeemer);

    // Send the value of the of the valUTXO back to the owner
    tx.addOutput(new TxOutput(ownerAddress, valUtxo.value));

    // Specify when this transaction is valid from.   This is needed so
    // time is included in the transaction which will be use by the validator
    // script.  Add two hours for time to live and offset the current time
    // by 5 mins.
    const currentTime = new Date().getTime();
    const earlierTime = new Date(currentTime - 5 * 60 * 1000);
    const laterTime = new Date(currentTime + 2 * 60 * 60 * 1000);

    tx.validFrom(earlierTime);
    tx.validTo(laterTime);

    // Add the recipiants pkh
    tx.addSigner(ownerAddress.pubKeyHash);

    // Add the validator script to the transaction
    tx.attachScript(compiledScript);

    // Add the collateral
    tx.addCollateral(colatUtxo);

    const networkParams = new NetworkParams(
      await fetch(networkParamsUrl)
          .then(response => response.json())
    )
    console.log("tx before final", tx.dump());

    // Send any change back to the buyer
    await tx.finalize(networkParams, changeAddr);
    console.log("tx after final", tx.dump());

    console.log("Verifying signature...");
    const signatures = await walletAPI.signTx(tx);
    tx.addSignatures(signatures);

    console.log("Submitting transaction...");
    const txHash = await walletAPI.submitTx(tx);

    console.log("txHash", txHash.hex);
    setTx({ txId: txHash.hex });
  }


  return (
    <div className={styles.container}>
      <Head>
        <title>Helios Tx Builder</title>
        <meta name="description" content="Littercoin web tools page" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h3 className={styles.title}>
          Helios Tx Builder
        </h3>

        <div className={styles.borderwallet}>
            <p>
              Connect to your wallet
            </p>
            <p className={styles.borderwallet}>
              <input type="radio" id="nami" name="wallet" value="nami" onChange={handleWalletSelect}/>
                <label>Nami</label>
            </p>
            <p className={styles.borderwallet}>
                <input type="radio" id="eternl" name="wallet" value="eternl" onChange={handleWalletSelect}/>
                <label>Eternl</label>
            </p>
          </div>
          <div className={styles.borderwallet}>
            View Smart Contract:  &nbsp;  &nbsp;
            <a href="/api/vesting" target="_blank" rel="noopener noreferrer">vesting.hl</a>
          </div>
          {!tx.txId && walletIsEnabled && <div className={styles.border}><WalletInfo walletInfo={walletInfo}/></div>}
          {tx.txId && <div className={styles.border}><b>Transaction Success!!!</b>
          <p>TxId &nbsp;&nbsp;<a href={"https://preprod.cexplorer.io/tx/" + tx.txId} target="_blank" rel="noopener noreferrer" >{tx.txId}</a></p>
          <p>Please wait until the transaction is confirmed on the blockchain and reload this page before doing another transaction</p>
          <p></p>
          </div>}
          {threadToken.tt && <div className={styles.border}>
          <p>Please copy and save your vesting key</p>
          <b><p>{threadToken.tt}</p></b>
          <p>You will need this key to unlock your funds</p>
          </div>}

          {walletIsEnabled && !tx.txId && <div className={styles.border}><LockAda onLockAda={lockAda}/></div>}
          {walletIsEnabled && !tx.txId && <div className={styles.border}><ClaimFunds onClaimFunds={claimFunds}/></div>}
          {walletIsEnabled && !tx.txId && <div className={styles.border}><CancelVesting onCancelVesting={cancelVesting}/></div>}

      </main>

      <footer className={styles.footer}>

      </footer>
    </div>
  )
}

export default Home
