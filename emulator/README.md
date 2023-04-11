## This is an example of using the Helios emulator

## Getting Started

First, run the development server:

```bash
npm install
npm test
```

## Console output
```
~/src/helios-examples/emulator$ npm test

> emulator@1.0.0 test
> node ./src/mint.mjs

************ PRE-TEST ************
wallet txId 0000000000000000000000000000000000000000000000000000000000000000#0
value { lovelace: '10000000', assets: {} }

************ EXECUTE SMART CONTRACT ************
TT1: true
TT2: true
TT1: true
TT2: true

************ SUBMIT TX ************
TxId 500fbde8956a875dcf1cf89cfd7bf8fd199d5019da848ba3df9683f46ef08913

************ POST-TEST ************
wallet txId 500fbde8956a875dcf1cf89cfd7bf8fd199d5019da848ba3df9683f46ef08913#0
value {
  lovelace: '2000000',
  assets: {
    '2e731a86d95b79d54da0e95f248bd7392891ee6972f771a1271575bb': { '54687265616420546f6b656e': '1' }
  }
}
wallet txId 500fbde8956a875dcf1cf89cfd7bf8fd199d5019da848ba3df9683f46ef08913#1
value { lovelace: '7757110', assets: {} }
```
