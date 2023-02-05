#!/usr/bin/env bash

######################################################################
# Before you can run this script, please make sure you have identified
# a UTXO that you can spend and that there is sufficient amount of Ada
# in that UTXO.
######################################################################


# Unofficial bash strict mode.
# See: http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -e
set -o pipefail

# enabled debug flag for bash shell
set -x

export WORK=/config/workspace/repo/work
mkdir -p $WORK

source_addr=addr_test1vq5s7k4kwqz4rrfe8mm9jz9tpm7c5u93yfwwsaw708yxs5sm70qjg
source_utxo=4a0364c49f5541a0b409cf85fe3aa3ca1a3cc2e9bcad963b00e476e937e38270#0
destination_addr=addr_test1qqq967dwdp009smfeqtzhve89fyuqjydkvwc9md5atyg2429gnmszjc7hyf685vp7qxeffjd568s3p234fg5ryhrkvjsn7muqm
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