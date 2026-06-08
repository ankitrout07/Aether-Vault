#!/usr/bin/env bash
# scripts/vault-vault.sh — Quantum Vault CLI
# Terminal utility for secure secret storage and retrieval on NTZ-LINUX-003.
#
# Usage:
#   ./vault-vault.sh store [path] [key] [value]
#   ./vault-vault.sh get   [path] [key]
#
# Examples:
#   ./vault-vault.sh store legacy-app/api token_key "d83jd92m10s"
#   ./vault-vault.sh get   legacy-app/api token_key

set -euo pipefail

export VAULT_ADDR="http://127.0.0.1:8200"

# ─── Colour helpers ───────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

usage() {
    echo ""
    echo -e "${YELLOW}Quantum Vault — Vault CLI${NC}"
    echo "────────────────────────────────────────"
    echo "Usage:"
    echo "  $0 store [path] [key] [value]"
    echo "  $0 get   [path] [key]"
    echo ""
    echo "Examples:"
    echo "  $0 store production/database root_pass \"MySecret123!\""
    echo "  $0 get   production/database root_pass"
    echo ""
    exit 1
}

# ─── Argument validation ──────────────────────────────────────────────────────
if [ $# -lt 3 ]; then
    usage
fi

ACTION="${1}"
PATH_NAME="${2}"
KEY_NAME="${3}"
VAULT_KV_PATH="internal/app-passwords/${PATH_NAME}"

# ─── Vault connectivity check ─────────────────────────────────────────────────
if ! vault status > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Cannot reach Vault at ${VAULT_ADDR}. Is the service running?${NC}"
    exit 1
fi

# ─── Operations ───────────────────────────────────────────────────────────────
if [ "${ACTION}" == "store" ]; then
    if [ -z "${4:-}" ]; then
        echo -e "${RED}ERROR: Missing secret value to store.${NC}"
        usage
    fi
    VALUE="${4}"
    vault kv put "${VAULT_KV_PATH}" "${KEY_NAME}=${VALUE}"
    echo -e "${GREEN}SUCCESS: Secret safely written to Vault → ${VAULT_KV_PATH} [${KEY_NAME}]${NC}"

elif [ "${ACTION}" == "get" ]; then
    RESULT=$(vault kv get -field="${KEY_NAME}" "${VAULT_KV_PATH}")
    echo -e "${GREEN}SUCCESS: Retrieved secret for [${KEY_NAME}] at path [${VAULT_KV_PATH}]${NC}"
    echo "${RESULT}"

else
    echo -e "${RED}ERROR: Unknown action '${ACTION}'. Use 'store' or 'get'.${NC}"
    usage
fi
