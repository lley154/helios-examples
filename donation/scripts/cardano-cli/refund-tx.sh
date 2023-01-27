#!/usr/bin/env bash

# Unofficial bash strict mode.
# See: http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -e
set -o pipefail

# enabled debug flag for bash shell
set -x

# check if command line argument is empty or not present
if [ -z $3 ]; 
then
    echo "refund-tx.sh:  Invalid script arguments"
    echo "Usage: refund-tx.sh [devnet|preview|preprod|mainnet] txHash txIndx"
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


##################################################################
#  Set the refund utxo and amount to refund - START
##################################################################
# Specify the utxo at the smart contract address we want to refund
order_utxo_in=$2
order_utxo_in_txid=$order_utxo_in#$3

##################################################################
#  Set the refund utxo and amount to refund - END
##################################################################

# generate values from cardano-cli tool
cardano-cli query protocol-parameters $network --out-file $WORK/pparms.json

# load in local variable values
validator_script="$BASE/scripts/cardano-cli/$ENV/data/donation.plutus"
validator_script_addr=$(cardano-cli address build --payment-script-file "$validator_script" $network)
redeemer_file_path="$BASE/scripts/cardano-cli/$ENV/data/redeemer-refund.json"
admin_pkh=$(cat $ADMIN_PKH)


# Step 1: Get UTXOs from admin
# There needs to be at least 2 utxos that can be consumed; one for spending of the token
# and one uxto for collateral

admin_utxo_addr=$(cardano-cli address build $network --payment-verification-key-file "$ADMIN_VKEY")
cardano-cli query utxo --address "$admin_utxo_addr" --cardano-mode $network --out-file $WORK/admin-utxo.json

cat $WORK/admin-utxo.json | jq -r 'to_entries[] | select(.value.value.lovelace > '$COLLATERAL_ADA' ) | .key' > $WORK/admin-utxo-valid.json
readarray admin_utxo_valid_array < $WORK/admin-utxo-valid.json
admin_utxo_in=$(echo $admin_utxo_valid_array | tr -d '\n')

cat $WORK/admin-utxo.json | jq -r 'to_entries[] | select(.value.value.lovelace == '$COLLATERAL_ADA' ) | .key' > $WORK/admin-utxo-collateral-valid.json
readarray admin_utxo_valid_array < $WORK/admin-utxo-collateral-valid.json
admin_utxo_collateral_in=$(echo $admin_utxo_valid_array | tr -d '\n')


# Step 2: Get the donation smart contract utxos
cardano-cli query utxo --address $validator_script_addr $network --out-file $WORK/validator-utxo.json

order_datum_in=$(jq -r 'to_entries[] 
| select(.key == "'$order_utxo_in_txid'") 
| .value.inlineDatum' $WORK/validator-utxo.json)

echo -n "$order_datum_in" > $WORK/datum-in.json


# Get the order details from the datum
order_ada=$(jq -r '.list[0].int' $WORK/datum-in.json)

order_id_encoded=$(jq -r '.list[1].bytes' $WORK/datum-in.json)
#order_id=$(echo -n "$order_id_encoded=" | xxd -r -p)
echo -n "$order_id_encoded" > $WORK/order_id.encoded
order_id=$(python3 hexdump.py -r $WORK/order_id.encoded)

ada_usd_price_encoded=$(jq -r '.list[2].bytes' $WORK/datum-in.json)
#ada_usd_price=$(echo -n "$ada_usd_price_encoded=" | xxd -r -p)
echo -n "$ada_usd_price_encoded" > $WORK/ada_usd_price.encoded
ada_usd_price=$(python3 hexdump.py -r $WORK/ada_usd_price.encoded)

now=$(date '+%Y/%m/%d-%H:%M:%S')

metadata="{
\"1\" : {
    \"refund_detail\" : {
        \"date\" : \"$now\",
        \"order_id\" : \"$order_id\",
        \"refund_ada_amount\" : \"$order_ada\",
        \"ada_usd_price\" : \"$ada_usd_price\",
        \"version\" : \"0.1\"
        }
    }
}"

echo $metadata > $BASE/scripts/cardano-cli/$ENV/data/donation-refund-metadata.json
metadata_file_path="$BASE/scripts/cardano-cli/$ENV/data/donation-refund-metadata.json"


# Step 3: Build and submit the transaction
cardano-cli transaction build \
  --babbage-era \
  --cardano-mode \
  $network \
  --change-address "$admin_utxo_addr" \
  --tx-in-collateral "$admin_utxo_collateral_in" \
  --tx-in "$admin_utxo_in" \
  --tx-in "$order_utxo_in_txid" \
  --spending-tx-in-reference "$VAL_REF_SCRIPT" \
  --spending-plutus-script-v2 \
  --spending-reference-tx-in-inline-datum-present \
  --spending-reference-tx-in-redeemer-file "$redeemer_file_path" \
  --tx-out "$REFUND_ADDR+$order_ada" \
  --required-signer-hash "$admin_pkh" \
  --protocol-params-file "$WORK/pparms.json" \
  --metadata-json-file "$metadata_file_path" \
  --out-file $WORK/refund-tx-alonzo.body

echo "tx has been built"

cardano-cli transaction sign \
  --tx-body-file $WORK/refund-tx-alonzo.body \
  $network \
  --signing-key-file "${ADMIN_SKEY}" \
  --out-file $WORK/refund-tx-alonzo.tx

echo "tx has been signed"

echo "Submit the tx with plutus script and wait 5 seconds..."
cardano-cli transaction submit --tx-file $WORK/refund-tx-alonzo.tx $network

