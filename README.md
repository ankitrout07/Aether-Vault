# 🔐 Enterprise Password Saver — Powered by HashiCorp Vault & Jenkins

A **self-service, zero-trust credential vault** for teams and automation pipelines. Store, retrieve, and rotate operational secrets (database passwords, API keys, SSH credentials) through a hardened HashiCorp Vault backend. This project features an Express/Node.js API, a beautiful Tailwind CSS Web UI Dashboard, Jenkins CI/CD automation, and Docker Compose orchestration.

> **Pivoted from:** Azure Infrastructure Secret Management  
> **Pivoted to:** General-purpose Enterprise Password Saver — any secret, any team, any service.

---

## 🚀 Quick Start (Web App Stack via Docker Compose)

The easiest way to run the entire unified application stack (Vault Backend + Node.js API + Web Dashboard) is using Docker Compose:

```bash
# 1. Spin up the application stack
docker compose up -d

# 2. Verify containers are running healthy
docker compose ps

# 3. Access the web interface
# Open http://localhost:3000 in your web browser
```

---

## 🧠 The "Why" Behind the Project

| Problem | This Project's Solution |
| :--- | :--- |
| Passwords scattered across Slack, `.env` files, spreadsheets | **One encrypted source of truth** — Vault KV-V2 |
| Credentials leaked in CI/CD logs | **MaskPasswordsBuildWrapper** + ephemeral env vars |
| No audit trail when a secret is accessed | **Vault audit log** — every read/write timestamped with identity |
| Rotating a password means updating 10 places | **Update in Vault once**, all consumers get it instantly |
| No access control on who can see what | **HCL policies** enforce least-privilege per path |
| Cumbersome CLI interfaces for non-technical users | **Glassmorphism Web UI** for simple Encrypt/Decrypt ops |

---

## 🏗️ Technical Architecture

The workflow uses a **Machine-to-Machine (M2M)** handshake called **AppRole** along with an Express Middleware Broker:

| Step | Actor | Action |
| :--: | :--- | :--- |
| **1** | Frontend/Jenkins | Sends a payload to the App Backend / Presents **RoleID + SecretID** |
| **2** | Vault | Issues a **short-lived token** (20-min TTL) to the Backend/Jenkins |
| **3** | Vault | Checks attached **Policy** → grants CRUD on `app-passwords/*` |
| **4** | App/Jenkins | Executes **STORE** or **RETRIEVE** action against the KV engine |
| **5** | Vault | Writes/reads the KV secret; logs the operation |
| **6** | App/Jenkins | Vault token is never exposed to the frontend browser; Jenkins wipes workspace |

```
┌───────────────────────────────────────────────────────────────┐
│                    Enterprise Password Saver                  │
│                                                               │
│  ┌────────────────┐     ┌───────────────┐      ┌───────────┐  │
│  │ Web Dashboard  │────▶│ Express API   │─────▶│ HashiCorp │  │
│  │ (Tailwind UI)  │◀────│ (Middleware)  │◀─────│ Vault KV  │  │
│  └────────────────┘     └───────────────┘      └───────────┘  │
│                                                      ▲        │
│  ┌────────────────┐     ┌───────────────┐            │        │
│  │ CLI Tool       │────▶│ Jenkins CI/CD │────────────┘        │
│  │ (vault-vault)  │     │ (AppRole Auth)│                     │
│  └────────────────┘     └───────────────┘                     │
└───────────────────────────────────────────────────────────────┘
```

---

## 📦 Project Deliverables

| Deliverable | File | Purpose |
| :--- | :--- | :--- |
| **Web API Backend** | `server.js` | Express broker to authenticate with Vault and serve the frontend |
| **Web Frontend UI** | `public/index.html` | Tailwind/Glassmorphism interface for managing secrets |
| **Orchestration** | `docker-compose.yml` | Packages Vault and the Node.js App into a single stack |
| **Password Vault Pipeline** | `jenkins/Jenkinsfile` | Parameterized STORE/RETRIEVE pipeline for Jenkins |
| **Access Policy** | `vault/policies/password-saver-policy.hcl` | CRUD policy for `app-passwords/*` |
| **Legacy Policy** | `vault/policies/jenkins-policy.hcl` | Same policy, kept for AppRole binding |
| **CLI Utility** | `scripts/vault-vault.sh` | Terminal-native store/get commands |
| **Master Setup** | `scripts/setup-all.sh` | Legacy full one-command bootstrap for standalone Vault |

---

## 🛠️ Bare-Metal Setup Phases (Alternative to Docker)

If you prefer to run Vault directly on a Linux host rather than via Docker, follow these steps:

### Phase 1 — Vault Host Foundation

```bash
bash scripts/setup-all.sh            # Install, Init, and Unseal Vault
```

### Phase 2 & 3 — Automated Vault Configuration

```bash
bash scripts/vault-config.sh
```

This script:
1. Enables KV-V2 at `internal/`
2. Enables AppRole auth
3. Applies `password-saver-policy.hcl` as `jenkins-policy`
4. Creates the `jenkins-role` AppRole
5. **Outputs the Role ID and Secret ID**

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
```

---

## ✅ Definition of Done

- [x] Application orchestrated securely via `docker-compose.yml`.
- [x] Modern Web Interface provided for easy user interactions.
- [x] Secrets are **never** stored in Jenkins UI, disk files, or build logs.
- [x] Express middleware strictly masks Vault API tokens from the frontend.
- [x] Pipeline dynamically **stores** or **retrieves** any credential via parameters.
- [x] Secret values are **masked** in all Jenkins console output.
- [x] CLI utility enables terminal-native secret management.
- [x] KV-V2 provides **full version history** for every stored secret.

---

## 🔒 Security Posture

| Control | Implementation |
| :--- | :--- |
| **Encryption at rest** | Vault AES-256-GCM (default) |
| **Token masking** | Express middleware hides the Vault Token from the browser |
| **Least privilege** | HCL policy scoped strictly to `app-passwords/*` |
| **Secret masking** | `MaskPasswordsBuildWrapper` + `password` param type |
| **Token expiry** | 20-min TTL, 10-use limit per AppRole token |
| **Zero footprint** | `cleanWs` + `unset` on every pipeline completion |
| **Audit logging** | Vault logs every read/write with identity + timestamp |

---

## 💡 Senior Engineer Notes

- **Namespace isolation:** Add team-scoped paths (`app-passwords/team-a/*`, `app-passwords/team-b/*`) and create separate policies per team for multi-tenant credential management.
- **Production Mode:** The `docker-compose.yml` configures Vault in Dev Mode for quick startup. For production, transition to a sealed Vault config using an unseal key quorum or cloud auto-unseal.
