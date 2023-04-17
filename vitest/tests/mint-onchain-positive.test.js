import { describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs';
import {
  Assets, 
  ConstrData, 
  MintingPolicyHash,
  NetworkEmulator,
  NetworkParams,
  Program, 
  Value, 
  textToBytes,
  TxOutput,
  Tx, 
} from "@hyperionbt/helios";

/**
* Positive Test Case
* Only mint 1 token and UTXO parameter is included in the inputs
*/
describe('ThreadToken Positive Test Cases', () => {

    const main = async () => {

        // Set the Helios compiler optimizer flag
        let optimize = false;
        const minAda = BigInt(2000000);  // minimum lovelace needed to send an NFT
    
        try {
            // Create an Instance of NetworkEmulator
            const network = new NetworkEmulator();
    
            // Create a Wallet - we add 10ADA to start
            const alice = network.createWallet(BigInt(10000000));

            // Add additional lovelace UTXO to the wallet
            network.createUtxo(alice, BigInt(5000000));

            // Create a Test Asset
            const testAsset = new Assets();
            testAsset.addComponent(
                MintingPolicyHash.fromHex(
                '16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c'
                ),
                Array.from(new TextEncoder().encode('Test Asset Name')),
                BigInt(1)
            );

            // Add additional Token to the wallet
            network.createUtxo(alice, BigInt(2000000), testAsset);

            // Now lets tick the network on 10 slots,
            // this will allow the UTxOs to be created from Genisis
            network.tick(BigInt(10));
    
            // Now we are able to get the UTxOs in Alices Wallet
            const utxos = await network.getUtxos(alice.address);
    
            // NFT minting script
            const nftScript = await fs.readFile('./src/nft.hl', 'utf8');
            const nftProgram = Program.new(nftScript);
            nftProgram.parameters = {["TX_ID"] : utxos[0].txId.hex};
            nftProgram.parameters = {["TX_IDX"] : utxos[0].utxoIdx};
            const nftCompiledProgram = nftProgram.compile(optimize);
            const nftMPH = nftCompiledProgram.mintingPolicyHash;
    
            // Start building the transaction
            const tx = new Tx();
    
            // Add the UTXO as inputs
            tx.addInputs(utxos);
    
            // Add the script as a witness to the transaction
            tx.attachScript(nftCompiledProgram);
    
            // Create an empty Redeemer because we must always send a Redeemer with
            // a plutus script transaction even if we don't actually use it.
            const nftRedeemer = new ConstrData(0, []);
            const token = [[textToBytes("Thread Token"), BigInt(1)]];
            
            // Add the mint to the tx
            tx.mintTokens(
                nftMPH,
                token,
                nftRedeemer
            )
    
            // Attach the output with the minted nft to the destination address
            tx.addOutput(new TxOutput(
                alice.address,
                new Value(minAda, new Assets([[nftMPH, token]]))
            ));
    
            // Network Parameters
            const networkParamsFile = await fs.readFile('./src/preprod.json', 'utf8');
            const networkParams = new NetworkParams(JSON.parse(networkParamsFile.toString()));
    
            await tx.finalize(networkParams, alice.address, utxos);
    
            // Submit Tx to the network
            const txId = await network.submitTx(tx);

            // Tick the network on 10 more slots,
            network.tick(BigInt(10));

            return true;
    
        } catch (err) {
            //console.error("Mint tx failed", err);
            return false;
        }
    }

    it('must only mint 1 token', async () => {

        const logMsgs = new Set();
        const logSpy = vi.spyOn(global.console, 'log')
                         .mockImplementation((msg) => { logMsgs.add(msg); });
        
        let mainStatus = await main();
        logSpy.mockRestore();
        if (!mainStatus) {
            console.log("Smart Contract Messages: ", logMsgs);
        }
        expect(mainStatus).toBe(true);
        expect(logMsgs.has('TT1: true')).toBeTruthy();
    })

    it('must contain the parameter UTXO in the inputs', async () => {

        const logMsgs = new Set();
        const logSpy = vi.spyOn(global.console, 'log')
                         .mockImplementation((msg) => { logMsgs.add(msg); });
        
        let mainStatus = await main();
        logSpy.mockRestore();
        if (!mainStatus) {
            console.log("Smart Contract Messages: ", logMsgs);
        }
        expect(mainStatus).toBe(true);
        expect(logMsgs.has('TT2: true')).toBeTruthy();  
    })
})
  
