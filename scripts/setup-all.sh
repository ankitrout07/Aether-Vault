#!/bin/bash
# scripts/setup-all.sh — Master Orchestration: Enterprise Password Saver Setup

set -e

echo "===================================================="
echo "   ENTERPRISE PASSWORD SAVER SETUP: VAULT + JENKINS"
echo "===================================================="

# ── Step 1: Install Vault & register systemd service ────────────────────────
echo ""
echo "--- Step 1: Installing Vault & Registering Service ---"
bash scripts/vault-setup.sh

echo ""
echo "--- Starting Vault Service ---"
sudo systemctl start vault
sleep 2

# ── Step 2: Check Vault status ───────────────────────────────────────────────
echo ""
echo "--- Step 2: Checking Vault Status ---"
STATUS=$(vault status -format=json 2>/dev/null || true)

# Handle uninitialized Vault
if [[ $(echo "$STATUS" | grep -c '"initialized": false') -eq 1 ]]; then
    echo "Vault is NOT initialized."
    echo "Running 'vault operator init'..."
    INIT_OUT=$(vault operator init)
    echo "----------------------------------------------------"
    echo "CRITICAL: SAVE THESE KEYS SECURELY (physical safe or team password manager)!"
    echo "$INIT_OUT"
    echo "----------------------------------------------------"
    echo "Press ENTER once you have saved the unseal keys and root token."
    read -r
else
    echo "Vault is already initialized."
fi

# Handle sealed Vault
STATUS=$(vault status -format=json 2>/dev/null || true)
if [[ $(echo "$STATUS" | grep -c '"sealed": true') -eq 1 ]]; then
    echo "Vault is SEALED. Please unseal it now."
    echo "Run 'vault operator unseal' 3 times in a separate terminal using 3 different keys."
    echo "Waiting for unseal..."
    while [[ $(vault status -format=json 2>/dev/null | grep -c '"sealed": true') -eq 1 ]]; do
        sleep 5
        echo "  Still sealed... (check your other terminal)"
    done
    echo "Vault UNSEALED successfully!"
else
    echo "Vault is already unsealed."
fi

# ── Step 3: Apply password saver configuration ───────────────────────────────
echo ""
echo "--- Step 3: Configuring Vault for Enterprise Password Saver ---"
echo "Please enter your VAULT_ROOT_TOKEN to proceed:"
read -rs ROOT_TOKEN
export VAULT_TOKEN="$ROOT_TOKEN"
export VAULT_ADDR="http://127.0.0.1:8200"

bash scripts/vault-config.sh

# ── Step 4: Seed a sample credential for validation ──────────────────────────
echo ""
echo "--- Step 4: Seeding Sample Credential for Validation ---"
vault kv put internal/app-passwords/production/database \
    root_pass="UltraSecureProduction2026!"

echo "  → Sample credential written to: internal/app-passwords/production/database"
echo ""
echo "Verifying read-back parity..."
RESULT=$(vault kv get -field=root_pass internal/app-passwords/production/database)
if [ -n "$RESULT" ]; then
    echo "  ✓ Read-back successful — KV engine is fully operational."
else
    echo "  ✗ Read-back failed. Check Vault policy and engine configuration."
    exit 1
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "===================================================="
echo "   SETUP COMPLETE — ENTERPRISE PASSWORD SAVER READY"
echo "===================================================="
echo ""
echo "Next steps:"
echo "  1. Install the 'HashiCorp Vault Plugin' in Jenkins."
echo "  2. Add a 'Vault App Role' credential using the Role ID and Secret ID above."
echo "  3. Set the Jenkins credential ID to: vault-approle-id"
echo "  4. Trigger the Jenkins pipeline → 'Build with Parameters'."
echo "  5. Use the CLI: bash scripts/vault-vault.sh store [path] [key] [value]"
echo "===================================================="
