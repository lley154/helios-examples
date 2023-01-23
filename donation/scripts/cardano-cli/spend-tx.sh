#!/usr/bin/env bash

# Unofficial bash strict mode.
# See: http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -e
set -o pipefail

# enabled debug flag for bash shell
set -x

# check if command line argument is empty or not present
if [ -z $1 ]; 
then
    echo "process-tx.sh:  Invalid script arguments"
    echo "Usage: process-tx.sh [devnet|preview|preprod|mainnet]"
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

mkdir -p $WORK
mkdir -p $WORK-backup
rm -f $WORK/*
rm -f $WORK-backup/*

# generate values from cardano-cli tool
cardano-cli query protocol-parameters $network --out-file $WORK/pparms.json

# load in local variable values
validator_script="$BASE/scripts/cardano-cli/$ENV/data/donation.plutus"
validator_script_addr=$(cardano-cli address build --payment-script-file "$validator_script" $network)
redeemer_file_path="$BASE/scripts/cardano-cli/$ENV/data/redeemer-spend.json"
admin_pkh=$(cat $ADMIN_PKH)

################################################################
# Spend the donation UTXO
################################################################

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
readarray black_list_utxo_array < $BASE/scripts/cardano-cli/$ENV/data/black-list-utxo.txt

# Step 2: Get the donation smart contract utxos
cardano-cli query utxo --address $validator_script_addr $network --out-file $WORK/validator-utxo.json

cat $WORK/validator-utxo.json | jq -r 'to_entries[] | select(.value.inlineDatum | length > 0) | .key' > $WORK/order_utxo_in.txt

readarray order_utxo_in_array < $WORK/order_utxo_in.txt
order_array_length="${#order_utxo_in_array[@]}"
order_utxo_in=""

# Find a utxo that is not in the blacklist 
for (( c=0; c<$order_array_length; c++ ))
do 
    if printf '%s' "${black_list_utxo_array[@]}" | grep -q -x "${order_utxo_in_array[$c]}"; 
        then 
            echo "UTXO on blacklist: ${order_utxo_in_array[$c]}"
        else 
            order_utxo_in=$(echo ${order_utxo_in_array[$c]} | tr -d '\n')
            break 
    fi
done


# Check if there are any utxos at the validator that we can
# use, if not, then exit
if [ -z $order_utxo_in ];
then
    exit 0
fi

order_datum_in=$(jq -r 'to_entries[] 
| select(.key == "'$order_utxo_in'") 
| .value.inlineDatum ' $WORK/validator-utxo.json)

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

merchant_split=$SPLIT
donor_split=$((100 - $SPLIT)) 
donor_ada_amount=$(($order_ada * $donor_split / 100))

if (($donor_ada_amount < $MIN_ADA_DONATION ));
then
    donor_ada=$MIN_ADA_DONATION
else
    donor_ada=$donor_ada_amount
fi

merchant_ada=$(($order_ada - $donor_ada))
now=$(date '+%Y/%m/%d-%H:%M:%S')

# verify that the amount paid of the order is the same
# as the order amount in shopify
shopify_order_amount=$(curl -H "X-Shopify-Access-Token: $NEXT_PUBLIC_ACCESS_TOKEN" "$NEXT_PUBLIC_SHOP/admin/api/2022-10/orders/"$order_id".json" | jq -r '.order.total_price')

#shopify_order_ada=$(bc <<< "scale=3; $shopify_order_amount / $ada_usd_price")
shopify_order_ada=$(python3 -c "print(round(($shopify_order_amount / $ada_usd_price), 3))")

#shopify_order_lovelace=$(bc <<< "scale=3; $shopify_order_ada * 1000000")
shopify_order_lovelace=$(python3 -c "print($shopify_order_ada * 1000000)")

shopify_order_ada_truncated=${shopify_order_lovelace%.*}
difference=$(($order_ada - $shopify_order_ada_truncated))
difference_abs=$(echo ${difference#-})

if (( $difference_abs > 10000 ));
then
    echo "Order amount mismtach between order amount in datum vs order amount in shopify for $order_id"
    exit -1
fi

metadata="{
\"1\" : {
    \"order_detail\" : {
        \"date\" : \"$now\",
        \"donation_ada_amount\" : \"$donor_ada\",
        \"donation_split\" : \"$donor_split%\",
        \"order_id\" : \"$order_id\",
        \"order_ada_amount\" : \"$order_ada\",
        \"ada_usd_price\" : \"$ada_usd_price\",
        \"version\" : \"0.1\"
        }
    }
}"

echo $metadata > $BASE/scripts/cardano-cli/$ENV/data/donation-spend-metadata.json
metadata_file_path="$BASE/scripts/cardano-cli/$ENV/data/donation-spend-metadata.json"


# Step 3: Build and submit the transaction
cardano-cli transaction build \
  --babbage-era \
  --cardano-mode \
  $network \
  --change-address "$admin_utxo_addr" \
  --tx-in-collateral "$admin_utxo_collateral_in" \
  --tx-in "$admin_utxo_in" \
  --tx-in "$order_utxo_in" \
  --spending-tx-in-reference "$VAL_REF_SCRIPT" \
  --spending-plutus-script-v2 \
  --spending-reference-tx-in-inline-datum-present \
  --spending-reference-tx-in-redeemer-file "$redeemer_file_path" \
  --tx-out "$MERCHANT_ADDR+$merchant_ada" \
  --tx-out "$DONOR_ADDR+$donor_ada" \
  --required-signer-hash "$admin_pkh" \
  --protocol-params-file "$WORK/pparms.json" \
  --metadata-json-file "$metadata_file_path" \
  --out-file $WORK/spend-tx-alonzo.body

echo "tx has been built"


cardano-cli transaction sign \
  --tx-body-file $WORK/spend-tx-alonzo.body \
  $network \
  --signing-key-file "${ADMIN_SKEY}" \
  --out-file $WORK/spend-tx-alonzo.tx

echo "tx has been signed"

echo "Submit the tx with plutus script and wait 5 seconds..."
cardano-cli transaction submit --tx-file $WORK/spend-tx-alonzo.tx $network


# Update shopify that the order is paid in full 
curl -s -S -d '{"order":{"id":'"$order_id"',"tags":"PAID IN FULL"}}' \
-X PUT "${NEXT_PUBLIC_SHOP}admin/api/2022-10/orders/$order_id.json" \
-H "X-Shopify-Access-Token: $NEXT_PUBLIC_ACCESS_TOKEN" \
-H "Content-Type: application/json" > /dev/null

