
import MintNFT from '../components/MintNFT';
import BuyerSign from '../components/BuyerSign';
import SellerSignSubmit from '../components/SellerSignSubmit';
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
  Cip30Handle,
  Cip30Wallet,
  ConstrData, 
  hexToBytes,
  NetworkParams,
  Program,
  Value, 
  TxOutput,
  TxWitnesses,
  Tx, 
  UTxO,
  WalletHelper } from "@hyperionbt/helios";

declare global {
  interface Window {
      cardano:any;
  }
}

const Home: NextPage = () => {

  const optimize = false;
  const networkParamsUrl = "https://d1t0d7c2nekuk0.cloudfront.net/preprod.json";
  const [walletAPI, setWalletAPI] = useState<undefined | any>(undefined);
  const [txBodyBuyer, setTxBodyBuyer] = useState<undefined | any>(undefined);
  const [txBodySeller, setTxBodySeller] = useState<undefined | any>(undefined);
  const [tx, setTx] = useState({ txId : '' });
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

  const mintNFT = async (params : any) => {

    const address = params[0];
    const name = params[1];
    const description = params[2];
    const img = params[3];
    const sellerAddr = params[4];

    const buyerPkh = Address.fromBech32(address).pubKeyHash;
    const sellerPkh = Address.fromBech32(sellerAddr).pubKeyHash;
    const minAdaVal = new Value(BigInt(2000000));  // minimum Ada needed to send an NFT

    // Get wallet UTXOs
    const walletHelper = new WalletHelper(walletAPI);
    const utxos = await walletHelper.pickUtxos(minAdaVal);
 
    // Get change address
    const changeAddr = await walletHelper.changeAddress;

    // Determine the UTXO used for collateral
    const colatUtxo = await walletHelper.pickCollateral();

    // Start building the transaction
    const tx = new Tx();

    // Only pull the 1st utxo so it can be the one used in the minting policy
    if (utxos.length > 0) {
      tx.addInput(utxos[0][0]);  
    } else {
      throw console.error("No UTXO found");
    }

    const mintScript =`minting nft

    const TX_ID: ByteArray = #` + utxos[0][0].txId.hex + `
    const txId: TxId = TxId::new(TX_ID)
    const outputId: TxOutputId = TxOutputId::new(txId, ` + utxos[0][0].utxoIdx + `)
    const BUYER: PubKeyHash = PubKeyHash::new(#` + buyerPkh.hex + `)
    const SELLER: PubKeyHash = PubKeyHash::new(#` + sellerPkh.hex + `)
    
    func main(ctx: ScriptContext) -> Bool {
        tx: Tx = ctx.tx;
        mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();
    
        assetclass: AssetClass = AssetClass::new(
            mph, 
            "` + name + `".encode_utf8()
        );
        value_minted: Value = tx.minted;
    
        // Validator logic starts
        value_minted == Value::new(assetclass, 1) &&
        (tx.inputs.any((input: TxInput) -> Bool {
                                        (input.output_id == outputId).trace("NFT1: ")
                                        }) &&
        tx.is_signed_by(BUYER).trace("NFT2: ") &&
        tx.is_signed_by(SELLER).trace("NFT3: ")
        )
    }`
    console.log("mintScript", mintScript);

    // Compile the helios minting script
    const mintProgram = Program.new(mintScript).compile(optimize);

    // Add the script as a witness to the transaction
    tx.attachScript(mintProgram);

    // Construct the NFT that we will want to send as an output
    const nftTokenName = ByteArrayData.fromString(name).toHex();
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

    // Construct the output and include both the minimum Ada as well as the minted NFT
    tx.addOutput(new TxOutput(
      Address.fromBech32(address),
      new Value(minAdaVal.lovelace, new Assets([[mintProgram.mintingPolicyHash, tokens]]))
    ));

    // Add the collateral utxo
    tx.addCollateral(colatUtxo);
    tx.addSigner(buyerPkh);
    tx.addSigner(sellerPkh);

    const networkParams = new NetworkParams(
      await fetch(networkParamsUrl)
          .then(response => response.json())
    )

    // Attached the metadata for the minting transaction
    tx.addMetadata(721, {"map": [[mintProgram.mintingPolicyHash.hex, {"map": [[name, 
                                      {
                                        "map": [["name", name], 
                                                ["description", description],
                                                ["image", img]
                                              ]
                                      }
                                  ]]}
                                ]]
                        }
                  );

    console.log("tx before final", tx.dump());

    // Send any change back to the buyer
    await tx.finalize(networkParams, changeAddr);
    console.log("tx after final", tx.dump());

    // Store the transaction so it can be signed by the buyer and the seller
    setTxBodyBuyer(tx);
  }

  const buyerSign = async () => {

    console.log("Verifying buyer signature...");
    const signatures = await walletAPI.signTx(txBodyBuyer);
    txBodyBuyer.addSignatures(signatures);

    console.log("buyerSigned", txBodyBuyer);

    setTxBodySeller(txBodyBuyer);
    
  } 

  const sellerSignSubmit = async () => {

    console.log("Verifying seller signature...");
    const signatures = await walletAPI.signTx(txBodySeller);
    txBodySeller.addSignatures(signatures);
    
    console.log("Submitting transaction...");
    const txHash = await walletAPI.submitTx(txBodySeller);

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
          </div>
            {!tx.txId && walletIsEnabled && <div className={styles.border}><WalletInfo walletInfo={walletInfo}/></div>}
            {tx.txId && <div className={styles.border}><b>Transaction Success!!!</b>
            <p>TxId &nbsp;&nbsp;<a href={"https://preprod.cexplorer.io/tx/" + tx.txId} target="_blank" rel="noopener noreferrer" >{tx.txId}</a></p>
            <p>Please wait until the transaction is confirmed on the blockchain and reload this page before doing another transaction</p>
          </div>}
          {walletIsEnabled && !tx.txId && !txBodyBuyer && !txBodySeller && <div className={styles.border}><MintNFT onMintNFT={mintNFT}/></div>}
          {walletIsEnabled && !tx.txId && txBodyBuyer && !txBodySeller && <div className={styles.border}><BuyerSign onBuyerSign={buyerSign}/></div>}
          {walletIsEnabled && !tx.txId && txBodySeller && <div className={styles.border}><SellerSignSubmit onSellerSignSubmit={sellerSignSubmit}/></div>}
      </main>

      <footer className={styles.footer}>

      </footer>
    </div>
  )
}

export default Home