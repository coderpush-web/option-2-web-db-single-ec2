# AGENTS.md — Option 2: Hosting 1 Web + 1 DB on Single EC2

## 1. Project Overview
This repository implements **Option 2**: An all-in-one monolithic deployment hosting both a **Web Application (Next.js)** and an internal **Database (PostgreSQL 16)** on a **single Amazon EC2 instance** orchestrated via Docker Compose, backed by a persistent Amazon EBS volume and automated backup snapshots.

This architecture is optimized for MVPs, low-budget proofs of concept, staging environments, and internal operational tools.

---

## 2. Repository Layout
```
option-2-web-db-single-ec2/
├── app/                          # Next.js 14 application codebase
│   ├── app/                      # Application routes and API handlers
│   ├── Dockerfile                # Multi-stage production container build
│   └── package.json              # Dependencies and scripts
├── infra/
│   ├── environments/             # Environment configs (dev.json, prod.json)
│   └── modules/                  # CloudFormation templates
│       ├── vpc-subnets.yaml      # VPC, subnets, and VPC endpoints
│       ├── security-groups.yaml  # ALB SG and Web SG definitions
│       └── app.yaml              # EC2, persistent EBS, ALB, CloudFront
├── docker-compose.yml            # Docker Compose defining web and postgres services
├── .github/workflows/            # CI/CD pipelines (OIDC deployment, ECR build, lint)
├── .husky/ & .githooks/          # Quality gates: commit-msg, pre-commit, pre-push
├── test/test_api.js              # Automated Node.js API and healthcheck tests
└── AGENTS.md                     # Agent guide for Option 2
```

---

## 3. Essential Commands

### Build & Run
- **Install Dependencies:** `npm install` (root) or `cd app && npm install`
- **Run Local Stack:** `docker-compose up -d`
- **Stop Local Stack:** `docker-compose down`

### Validation & Quality Gates
- **Run Automated Tests:**
  ```bash
  node test/test_api.js
  ```
- **Lint CloudFormation Templates:**
  ```bash
  cfn-lint infra/modules/*.yaml
  ```
- **Scan IaC Security (Checkov):**
  ```bash
  checkov --config-file .checkov.yaml
  ```
- **Scan for Secrets (GitLeaks):**
  ```bash
  gitleaks protect --staged --verbose
  ```
- **Run All Pre-Commit Checks:**
  ```bash
  ./.husky/pre-commit
  ```

---

## 4. Architecture Requirements to Create

### 4.1. Compute & Container Architecture
- **Single EC2 Host:** 1x `t4g.medium` Graviton ARM instance (2 vCPU / 4GB RAM) in a Private Subnet.
- **Docker Compose Stack:**
  - **`web` Service:** Next.js application container exposing port 3000 to host/ALB.
  - **`db` Service:** PostgreSQL 16 Alpine container, accessible to `web` via internal Docker bridge network (`localhost:5432`).
  - Container policies: `restart: unless-stopped`.
- **Management Access:** Server administration strictly via **AWS Systems Manager (SSM) Session Manager**. Do NOT open SSH port 22 to the internet.

### 4.2. Persistent Storage & Backup Layer
- **Persistent EBS Volume:** Dedicated Amazon EBS gp3 SSD volume mounted to `/var/lib/postgresql/data` (ext4 formatted). Ensures database data survives container rebuilds, code updates, and instance reboots.
- **Automated Backup Strategy:**
  - AWS Backup Vault and Plan taking automated daily EBS snapshots with 14-day retention.
  - Optional cron-based `pg_dump` archived to Amazon S3.

### 4.3. Edge & Load Balancing Layer
- **Amazon CloudFront:**
  - Edge CDN terminating SSL/TLS with AWS Certificate Manager (ACM).
  - Injects custom header `X-CloudFront-Origin-Verify`.
  - Caches static assets and provides DDoS protection.
- **Application Load Balancer (ALB):**
  - Resides in public subnets, routing to the EC2 web service.
  - Validates `X-CloudFront-Origin-Verify`. Direct traffic returns `HTTP 403 Forbidden`.

---

## 5. Operational Boundaries & Guardrails

### 🛑 Never Do
- **Never Store Database Files Inside Ephemeral Container Storage:** Always ensure `/var/lib/postgresql/data` is mounted to the persistent EBS volume.
- **Never Use Static AWS Keys:** GitHub Actions must authenticate solely via AWS IAM OIDC (`secrets.AWS_ROLE_TO_ASSUME`).
- **Never Open Port 22 or Port 5432 to Public:** Database port 5432 must be restricted to internal Docker bridge networking only.

### ⚠️ Ask First
- Modifying database schemas or database configuration files.
- Resizing or modifying EBS volume mount paths.

### ✅ Always Do
- Follow Conventional Commits format (`type(scope): message`).
- Verify that `test/test_api.js`, `cfn-lint`, `checkov`, and `gitleaks` pass before pushing.

---

## 6. Technical Conventions & Standards
- **Selective Deployment:** CI/CD must update only the `web` container via SSM Run Command, ensuring the PostgreSQL container is not restarted unnecessarily.
- **Security Groups:** All ingress rules must contain explicit `Description` fields.
- **Database Healthcheck:** Docker Compose must include a healthcheck command for PostgreSQL: `pg_isready -U postgres`.

---

## 7. Definition of Done (Verification Checklist)
Before completing any task in this repository, verify:
1. [ ] `cfn-lint infra/modules/*.yaml` exits with code 0.
2. [ ] `checkov --config-file .checkov.yaml` runs cleanly.
3. [ ] `gitleaks protect --staged --verbose` finds 0 secrets.
4. [ ] `node test/test_api.js` passes all tests.
5. [ ] Workflows contain zero static AWS keys (`! grep -rn --exclude="ci-infra.yml" "AWS_ACCESS_KEY_ID" .github/workflows/`).
6. [ ] Commit message conforms to Conventional Commits hook.
