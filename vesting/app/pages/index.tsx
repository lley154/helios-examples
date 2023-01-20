
import LockAda from '../components/LockAda';
import Head from 'next/head'
import type { NextPage } from 'next'
import styles from '../styles/Home.module.css'
import { useState, useEffect } from "react";
import WalletInfo from '../components/WalletInfo';
import {
  Assets,
  Address, 
  bytesToHex,
  ByteArrayData,
  ConstrData, 
  Datum,
  hexToBytes,
  IntData,
  NetworkParams,
  ListData,
  Program,
  Value, 
  TxOutput,
  TxWitnesses,
  Tx, 
  UTxO,
  MintingPolicyHash} from "@hyperionbt/helios";

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
    //console.log("contractScript", contractScript);

    const valScript = {
      script: contractScript
    }

    return { props: valScript }
  } catch (err) {
    console.log('getServerSideProps', err);
  } 
  // No valid response from api
  return { props: {} };

}


const Home: NextPage = (props : any) => {

  const optimize = false;
  const networkParamsUrl = "https://d1t0d7c2nekuk0.cloudfront.net/preprod.json";
  const script = props.script as string;
  //console.log("script", script);

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

    let walletwalletAPI = undefined;
      try {
        const walletChoice = whichWalletSelected;
        if (walletChoice === "nami") {
            walletwalletAPI = await window.cardano.nami.enable();
        } else if (walletChoice === "eternl") {
            walletwalletAPI = await window.cardano.eternl.enable(); 
        } 
        return walletwalletAPI 
    } catch (err) {
        console.log('enableWallet error', err);
    }
  }

  const getBalance = async () => {
    try {
        const balanceCBORHex = await walletAPI.getBalance();
        const balanceAmountValue =  Value.fromCbor(hexToBytes(balanceCBORHex));
        const balanceAmount = balanceAmountValue.lovelace;
        const walletBalance : BigInt = BigInt(balanceAmount);
        return walletBalance.toLocaleString();
    } catch (err) {
        console.log('getBalance error: ', err);
    }
  }

  const lockAda = async (params : any) => {

    const benAddr = params[0] as string;
    const adaQty = params[1] as number;
    const dueDate = params[2] as string;
    console.log("dueDate", dueDate);
    const deadline = new Date(dueDate + "T00:00");
    console.log("deadline", deadline);
    const deadlineSec = deadline.getTime();
    console.log("deadlineSec", deadlineSec);

    const benPkh = Address.fromBech32(benAddr).pubKeyHash;
    const adaAmountVal = new Value(BigInt((adaQty)*1000000));

    // get the UTXOs from wallet, but they are in CBOR format, so need to convert them
    const cborUtxos = await walletAPI.getUtxos(bytesToHex(adaAmountVal.toCbor()));
    let utxos = [];

    for (const cborUtxo of cborUtxos) {
      const _utxo = UTxO.fromCbor(hexToBytes(cborUtxo));
      utxos.push(_utxo);
    }

    var cborColatUtxo;
    if (whichWalletSelected == "eternl") {
      cborColatUtxo = await walletAPI.getCollateral();
    } else if (whichWalletSelected == "nami") {
      cborColatUtxo = await walletAPI.experimental.getCollateral();
    } else {
      throw console.error("No wallet selected")
    }

    if (cborColatUtxo.length == 0) {
      throw console.error("No collateral set in wallet");
    }
    const colatUtxo = UTxO.fromCbor(hexToBytes(cborColatUtxo[0]));

    // Compile the Helios script 
    const compiledScript = Program.new(script).compile(optimize);
    
    // Extract the validator script address
    const valAddr = Address.fromValidatorHash(compiledScript.validatorHash);

    // Get the change address from the wallet
    const hexChangeAddr = await walletAPI.getChangeAddress();
    const changeAddr = Address.fromHex(hexChangeAddr);

    // Use the change address to derive the owner pkh
    const ownerPkh = Address.fromHex(hexChangeAddr).pubKeyHash;

    // Construct the datum
    const datum = new ListData([new ByteArrayData(ownerPkh.bytes),
                                  new ByteArrayData(benPkh.bytes),
                                  new IntData(BigInt(deadline.getTime()))]);

    const inlineDatum = Datum.inline(datum);

    // Start building the transaction
    const tx = new Tx();
    
    // Only pull the 1st utxo so it can be the one used in the minting policy
    if (utxos.length > 0) {
      tx.addInput(utxos[0]);  
    } else {
      throw console.error("No UTXO found");
    }


    const mintScript =`minting nft

    const TX_ID: ByteArray = #` + utxos[0].txId.hex + `
    const txId: TxId = TxId::new(TX_ID)
    const outputId: TxOutputId = TxOutputId::new(txId, ` + utxos[0].utxoIdx + `)
    
    func main(ctx: ScriptContext) -> Bool {
        tx: Tx = ctx.tx;
        mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();
    
        assetclass: AssetClass = AssetClass::new(
            mph, 
            "Vesting Key".encode_utf8()
        );
        value_minted: Value = tx.minted;
    
        // Validator logic starts
        value_minted == Value::new(assetclass, 1) &&
        tx.inputs.any((input: TxInput) -> Bool {
                                        (input.output_id == outputId).trace("NFT1: ")
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

    console.log("Waiting for wallet signature...");
    const walletSig = await walletAPI.signTx(bytesToHex(tx.toCbor()), true)

    console.log("Verifying signature...");
    const signatures = TxWitnesses.fromCbor(hexToBytes(walletSig)).signatures
    tx.addSignatures(signatures)

    console.log("Submitting transaction...");
    const txHash = await walletAPI.submitTx(bytesToHex(tx.toCbor()));
    console.log("txHash", txHash);
    setTx({ txId: txHash });
    setThreadToken({ tt: mintProgram.mintingPolicyHash.hex });
    return txHash;
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
          </div>
            {!tx.txId && walletIsEnabled && <div className={styles.border}><WalletInfo walletInfo={walletInfo}/></div>}
            {tx.txId && <div className={styles.border}><b>Transaction Success!!!</b>
            <p>TxId &nbsp;&nbsp;<a href={"https://preprod.cexplorer.io/tx/" + tx.txId} target="_blank" rel="noopener noreferrer" >{tx.txId}</a></p>
            <p>Please wait until the transaction is confirmed on the blockchain and reload this page before doing another transaction</p>
            <p></p>
            <p>Please remember your vesting key</p> 
            <p>{threadToken.tt}</p>
            <p>You will need this key to unlock your funds</p>
          </div>}
          {walletIsEnabled && !tx.txId && <div className={styles.border}><LockAda onLockAda={lockAda}/></div>}
          
      </main>

      <footer className={styles.footer}>

      </footer>
    </div>
  )
}

export default Home