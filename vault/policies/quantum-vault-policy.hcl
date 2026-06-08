# quantum-vault-policy.hcl
# Quantum Vault — Hardened Access Policy
# Load with: vault policy write jenkins-policy vault/policies/quantum-vault-policy.hcl

# Allow full CRUD capabilities over the custom application password space
path "internal/data/app-passwords/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Allow checking metadata and version histories for the passwords
path "internal/metadata/app-passwords/*" {
  capabilities = ["read", "list"]
}
