#!/usr/bin/env bash

# Unofficial bash strict mode.
# See: http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -e
set -o pipefail

# enabled debug flag for bash shell
set -x

export WORK=/config/workspace/repo/work
mkdir -p $WORK

source_addr=addr_test1vq5s7k4kwqz4rrfe8mm9jz9tpm7c5u93yfwwsaw708yxs5sm70qjg
source_utxo=9967b0ddceb9f4f16703c6893f93ddd25be4b3ccf2182f4095371924bcfe895c#1
destination_addr=addr_test1vq7k907l7e59t52skm8e0ezsnmmc7h4xy30kg2klwc5n8rqug2pds
user_skey=/config/workspace/repo/.keys/user/key.skey
network="--testnet-magic 1"

# generate param file from cardano-cli tool
cardano-cli query protocol-parameters $network --out-file $WORK/pparms.json


cardano-cli transaction build \
  --babbage-era \
  --cardano-mode \
  $network \
  --change-address "$source_addr" \
  --tx-in "$source_utxo" \
  --tx-out "$destination_addr+2000000" \
  --protocol-params-file "$WORK/pparms.json" \
  --out-file $WORK/transfer-tx-alonzo.body
  
echo "tx has been built"

cardano-cli transaction sign \
  --tx-body-file $WORK/transfer-tx-alonzo.body \
  $network \
  --signing-key-file "${user_skey}" \
  --out-file $WORK/transfer-tx-alonzo.tx

echo "tx has been signed"

echo "Submit the tx with plutus script and wait 5 seconds..."
cardano-cli transaction submit --tx-file $WORK/transfer-tx-alonzo.tx $network