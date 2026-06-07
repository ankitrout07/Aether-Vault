# 🔐 Enterprise Password Saver — Powered by HashiCorp Vault & Jenkins

A **self-service, zero-trust credential vault** for teams and automation pipelines. Store, retrieve, and rotate operational secrets (database passwords, API keys, SSH credentials) through a hardened HashiCorp Vault backend — with Jenkins as the automation engine and a CLI tool for terminal-native workflows.

> **Pivoted from:** Azure Infrastructure Secret Management  
> **Pivoted to:** General-purpose Enterprise Password Saver — any secret, any team, any service.

---

## 🚀 Quick Start (One Command Setup)

Run the master orchestration script on your Ubuntu machine to install, configure, and validate the entire stack:

```bash
bash scripts/setup-all.sh
```

This script will:
- Install Vault & register the `vault.service` systemd unit
- Initialize, unseal, and configure the KV-V2 secrets engine
- Apply the Password Saver access policy
- Configure the Jenkins AppRole and output credentials
- Seed a sample credential and perform a read-back parity check

---

## 🧠 The "Why" Behind the Project

| Problem | This Project's Solution |
| :--- | :--- |
| Passwords scattered across Slack, `.env` files, spreadsheets | **One encrypted source of truth** — Vault KV-V2 |
| Credentials leaked in CI/CD logs | **MaskPasswordsBuildWrapper** + ephemeral env vars |
| No audit trail when a secret is accessed | **Vault audit log** — every read/write timestamped with identity |
| Rotating a password means updating 10 places | **Update in Vault once**, all consumers get it instantly |
| No access control on who can see what | **HCL policies** enforce least-privilege per path |

---

## 🏗️ Technical Architecture

The workflow uses a **Machine-to-Machine (M2M)** handshake called **AppRole**:

| Step | Actor | Action |
| :--: | :--- | :--- |
| **1** | Jenkins | Presents **RoleID + SecretID** → Vault authenticates |
| **2** | Vault | Issues a **short-lived token** (20-min TTL) |
| **3** | Vault | Checks attached **Policy** → grants CRUD on `app-passwords/*` |
| **4** | Jenkins | Executes **STORE** or **RETRIEVE** based on build parameter |
| **5** | Vault | Writes/reads the KV secret; logs the operation |
| **6** | Jenkins | Workspace wiped; token expires — **zero footprint** |

