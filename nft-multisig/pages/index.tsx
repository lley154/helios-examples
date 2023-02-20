
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
  Signature,
  TxOutput,
  Tx,
  Value,
  WalletHelper, 
  PubKeyHash} from "@hyperionbt/helios";

declare global {
  interface Window {
      cardano:any;
  }
}

const Home: NextPage = () => {

  const optimize = false;
  const networkParamsUrl = "https://d1t0d7c2nekuk0.cloudfront.net/preprod.json";
  //const networkParamsUrl = "https://d1t0d7c2nekuk0.cloudfront.net/preview.json";
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

    // re-enable wallet api if the wallet account has been changed
    const api = await enableWallet();
    setWalletAPI(api);
    
    const address = params[0];
    const name = params[1];
    const description = params[2];
    const img = params[3];
    const sellerAddr = params[4];

    const buyerPkh = Address.fromBech32(address).pubKeyHash;
    const sellerPkh = Address.fromBech32(sellerAddr).pubKeyHash;
    const adminPkh = PubKeyHash.fromHex("b9abcf6867519e28042048aa11207214a52e6d5d3288b752d1c27682");

    const minAda : number = 2000000; // minimum lovelace needed to send an NFT
    const maxTxFee: number = 500000; // maximum estimated transaction fee
    const minChangeAmt: number = 1000000; // minimum lovelace needed to be sent back as change
    const minAdaVal = new Value(BigInt(minAda));
    const minUTXOVal = new Value(BigInt(minAda + maxTxFee + minChangeAmt));

    // Get wallet UTXOs
    const walletHelper = new WalletHelper(walletAPI);
    const utxos = await walletHelper.pickUtxos(minUTXOVal);

    // Get change address
    const changeAddr = await walletHelper.changeAddress;

    // Determine the UTXO used for collateral
    const colatUtxo = await walletHelper.pickCollateral();

    // Start building the transaction
    const tx = new Tx();

    // Add the UTXO as inputs
    tx.addInputs(utxos[0]);

    const mintScript =`minting nft

    const TX_ID: ByteArray = #` + utxos[0][0].txId.hex + `
    const txId: TxId = TxId::new(TX_ID)
    const outputId: TxOutputId = TxOutputId::new(txId, ` + utxos[0][0].utxoIdx + `)
    const BUYER: PubKeyHash = PubKeyHash::new(#` + buyerPkh.hex + `)
    const SELLER: PubKeyHash = PubKeyHash::new(#` + sellerPkh.hex + `)
    const ADMIN: PubKeyHash = PubKeyHash::new(#` + adminPkh.hex + `)
    
    func main(ctx: ScriptContext) -> Bool {
        tx: Tx = ctx.tx;
        mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();
    
        assetclass: AssetClass = AssetClass::new(
            mph, 
            "` + name + `".encode_utf8()
        );
        value_minted: Value = tx.minted;
    
        // Validator logic starts
        (value_minted == Value::new(assetclass, 1)).trace("NFT1: ") &&
        (tx.inputs.any((input: TxInput) -> Bool {
                                        (input.output_id == outputId).trace("NFT2: ")
                                        }) &&
        tx.is_signed_by(BUYER).trace("NFT3: ") &&
        tx.is_signed_by(SELLER).trace("NFT4: ") &&
        tx.is_signed_by(ADMIN).trace("NFT5: ")
        )
    }`

    console.log("NFT multi-sig minting script: ", mintScript);

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

    // Add buyer and seller required PKHs for the tx
    tx.addSigner(buyerPkh);
    tx.addSigner(sellerPkh);
    tx.addSigner(adminPkh);

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

    // Store the transaction so it can be signed by the buyer and the seller
    setTxBodyBuyer(tx);
  }

  const buyerSign = async () => {

    // re-enable wallet api if the wallet account has been changed
    const api = await enableWallet();
    setWalletAPI(api);

    console.log("Get buyer to sign...");
    const signatures = await walletAPI.signTx(txBodyBuyer);
    txBodyBuyer.addSignatures(signatures);
    setTxBodySeller(txBodyBuyer);
    console.log("tx after buyer signed", txBodyBuyer.dump());
  }

  const sellerSignSubmit = async () => {

    // re-enable wallet api if the wallet account has been changed
    const api = await enableWallet();
    setWalletAPI(api);

    // Get signature from Seller's browser wallet
    console.log("Get Seller to sign...");
    const signatures = await walletAPI.signTx(txBodySeller);
    txBodySeller.addSignatures(signatures);
    console.log("tx after seller signed", txBodySeller.dump());

    
    // Get back-end signature from non-browser wallet private key
    console.log("Get Back-end to sign...");
    const response = await fetch('/api/getSignature', {
      method: 'POST',
      body: JSON.stringify({ txCbor: bytesToHex(txBodySeller.toCbor()) }),
      headers: {
        'Content-type' : 'application/json'
      },
    }) 
    const cborData = await response.json();
    const signature = Signature.fromCbor(hexToBytes(cborData));
    txBodySeller.addSignature(signature);
    console.log("tx after back-end signed", txBodySeller.dump());

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
            <p className={styles.borderwallet}>
                <input type="radio" id="eternl" name="wallet" value="eternl" onChange={handleWalletSelect}/>
                <label>Eternl</label>
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
