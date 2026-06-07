# password-saver-policy.hcl
# Enterprise Password Saver — Hardened Access Policy
# Load with: vault policy write jenkins-policy vault/policies/password-saver-policy.hcl

# Allow full CRUD capabilities over the custom application password space
path "internal/data/app-passwords/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Allow checking metadata and version histories for the passwords
path "internal/metadata/app-passwords/*" {
  capabilities = ["read", "list"]
}
