import type { NextApiRequest, NextApiResponse } from 'next'
import { Bip32PrivateKey } from '@stricahq/bip32ed25519';
import { mnemonicToEntropy } from 'bip39';
import { Buffer } from "buffer";
import { blake2b } from "blakejs";
import {
    bytesToHex, 
    hexToBytes, 
    Signature,
    Tx } from "@hyperionbt/helios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse ) {

    const hash32 = (data: any) => {
        const hash = blake2b(data, undefined, 32);
        return Buffer.from(hash);
    };
        
    function harden(num: number) {
        return 0x80000000 + num;
    }
    const entropy = mnemonicToEntropy(
        [ "witness", "pipe", "egg", "awake", "hood", "false", "fury", "announce", "one", "wool", "diagram", "weird", "phone", "treat", "bacon" ].join(' ')
        );
    
    try {
        
        const buffer = Buffer.from(entropy, 'hex');
        const rootKey = await Bip32PrivateKey.fromEntropy(buffer);

        const accountKey = rootKey
        .derive(harden(1852)) // purpose
        .derive(harden(1815)) // coin type
        .derive(harden(0)); // account #0
        
        const utxoPrvKey = accountKey
        .derive(0) // external
        .derive(0)
        .toPrivateKey();

        const utxoPubKey = accountKey
        .derive(0) // external
        .derive(0)
        .toBip32PublicKey();
        
        const txCbor = req.body.txCbor;
        const tx = Tx.fromCbor(hexToBytes(txCbor));

        // PUT YOUR BACK-END VALIDATION LOGIC HERE

        const txBodyCbor = bytesToHex((tx.body).toCbor());
        const txBody = Buffer.from(txBodyCbor, 'hex');
        const txHash = hash32(txBody);

        const pubKeyArray = [...utxoPubKey.toBytes().subarray(0, 32)];
        const signatureArray = [...utxoPrvKey.sign(txHash)];

        const signature = new Signature(pubKeyArray,
                                        signatureArray);

        const sigCbor = bytesToHex(signature.toCbor());
        //console.log("signature", signature.dump());

        res.status(200).json(sigCbor);
    }
    catch (err) {
        res.status(500).json('getSignature error: ' + err);
    }
}

