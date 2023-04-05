
import axios from 'axios';
import SubmitTx from '../components/SubmitTx';
import Head from 'next/head'
import type { NextPage } from 'next'
import styles from '../styles/Home.module.css'
import { useState } from "react";
import {
  hexToBytes,
  Tx } from "@hyperionbt/helios";

declare global {
  interface Window {
      cardano:any;
  }
}

const Home: NextPage = () => {

const [tx, setTx] = useState({ txId : '' });

const blockfrostAPI = process.env.NEXT_PUBLIC_BLOCKFROST_API;
if (blockfrostAPI == undefined) {
  console.error("NEXT_PUBLIC_BLOCKFROST_API not set");
}

const submitTxBlockFrost = async (tx: string) => {

    //const payload = new Uint8Array(tx.toCbor());
    const payload = new Uint8Array(hexToBytes(tx));
    const blockfrostUrl = blockfrostAPI + "/tx/submit";

    const apiKey = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY;
    if (apiKey == undefined) {
      console.error("NEXT_PUBLIC_BLOCKFROST_API_KEY not set");
    }

    try {
        let res = await axios({
            url: blockfrostUrl,
            data: payload,
            method: 'post',
            timeout: 30000,
            headers: {
                'Content-Type': 'application/cbor',
                'project_id': apiKey
            }
        })
        if(res.status == 200){
            return res.data;
        } else {
            throw res.data;
        }   
    }
    catch (err) {
        throw err;
    }
}


  const submitTx = async (params : any) => {

    const cborTx = params[0];
    //const tx = Tx.fromCbor(hexToBytes(cborTx));

    console.log("Submitting transaction...");
    //const txHash = await walletAPI.submitTx(tx);
    const txHash = await submitTxBlockFrost(cborTx);

    console.log("txHash", txHash);
    setTx({ txId: txHash });
   }


  return (
    <div className={styles.container}>
      <Head>
        <title>Tx Submit</title>
        <meta name="description" content="CBOR TX Submit" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
        <main className={styles.main}>
          <h3 className={styles.title}>
            Tx Submit
          </h3>
              {tx.txId && <div className={styles.border}><b>Transaction Success!!!</b>
              <p>TxId &nbsp;&nbsp;<a href={"https://preprod.cexplorer.io/tx/" + tx.txId} target="_blank" rel="noopener noreferrer" >{tx.txId}</a></p>
              <p>Please wait until the transaction is confirmed on the blockchain and reload this page before doing another transaction</p>
              </div>}
            {!tx.txId && <div><SubmitTx onSubmitTx={submitTx}/></div>}
        </main>
      <footer className={styles.footer}>
      </footer>
    </div>
  )
}

export default Home
