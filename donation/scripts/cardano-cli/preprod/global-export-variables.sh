#!/usr/bin/env bash

# Unofficial bash strict mode.
# See: http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -e
set -o pipefail


# Define export variables
export BASE=/config/workspace/repo/donation
export WORK=$BASE/work
export TESTNET_MAGIC=1
export ADMIN_VKEY=/config/workspace/repo/.keys/admin/key.vkey
export ADMIN_SKEY=/config/workspace/repo/.keys/admin/key.skey
export ADMIN_PKH=/config/workspace/repo/.keys/admin/key.pkh
export MIN_ADA_OUTPUT_TX=2000000
export MIN_ADA_OUTPUT_TX_REF=25000000
export COLLATERAL_ADA=5000000
export MERCHANT_ADDR=addr_test1vq7k907l7e59t52skm8e0ezsnmmc7h4xy30kg2klwc5n8rqug2pds
export DONOR_ADDR=addr_test1vzetpfww4aaunft0ucvcrxugj8nt4lhltsktya0rx0uh48cqghjfg
export REFUND_ADDR=addr_test1vzs24vjh8salzqt5pahgvr34ewfwagxaxr5pz7eswugzn2gmw4f5w
export VAL_REF_SCRIPT=d6c4a585ffbbdcc371a3472e829133643c9dfa4f1b61a4ccb8e75fd4480c22ce#0
export SPLIT=90
export MIN_ADA_DONATION=1000000