```
┌─────────────────────────────────────────────────────────┐
│                   Jenkins Pipeline                       │
│  ┌──────────────┐         ┌────────────────────────┐    │
│  │  Parameters  │─────────▶  withVault() wrapper   │    │
│  │  ACTION      │         │  AppRole Authentication │    │
│  │  SECRET_PATH │         └──────────┬─────────────┘    │
│  │  SECRET_KEY  │                    │                   │
│  │  SECRET_VALUE│         ┌──────────▼─────────────┐    │
│  └──────────────┘         │   HashiCorp Vault KV   │    │
│                            │  internal/app-passwords│    │
│                            └────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Project Deliverables

| Deliverable | File | Purpose |
| :--- | :--- | :--- |
| **Password Vault Pipeline** | `jenkins/Jenkinsfile` | Parameterized STORE/RETRIEVE pipeline |
| **Access Policy** | `vault/policies/password-saver-policy.hcl` | CRUD policy for `app-passwords/*` |
| **Legacy Policy** | `vault/policies/jenkins-policy.hcl` | Same policy, kept for AppRole binding |
| **CLI Utility** | `scripts/vault-vault.sh` | Terminal-native store/get commands |
| **Vault Config** | `scripts/vault-config.sh` | Automates KV engine + AppRole setup |
| **Master Setup** | `scripts/setup-all.sh` | Full one-command bootstrap |

---

## 🛠️ Setup Phases

### Phase 1 — Vault Host Foundation

```bash
bash scripts/vault-setup.sh          # Install Vault + systemd
sudo systemctl start vault           # Start the service
vault operator init                  # CRITICAL: save the 5 unseal keys + root token
vault operator unseal                # Run 3× with 3 different keys
export VAULT_TOKEN="<root-token>"
vault login $VAULT_TOKEN
```

---

### Phase 2 & 3 — Automated Vault Configuration

```bash
bash scripts/vault-config.sh
```

This script:
1. Enables KV-V2 at `internal/`
2. Enables AppRole auth
3. Applies `password-saver-policy.hcl` as `jenkins-policy`
4. Creates the `jenkins-role` AppRole
5. **Outputs the Role ID and Secret ID** — save these for Phase 4

---

### Phase 4 — Jenkins Integration

1. **Install Plugin:** `HashiCorp Vault Plugin` in Jenkins Plugin Manager
2. **Add Credentials:** Jenkins → Manage Credentials → *Vault App Role Credential*
   - Role ID and Secret ID from Phase 3
   - Credential ID: **`vault-approle-id`**
3. **Configure System:** Jenkins → Configure System → Vault → URL: `http://127.0.0.1:8200`

---

### Phase 5 — Running the Password Pipeline

1. Create a Pipeline job pointing to `jenkins/Jenkinsfile`
2. Click **Build with Parameters**
3. Fill in:
   - `ACTION` → `STORE` or `RETRIEVE`
   - `SECRET_PATH` → e.g. `app-passwords/production/database`
   - `SECRET_KEY` → e.g. `root_pass`
   - `SECRET_VALUE` → *(only for STORE)*
4. Trigger the build

> **Security note:** `SECRET_VALUE` is a `password` parameter type in Jenkins — it is masked in the build configuration UI and wrapped in `MaskPasswordsBuildWrapper` so it never appears in console output.

---

### Phase 6 — CLI Usage (NTZ-LINUX-003 Terminal)

Make the script executable once:

```bash
chmod +x scripts/vault-vault.sh
```

**Store a secret:**
```bash
./scripts/vault-vault.sh store production/database root_pass "UltraSecure2026!"
./scripts/vault-vault.sh store staging/redis     cache_key "r3d1s$ecret"
./scripts/vault-vault.sh store team/github       deploy_token "ghp_abc123"
```

**Retrieve a secret:**
```bash
./scripts/vault-vault.sh get production/database root_pass
./scripts/vault-vault.sh get staging/redis       cache_key
```

---

### Phase 7 — Validation & Audit

```bash
# 1. Load the access policy
vault policy write jenkins-policy vault/policies/password-saver-policy.hcl

# 2. Write a test credential
vault kv put internal/app-passwords/production/database root_pass="UltraSecureProduction2026!"

# 3. Read it back and confirm parity
vault kv get -field=root_pass internal/app-passwords/production/database

# 4. List all secrets at a path
vault kv list internal/app-passwords/production/

# 5. Check version history for a secret
vault kv metadata get internal/app-passwords/production/database
```

---

## ✅ Definition of Done

- [x] Vault is running as a hardened `systemd` service
- [x] Secrets are **never** stored in Jenkins UI, disk files, or build logs
- [x] Jenkins authenticates using short-lived AppRole tokens
- [x] Pipeline dynamically **stores** or **retrieves** any credential via parameters
- [x] Secret values are **masked** in all Jenkins console output
- [x] Workspace is wiped and env vars unset after every build
- [x] CLI utility enables terminal-native secret management
- [x] KV-V2 provides **full version history** for every stored secret

---

## 🔒 Security Posture

| Control | Implementation |
| :--- | :--- |
| **Encryption at rest** | Vault AES-256-GCM (default) |
| **Encryption in transit** | Vault API over localhost (production: TLS) |
| **Least privilege** | HCL policy scoped strictly to `app-passwords/*` |
| **Secret masking** | `MaskPasswordsBuildWrapper` + `password` param type |
| **Token expiry** | 20-min TTL, 10-use limit per AppRole token |
| **Zero footprint** | `cleanWs` + `unset` on every pipeline completion |
| **Audit logging** | Vault logs every read/write with identity + timestamp |

---

## 💡 Senior Engineer Notes

- **Secret rotation** is a one-time Vault update — `vault kv put` with the new value. Every pipeline and CLI consumer gets the new secret on next read, with no `Jenkinsfile` changes required.
- **KV-V2 versioning** means you can roll back to a previous version of any secret with `vault kv rollback`.
- **Namespace isolation:** Add team-scoped paths (`app-passwords/team-a/*`, `app-passwords/team-b/*`) and create separate policies per team for multi-tenant credential management.
