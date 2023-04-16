## This is an example of using the Helios emulator

## Getting Started

Install npm modules and then run the test suite

```bash
npm install
npm run dev
```

## Console output
```
~/src/helios-examples/emulator$ npm run dev

> emulator@1.0.0 dev
> node ./src/mint.mjs

************ PRE-TEST ************
Wallet UTXOs:
txId 0000000000000000000000000000000000000000000000000000000000000000#0
value { lovelace: '10000000', assets: {} }
txId 0000000000000000000000000000000000000000000000000000000000000001#0
value { lovelace: '5000000', assets: {} }
txId 0000000000000000000000000000000000000000000000000000000000000002#0
value {
  lovelace: '2000000',
  assets: {
    '16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c': { '54657374204173736574204e616d65': '1' }
  }
}

************ EXECUTE SMART CONTRACT ************
TT1: true
TT2: true
TT1: true
TT2: true

************ SUBMIT TX ************
TxId b3edd9fa7eb02904a2b0d19b22bbd4ced22d240a647bfbb4d48f65a1c1a67049

************ POST-TEST ************
Wallet UTXOs:
txId b3edd9fa7eb02904a2b0d19b22bbd4ced22d240a647bfbb4d48f65a1c1a67049#0
value {
  lovelace: '2000000',
  assets: {
    '37f96d6ef3f984b372f5c3379c266e6abb1e3a39b1b905a44ea4ead7': { '54687265616420546f6b656e': '1' }
  }
}
txId b3edd9fa7eb02904a2b0d19b22bbd4ced22d240a647bfbb4d48f65a1c1a67049#1
value {
  lovelace: '1064570',
  assets: {
    '16aa5486dab6527c4697387736ae449411c03dcd20a3950453e6779c': { '54657374204173736574204e616d65': '1' }
  }
}
txId b3edd9fa7eb02904a2b0d19b22bbd4ced22d240a647bfbb4d48f65a1c1a67049#2
value { lovelace: '13676369', assets: {} }
```
