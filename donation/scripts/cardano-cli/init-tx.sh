#!/usr/bin/env bash

##############################################################
# You must do these steps first before running this script
##############################################################
#
# Step 1.   Confirm you have 2 UTXO at admin address (5 Ada for Collateral, and anything greater than MIN_ADA_OUTPUT_TX_REF)
# Step 2.   Update src/donation.hl if there has been any 
#           changes in the merchant and donor wallets, if the 
#           split has changed and any version number changes.
# Step 3.   deno run --allow-read --allow-write src/deploy-donation.js
# Step 4.   Copy deploy/* scripts/cardano-cli/[devnet|preview|preprod|mainnet]/data
##############################################################


# Unofficial bash strict mode.
# See: http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -e
set -o pipefail

# enabled debug flag for bash shell
set -x

# check if command line argument is empty or not present
if [ -z $1 ]; 
then
    echo "init-tx.sh:  Invalid script arguments"
    echo "Usage: init-tx.sh [devnet|preview|preprod|mainnet]"
    exit 1
fi
ENV=$1

# Pull in global export variables
MY_DIR=$(dirname $(readlink -f $0))
source $MY_DIR/$ENV/global-export-variables.sh

if [ "$ENV" == "mainnet" ];
then
    network="--mainnet"
else
    network="--testnet-magic $TESTNET_MAGIC"
fi

echo "Socket path: $CARDANO_NODE_SOCKET_PATH"
ls -al "$CARDANO_NODE_SOCKET_PATH"

mkdir -p $WORK
mkdir -p $WORK-backup
rm -f $WORK/*
rm -f $WORK-backup/*

# generate values from cardano-cli tool
$CARDANO_CLI query protocol-parameters $network --out-file $WORK/pparms.json

# load in local variable values
validator_script="$BASE/scripts/cardano-cli/$ENV/data/donation.plutus"
validator_script_addr=$($CARDANO_CLI address build --payment-script-file "$validator_script" $network)
#echo $validator_script_addr > $BASE/scripts/cardano-cli/$ENV/data/donation.addr
admin_pkh=$(cat $ADMIN_PKH)

echo "starting donation init script"

# Step 1: Get UTXOs from admin
# There needs to be at least 2 utxos that can be consumed; one for spending 
# and one uxto for collateral

admin_utxo_addr=$($CARDANO_CLI address build $network --payment-verification-key-file "$ADMIN_VKEY")
$CARDANO_CLI query utxo --address "$admin_utxo_addr" --cardano-mode $network --out-file $WORK/admin-utxo.json

cat $WORK/admin-utxo.json | jq -r 'to_entries[] | select(.value.value.lovelace > '$MIN_ADA_OUTPUT_TX_REF' ) | .key' > $WORK/admin-utxo-valid.json
readarray admin_utxo_valid_array < $WORK/admin-utxo-valid.json
admin_utxo_in=$(echo $admin_utxo_valid_array | tr -d '\n')

cat $WORK/admin-utxo.json | jq -r 'to_entries[] | select(.value.value.lovelace == '$COLLATERAL_ADA' ) | .key' > $WORK/admin-utxo-collateral-valid.json
readarray admin_utxo_valid_array < $WORK/admin-utxo-collateral-valid.json
admin_utxo_collateral_in=$(echo $admin_utxo_valid_array | tr -d '\n')


# Step 2: Build and submit the transaction
$CARDANO_CLI transaction build \
  --babbage-era \
  --cardano-mode \
  $network \
  --change-address "$admin_utxo_addr" \
  --tx-in-collateral "$admin_utxo_collateral_in" \
  --tx-in "$admin_utxo_in" \
  --tx-out "$validator_script_addr+$MIN_ADA_OUTPUT_TX_REF" \
  --tx-out-reference-script-file "$validator_script" \
  --protocol-params-file "$WORK/pparms.json" \
  --out-file $WORK/init-tx-alonzo.body


echo "tx has been built"

$CARDANO_CLI transaction sign \
  --tx-body-file $WORK/init-tx-alonzo.body \
  $network \
  --signing-key-file "${ADMIN_SKEY}" \
  --out-file $WORK/init-tx-alonzo.tx

echo "tx has been signed"

echo "Submit the tx with plutus script and wait 5 seconds..."
$CARDANO_CLI transaction submit --tx-file $WORK/init-tx-alonzo.tx $network

