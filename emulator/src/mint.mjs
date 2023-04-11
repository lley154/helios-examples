import { promises as fs } from 'fs';
import {
  Assets, 
  ConstrData, 
  NetworkEmulator,
  NetworkParams,
  Program, 
  Value, 
  textToBytes,
  TxOutput,
  Tx, 
} from "./helios.mjs";

/**
* Main calling function via the command line 
* Usage: npm test
*/
const main = async () => {

  // Set the Helios compiler optimizer flag
  let optimize = false;
  const minAda = BigInt(2000000);  // minimum lovelace needed to send an NFT

  try {
      // Create an Instance of NetworkEmulator
      const network = new NetworkEmulator();

      // Create a Wallet - we add 10ADA to start
      const alice = network.createWallet(BigInt(10000000));

      // Now lets tick the network on 10 slots,
      // this will allow the UTxOs to be created from Genisis
      network.tick(BigInt(10));

      // Now we are able to get the UTxOs in Alices Wallet
      // Note we provide the Address here, this is useful 
      // for getting the UTxOs from a script etc (later!)
      const utxos = await network.getUtxos(alice.address);
      console.log("************ PRE-TEST ************");

      for (const utxo of utxos) {
        console.log("wallet txId", utxo.txId.hex + "#" + utxo.utxoIdx);
        console.log("value", utxo.value.dump());
      }

      // NFT minting script
      const nftScript = await fs.readFile('./src/nft.hl', 'utf8');
      const nftProgram = Program.new(nftScript);
      nftProgram.parameters = {["TX_ID"] : utxos[0].txId.hex};
      nftProgram.parameters = {["TX_IDX"] : utxos[0].utxoIdx};
      const nftMPH = nftProgram.compile(optimize).mintingPolicyHash;

      // Start building the transaction
      const tx = new Tx();

      // Add the UTXO as inputs
      tx.addInputs(utxos);

      // Add the script as a witness to the transaction
      tx.attachScript(nftProgram.compile(optimize));

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

      console.log("");
      console.log("************ EXECUTE SMART CONTRACT ************");
      await tx.finalize(networkParams, alice.address, utxos);

      console.log("");
      console.log("************ SUBMIT TX ************");
      // Submit Tx to the network
      const txId = await network.submitTx(tx);
      console.log("TxId", txId.dump());

      // Tick the network on 10 more slots,
      network.tick(BigInt(10));

      const utxosFinal = await network.getUtxos(alice.address);
      console.log("");
      console.log("************ POST-TEST ************");
      for (const utxo of utxosFinal) {
        console.log("wallet txId", utxo.txId.hex + "#" + utxo.utxoIdx);
        console.log("value", utxo.value.dump());
      }
      
  } catch (err) {
      console.error(err);
  }
}

main();


