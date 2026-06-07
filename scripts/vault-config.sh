#!/bin/bash
# scripts/vault-config.sh — Vault Internal Configuration for Enterprise Password Saver
#
# Prerequisites:
#   1. Vault must be running and unsealed.
#   2. VAULT_TOKEN must be exported (root token for initial setup).

export VAULT_ADDR='http://127.0.0.1:8200'

echo "==================================================="
echo "   ENTERPRISE PASSWORD SAVER: VAULT CONFIGURATION"
echo "==================================================="

# 1. Enable KV-V2 Secrets Engine
echo ""
echo "Step 1: Enabling KV-V2 Secrets Engine at 'internal/'"
vault secrets enable -path=internal kv-v2 || echo "  → KV-V2 engine already enabled, skipping."

# 2. Enable AppRole Auth Method
echo ""
echo "Step 2: Enabling AppRole Authentication"
vault auth enable approle || echo "  → AppRole already enabled, skipping."

# 3. Apply Password Saver Policy
echo ""
echo "Step 3: Applying Password Saver Policy (jenkins-policy)"
vault policy write jenkins-policy vault/policies/password-saver-policy.hcl
echo "  → Policy 'jenkins-policy' written from password-saver-policy.hcl"

# 4. Create Jenkins AppRole (scoped to password saver policy)
echo ""
echo "Step 4: Creating Jenkins AppRole"
vault write auth/approle/role/jenkins-role \
    secret_id_ttl=10m \
    token_num_uses=10 \
    token_ttl=20m \
    token_max_ttl=30m \
    policies="jenkins-policy"
echo "  → Role 'jenkins-role' configured with 20-min token TTL."

# 5. Output Role ID and Secret ID for Jenkins credential setup
echo ""
echo "---------------------------------------------------"
echo "Vault Configuration Complete!"
echo "---------------------------------------------------"
ROLE_ID=$(vault read -field=role_id auth/approle/role/jenkins-role/role-id)
SECRET_ID=$(vault write -f -field=secret_id auth/approle/role/jenkins-role/secret-id)

echo "  Role ID   : $ROLE_ID"
echo "  Secret ID : $SECRET_ID"
echo ""
echo "IMPORTANT: Save these in Jenkins → Manage Credentials → Vault App Role"
echo "Set the credential ID to: vault-approle-id"
echo "---------------------------------------------------"
echo ""
echo "Quick validation — write your first password:"
echo "  vault kv put internal/app-passwords/production/database root_pass='YourPassword123!'"
echo "  vault kv get -field=root_pass internal/app-passwords/production/database"
echo "---------------------------------------------------"
