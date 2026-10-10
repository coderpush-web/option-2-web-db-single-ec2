# Comprehensive Security, Architectural & Production Readiness Audit
## Architecture Option 2: Standalone Web Application with Persistent Local SQLite Database on Single EC2
**Repository:** `option-2-web-db-single-ec2`  
**Evaluation Date:** 2026-10-10  
**Audit Standard:** AWS Well-Architected Framework (Security, Reliability, Operational Excellence) & CWE/CVSS v3.1  
**Status:** Action Required Prior to Production Deployment  

---

## 1. Executive Summary

This document presents a comprehensive, production-grade security, architectural, and reliability assessment of **Option 2 (`option-2-web-db-single-ec2`)**.

Option 2 is architected as a **cost-effective standalone full-stack implementation** designed to co-locate a containerized Next.js 14 web application with an embedded, persistent local SQLite database on a single Amazon EC2 instance deployed inside Private Subnet 1. Ingress traffic is routed through an Application Load Balancer (ALB) and edge-cached by Amazon CloudFront CDN.

### Key Assessment Findings
1. **Critical Architectural Mismatch (Missing SQLite Implementation):** While repository documentation and CloudFormation templates describe an embedded SQLite database persisting to an encrypted EBS volume (`/var/data/sqlite`), the actual application codebase (`option-2-web-db-single-ec2/app`) is a copy-paste of Option 1 containing **no SQLite code, drivers, or dependencies**. It imports PostgreSQL (`postgres.js`) and targets a non-existent database server at `127.0.0.1:5432`.
2. **Container Volume Mount Permission Conflict (`EACCES: permission denied`):** CloudFormation UserData provisions `/var/data/sqlite` under root ownership (`root:root`, mode `0755`), while the production Docker container drops root to execute as unprivileged user `nextjs` (UID 1001, GID 1001). When the container mounts `/var/data/sqlite` to `/app/data`, the application cannot create or write to `/app/data/app.db` or its WAL journal files, causing immediate database write crashes.
3. **Storage & Disaster Recovery Omission:** The CloudFormation template does not provision a dedicated EBS data volume (`AWS::EC2::Volume`) for database files; instead, data resides on the EC2 root filesystem (`/dev/xvda`). No automated backup lifecycle (AWS Backup vault, EBS snapshots, or point-in-time recovery) is configured, posing critical data loss risks for stateful workloads.
4. **Hardcoded Secrets & Built-in Auth Backdoor:** Source code contains hardcoded fallback credentials (`postgres://postgres:postgres@127.0.0.1:5432/postgres` in `db.ts`) and a built-in authentication bypass backdoor (`user@nextmail.com` / `123456` in `placeholder-data.ts` and `auth.ts`) that validates unauthenticated sessions whenever database queries fail.
5. **ALB HTTPS Listener Omission:** `infra/modules/app.yaml` defines solely an HTTP port 80 listener. It completely lacks an HTTPS port 443 listener and certificate parameter support, preventing direct TLS termination at the load balancer.
6. **CI/CD Deployment Failure Chain:** In `.github/workflows/deploy.yml`, the deployment job restarts the systemd service via AWS Systems Manager without executing `docker pull`. New container images pushed to Amazon ECR are never downloaded, causing deployments to silently restart outdated images.

---

## 2. Architectural Context & Component Topology

### 2.1 Component Architecture Diagram

```
                                      [ Internet Clients ]
                                                │
                                                │ HTTPS (Port 443)
                                                ▼
                           ┌─────────────────────────────────────────┐
                           │      Amazon CloudFront CDN Edge         │
                           │   - ViewerProtocolPolicy: redirect-to-https
                           │   - X-CloudFront-Origin-Verify Header   │
                           │   - Cache /_next/static/* & /static/*   │
                           └────────────────────┬────────────────────┘
                                                │
                                                │ HTTP (Port 80)
                                                ▼
┌────────────────────────────────── AWS Virtual Private Cloud (VPC: 10.0.0.0/16) ──────────────────────────────────┐
│                                                                                                                  │
│  ┌────────────────────── Public Subnet 1 (10.0.1.0/24) ──┐  ┌────────────────────── Public Subnet 2 (10.0.2.0/24) ──┐  │
│  │                                                       │  │                                                       │  │
│  │               ┌───────────────────────────────────────┴──┴───────────────────────────────────────┐               │  │
│  │               │              Internet-Facing Application Load Balancer (ALB)                     │               │  │
│  │               │  - Port 80 HTTP Listener ONLY [DEFECT: Missing HTTPS Port 443 Listener]          │               │  │
│  │               │  - Rule 10: X-CloudFront-Origin-Verify Header Match -> Forward to ALBTargetGroup  │               │  │
│  │               │  - Default: HTTP 403 Forbidden                                                   │               │  │
│  │               └───────────────────────────────────────┬──────────────────────────────────────────┘               │  │
│  └───────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┘  │
│                                                          │ Forward Port 80 (WebSecurityGroup)                           │
│                                                          ▼                                                              │
│  ┌───────────────────── Private Subnet 1 (10.0.10.0/24) ─┴───────────────────────────────────────────────────────┐  │
│  │                                                                                                                │  │
│  │   ┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │              Single Standalone EC2 Instance: `dev-opt2-web-instance` (t3.micro / t3.small)            │   │  │
│  │   │                                                                                                        │   │  │
│  │   │   ┌────────────────────────────────────────────────────────────────────────────────────────────────┐   │   │  │
│  │   │   │  Docker Container: `react-webapp` (Port 80)                                                    │   │   │  │
│  │   │   │  - Next.js 14 App Router (Node 20 Alpine)                                                      │   │   │  │
│  │   │   │  - Running as non-root user: `USER nextjs` (UID 1001, GID 1001)                                │   │   │  │
│  │   │   │  - Volume Binding: `-v /var/data/sqlite:/app/data`                                             │   │   │  │
│  │   │   │  - [PERMISSION CONFLICT]: Host dir owned by `root:root 0755` -> UID 1001 denied write access   │   │   │  │
│  │   │   │  - [CODE DEFECT]: App runs `postgres.js` instead of SQLite driver (`better-sqlite3`)           │   │   │  │
│  │   │   └────────────────────────────────────────┬───────────────────────────────────────────────────────┘   │   │  │
│  │   │                                            │ (SQLite read/write)                                       │   │  │
│  │   │                                            ▼                                                           │   │  │
│  │   │   ┌────────────────────────────────────────────────────────────────────────────────────────────────┐   │   │  │
│  │   │   │  Host Directory: `/var/data/sqlite/app.db`                                                     │   │   │  │
│  │   │   │  - Resides on Root EBS Volume `/dev/xvda` (Encrypted GP3, DeleteOnTermination: false)          │   │   │  │
│  │   │   │  - [STORAGE GAP]: No dedicated EBS volume; No automated AWS Backup / snapshot lifecycle        │   │   │  │
│  │   │   └────────────────────────────────────────────────────────────────────────────────────────────────┘   │   │  │
│  │   └────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                                                │  │
│  │   ┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │ VPC Interface Endpoints (Isolated Subnets, No NAT Gateway Required):                                   │   │  │
│  │   │ `ecr.api`, `ecr.dkr`, `s3` (Gateway), `logs`, `secretsmanager`, `ssm`, `ssmmessages`, `ec2messages`    │   │  │
│  │   └────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component & Resource Inventory

| Logical Resource | CloudFormation Type | Physical Architecture & Configuration | Purpose & Status |
| :--- | :--- | :--- | :--- |
| `WebServerInstance` | `AWS::EC2::Instance` | Standalone EC2 in `PrivateSubnet1`, IMDSv2 required | Single host running web tier + embedded DB |
| `ApplicationLoadBalancer` | `AWS::ElasticLoadBalancingV2::LoadBalancer` | Internet-facing ALB in Public Subnets 1 & 2 | Public entry point forwarding to EC2 |
| `ALBListener` | `AWS::ElasticLoadBalancingV2::Listener` | Port 80 HTTP listener with origin header rule | **DEFECT**: Missing Port 443 HTTPS listener |
| `ALBTargetGroup` | `AWS::ElasticLoadBalancingV2::TargetGroup` | Target: WebServerInstance:80, Path: `/api/health` | Load balancer health and routing target |
| `CloudFrontDistribution` | `AWS::CloudFront::Distribution` | HTTP/2 & HTTP/3 edge distribution, PriceClass 200 | CDN edge caching and origin cloaking |
| `ALBSecurityGroup` | `AWS::EC2::SecurityGroup` | Ports 80 & 443 inbound from `0.0.0.0/0` | Ingress filtering for ALB |
| `WebSecurityGroup` | `AWS::EC2::SecurityGroup` | Port 80 inbound restricted to `ALBSecurityGroup` | Compute tier isolation |
| `DatabaseSecurityGroup` | `AWS::EC2::SecurityGroup` | Port 3306 (MySQL) from `WebSecurityGroup` | **DEFECT**: Unused/misleading security group |
| `EC2SSMRole` | `AWS::IAM::Role` | SSM Session Manager, ECR pull, CloudWatch agent | Host IAM identity (Missing Secrets Manager) |
| `Local Database Storage` | Host filesystem mount | Root EBS `/dev/xvda` mounted to `/var/data/sqlite` | **DEFECT**: Lacks dedicated EBS volume & backup |

---

## 3. Comprehensive Security Findings & Vulnerability Matrix

| Finding ID | Severity | CVSS v3.1 | CWE ID | Affected Files & Lines | Short Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **CRITICAL** | 8.6 | CWE-798 | `app/app/lib/db.ts:4–7` | Insecure hardcoded fallback connection string with plaintext credentials |
| **SEC-02** | **CRITICAL** | 8.2 | CWE-732 / CWE-276 | `infra/modules/app.yaml:101, 133`<br>`app/Dockerfile:24–31` | Host volume permissions prevent non-root container from writing to SQLite DB |
| **SEC-03** | **HIGH** | 7.7 | CWE-287 / CWE-798 | `app/app/lib/placeholder-data.ts:3–10`<br>`app/auth.ts:20–28` | Authentication bypass backdoor validating mock credentials on DB failure |
| **SEC-04** | **HIGH** | 7.5 | CWE-312 / CWE-330 | `infra/modules/app.yaml:134–135`<br>`app/auth.ts:35` | Missing `AUTH_SECRET` container injection breaking session encryption |
| **SEC-05** | **HIGH** | 7.4 | CWE-319 | `infra/modules/app.yaml:201–228` | ALB lacks HTTPS listener on Port 443, transmitting traffic unencrypted to ALB |
| **SEC-06** | **HIGH** | 7.1 | CWE-657 / CWE-710 | `.github/workflows/deploy.yml:128–142` | SSM deployment script restarts service without `docker pull`, failing deployments |
| **SEC-07** | **MEDIUM** | 5.3 | CWE-476 | `app/app/seed/route.ts:5`<br>`app/app/query/route.ts:3` | Non-null assertion on missing env variable triggers unhandled module crash |
| **SEC-08** | **MEDIUM** | 4.8 | CWE-330 | `infra/modules/app.yaml:224, 252` | Predictable ALB origin verification header derived from AWS Account ID |
| **SEC-09** | **MEDIUM** | 4.3 | CWE-1188 | Repository Root / `app/` | Absence of `.env.example` template for configuration contracts |
| **SEC-10** | **LOW** | 3.1 | CWE-276 | `infra/modules/security-groups.yaml:50–65` | Dead/redundant security group rule exposing MySQL port 3306 |

---

### Deep-Dive Analysis of Vulnerabilities

#### Finding SEC-01: Hardcoded Insecure Fallback Database Connection String
- **Severity:** **CRITICAL** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N — Score: 8.6)
- **CWE:** CWE-798 (Use of Hard-coded Credentials), CWE-259 (Use of Hard-coded Password)
- **Affected Location:** `option-2-web-db-single-ec2/app/app/lib/db.ts`, Lines 4–7:
  ```typescript
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@127.0.0.1:5432/postgres';
  ```
- **Technical Description:** Option 2 is supposed to be an embedded SQLite application. Instead, it contains a hardcoded fallback string targeting PostgreSQL with default credentials (`postgres:postgres`). Because no PostgreSQL daemon runs on Option 2, every database query blocks for 4 seconds, times out with `ECONNREFUSED`, and falls back to placeholder data.
- **Security Impact:** Credential leakage in source control; artificial request latency; architecturally incorrect client initialization.
- **Remediation:** Remove PostgreSQL connection logic and fallbacks completely. Replace `app/app/lib/db.ts` with a SQLite database client (e.g. `better-sqlite3` or `@libsql/client`) configured to open `/app/data/app.db`.

---

#### Finding SEC-02: Host Volume Permissions Conflict with Non-Root Container
- **Severity:** **CRITICAL** (CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:H — Score: 8.2)
- **CWE:** CWE-732 (Incorrect Permission Assignment for Critical Resource), CWE-276 (Incorrect Default Permissions)
- **Affected Locations:**
  - `infra/modules/app.yaml`, Lines 101, 133:
    ```bash
    mkdir -p /var/data/sqlite
    ```
    ```bash
    docker run ... -v /var/data/sqlite:/app/data ...
    ```
  - `app/Dockerfile`, Lines 24–31:
    ```dockerfile
    RUN addgroup --system --gid 1001 nodejs
    RUN adduser --system --uid 1001 nextjs
    USER nextjs
    ```
- **Technical Description:**
  1. EC2 UserData runs as root (`UID 0`), creating `/var/data/sqlite` owned by `root:root` with default umask `022` (`drwxr-xr-x`, mode `0755`).
  2. The container runs as unprivileged user `nextjs` (`UID 1001, GID 1001`).
  3. The container binds the host volume `-v /var/data/sqlite:/app/data`.
  4. When SQLite attempts to create or open `/app/data/app.db` in write mode, or write SQLite temporary rollback/WAL journal files (`app.db-wal`, `app.db-shm`), the Linux kernel returns `EACCES: permission denied`.
- **Proof of Concept / Evidence:**
  Spawning the container and executing `touch /app/data/test.db` as user `nextjs` produces:
  `touch: /app/data/test.db: Permission denied`.
- **Security & Reliability Impact:** Total database failure. The application cannot write, update, or create database tables, causing runtime crashes or immediate fallback to mock data.
- **Remediation:** Update UserData in `infra/modules/app.yaml`:
  ```bash
  mkdir -p /var/data/sqlite
  chown -R 1001:1001 /var/data/sqlite
  chmod 770 /var/data/sqlite
  ```

---

#### Finding SEC-03: Hardcoded Plaintext User Credentials with Auth Bypass Backdoor
- **Severity:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N — Score: 7.7)
- **CWE:** CWE-287 (Improper Authentication), CWE-798 (Use of Hard-coded Credentials)
- **Affected Locations:**
  - `app/app/lib/placeholder-data.ts`, Lines 3–10 (`user@nextmail.com` / `123456`)
  - `app/auth.ts`, Lines 20–28:
    ```typescript
    const found = placeholderUsers.find((u) => u.email === email);
    if (found) {
      return {
        id: found.id,
        name: found.name,
        email: found.email,
        password: await bcrypt.hash(found.password, 10),
      };
    }
    ```
- **Technical Description:** When database queries fail (which occurs continuously due to the missing PostgreSQL daemon or SQLite permission error), `getUser(email)` falls back to `placeholderUsers`. Any user supplying `user@nextmail.com` and `123456` is authenticated and granted full administrative access.
- **Security Impact:** Complete administrative authentication bypass in production.
- **Remediation:** Remove fallback authentication logic in `app/auth.ts`. Authenticate strictly against the local SQLite `users` table; return `null` on missing users or database errors.

---

#### Finding SEC-04: Missing `AUTH_SECRET` Container Injection
- **Severity:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N — Score: 7.5)
- **CWE:** CWE-312 (Cleartext Storage of Sensitive Information), CWE-330 (Use of Insufficiently Random Values)
- **Affected Locations:**
  - `infra/modules/app.yaml`, Lines 134–135:
    ```bash
    -e APP_ENV=${EnvironmentName} -e PORT=80
    ```
  - `app/auth.ts`, Line 35:
    ```typescript
    secret: process.env.AUTH_SECRET,
    ```
- **Technical Description:** NextAuth requires `AUTH_SECRET` in production to sign and encrypt session tokens. In Option 2 UserData, the container is started without `AUTH_SECRET`. This triggers NextAuth's `MissingSecret` exception upon any sign-in attempt.
- **Remediation:** Create `${EnvironmentName}-web-auth-secret` in AWS Secrets Manager, retrieve it in UserData, write to `/etc/react-webapp.env` (`chmod 600`), and pass `--env-file /etc/react-webapp.env` to the Docker container.

---

#### Finding SEC-05: ALB Lacks HTTPS Listener (Port 443)
- **Severity:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N — Score: 7.4)
- **CWE:** CWE-319 (Cleartext Transmission of Sensitive Information)
- **Affected Locations:** `infra/modules/app.yaml`, Lines 201–228.
- **Technical Description:** `option-2/infra/modules/app.yaml` provisions only an HTTP listener on port 80. It completely lacks an `AWS::ElasticLoadBalancingV2::Listener` on port 443 and lacks a `CertificateArn` parameter. CloudFront connects to the ALB exclusively over unencrypted HTTP (`http-only`).
- **Security Impact:** Edge-to-origin traffic between CloudFront and ALB is transmitted in cleartext over the network.
- **Remediation:** Add a `CertificateArn` parameter and configure an HTTPS Listener on port 443 with modern TLS cipher policy (`ELBSecurityPolicy-TLS13-1-2-2021-06`). Align CloudFront's origin protocol policy to use HTTPS.

---

#### Finding SEC-06: SSM Deployment Pipeline Fails to Pull Updated Container Images
- **Severity:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:N/I:H/A:H — Score: 7.1)
- **CWE:** CWE-657 (Violation of Secure Design Principles), CWE-710 (Improper Adherence to Coding Standards)
- **Affected Location:** `.github/workflows/deploy.yml`, Lines 128–142:
  ```bash
  aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["systemctl restart react-webapp"]'
  ```
- **Technical Description:** The systemd unit file `react-webapp.service` (defined in UserData) executes `docker run` on an already existing local image. It does **not** perform `docker pull` prior to launching. When the GitHub Actions workflow pushes a newly built image to Amazon ECR and executes `systemctl restart react-webapp`, the host simply restarts the old image that was downloaded during EC2 creation.
- **Impact:** Production updates and critical security patches cannot be deployed through CI/CD without terminating the EC2 instance.
- **Remediation:** Update the SSM deployment command to authenticate with ECR, execute `docker pull $IMAGE_URI`, and then restart the service:
  ```bash
  aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REGISTRY
  docker pull $IMAGE_URI
  systemctl restart react-webapp
  ```

---

#### Finding SEC-07: Non-Null Assertion Crash Risk on Seed and Query Routes
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:M — Score: 5.3)
- **CWE:** CWE-476 (NULL Pointer Dereference)
- **Affected Locations:** `app/app/seed/route.ts:5`, `app/app/query/route.ts:3`.
- **Technical Description:** Unconditional instantiation of `postgres(process.env.POSTGRES_URL!, ...)` at module initialization causes runtime crashes when `POSTGRES_URL` is undefined.
- **Remediation:** Guard route handlers; replace with SQLite handlers.

---

#### Finding SEC-08: Predictable ALB Origin Verification Header
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N — Score: 4.8)
- **CWE:** CWE-330 (Use of Insufficiently Random Values)
- **Affected Locations:** `infra/modules/app.yaml`, Lines 224, 252.
- **Technical Description:** Value `!Sub '${EnvironmentName}-secure-origin-${AWS::AccountId}'` is deterministic and predictable.
- **Remediation:** Store high-entropy secret in AWS Secrets Manager.

---

#### Finding SEC-09: Missing `.env.example` Template
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N — Score: 4.3)
- **CWE:** CWE-1188 (Insecure Default Initialization of Resource)
- **Affected Location:** Repository Root and `app/`.
- **Technical Description:** Lacks `.env.example` documenting `AUTH_SECRET`, `SQLITE_DB_PATH`, `APP_ENV`, `PORT`.
- **Remediation:** Create `app/.env.example`.

---

#### Finding SEC-10: Redundant Database Security Group (Port 3306)
- **Severity:** **LOW** (CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N — Score: 3.1)
- **CWE:** CWE-276 (Incorrect Default Permissions)
- **Affected Location:** `infra/modules/security-groups.yaml`, Lines 50–65.
- **Technical Description:** Option 2 uses a local embedded SQLite database on disk. An external MySQL/MariaDB security group is dead code.
- **Remediation:** Remove `DatabaseSecurityGroup` from Option 2.

---

## 4. Infrastructure Security & AWS Well-Architected Review

### 4.1 IAM Roles & Least Privilege Analysis (`infra/modules/iam-roles.yaml`)
- **Current Role Policies:**
  - `AmazonSSMManagedInstanceCore`
  - `AmazonEC2ContainerRegistryReadOnly`
  - `CloudWatchAgentServerPolicy`
- **Security Deficiencies:**
  1. EC2 role lacks permissions to read from AWS Secrets Manager (`secretsmanager:GetSecretValue`) or Parameter Store (`ssm:GetParameter`).
  2. No scoped inline policy exists for application configuration.
- **Remediation:** Attach scoped inline policy `EC2SecretsManagerReadPolicy` granting `secretsmanager:GetSecretValue` on `${EnvironmentName}-web-auth-secret*`.

### 4.2 Storage Architecture & Backup Lifecycle
- **Single Point of Failure (SPOF):**
  - Option 2 runs on a single EC2 instance (`WebServerInstance`) in a single AZ (`PrivateSubnet1`).
  - If the AZ experiences an outage or the EC2 hardware fails, the entire application and database become unreachable.
- **Volume Architecture Gap:**
  - SQLite data resides directly on the root EBS volume `/dev/xvda`.
  - While `DeleteOnTermination: false` protects the root volume if the CloudFormation stack is deleted or instance terminated, there is **no separate EBS volume** dedicated to database storage.
  - No AWS Backup vault or automated EBS snapshot lifecycle is configured. A disk corruption event destroys all persistent database records.
- **Remediation:**
  1. Provision a dedicated EBS GP3 data volume (`AWS::EC2::Volume`) mounted to `/var/data/sqlite`.
  2. Configure an AWS Backup plan with daily snapshots and 7-day retention.

### 4.3 Monitoring, Observability & Health Probes
- **Current Health Check Route (`app/app/api/health/route.ts`):**
  ```typescript
  export async function GET() {
    return Response.json(
      { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() },
      { status: 200 }
    );
  }
  ```
- **Flaw:** The probe does not check whether SQLite database file `/app/data/app.db` is open, readable, or writable. If the volume fails or has permission errors, `/api/health` continues returning HTTP 200, misleading the ALB into considering the instance healthy.
- **CloudWatch Alarms:**
  - `ALB5XXAlarm`: Triggers on `HTTPCode_Target_5XX_Count > 10`.
  - `HighCPUAlarm`: Triggers on EC2 `CPUUtilization > 85%`.
  - **Missing:** EBS Disk Space Utilization Alarm (`DiskSpaceUtilization > 85%`), vital for stateful SQLite instances to prevent write failures due to a full disk.

---

## 5. Application Security & Code Quality Review

### 5.1 Build Configuration & TypeScript Masking (`app/next.config.js`)
- `next.config.js` sets `typescript: { ignoreBuildErrors: true }` and `eslint: { ignoreDuringBuilds: true }`.
- **Impact:** Suppresses build errors, violating Requirement R4.
- **Remediation:** Remove build error suppression and ensure `npm run build` compiles cleanly.

### 5.2 Automated Testing Gaps (`test/test_api.js`)
- Only tests `1 + 1 === 2` and basic file existence.
- Does not test SQLite database initialization, CRUD operations, or authentication endpoints.

---

## 6. Architecture-Specific Deep Dive: Embedded SQLite Realization

Option 2 was designed as a single EC2 architecture with an **embedded SQLite database**. To align implementation with architecture:

### 6.1 Required Application Refactoring
1. **Add SQLite Driver:**
   Install `better-sqlite3` and `@types/better-sqlite3` (or `@libsql/client`).
2. **Implement SQLite Database Client (`app/app/lib/db.ts`):**
   ```typescript
   import Database from 'better-sqlite3';
   import path from 'path';
   import fs from 'fs';

   const dbPath = process.env.SQLITE_DB_PATH || '/app/data/app.db';

   // Ensure parent directory exists
   const dir = path.dirname(dbPath);
   if (!fs.existsSync(dir)) {
     fs.mkdirSync(dir, { recursive: true });
   }

   export const db = new Database(dbPath);
   db.pragma('journal_mode = WAL');
   ```
3. **Database Schema Initialization Script:**
   Provide an automated startup script (`app/app/lib/init-db.ts`) executing DDL:
   ```sql
   CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     email TEXT NOT NULL UNIQUE,
     password TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS customers (...);
   CREATE TABLE IF NOT EXISTS invoices (...);
   CREATE TABLE IF NOT EXISTS revenue (...);
   ```
4. **Refactor Query Layer (`app/app/lib/data.ts`):**
   Replace asynchronous PostgreSQL template strings (`await sqlClient\`...\``) with prepared SQLite statements (`db.prepare('...').all()` / `db.prepare('...').get()`).
5. **Update NextAuth Credentials Provider (`app/auth.ts`):**
   Query the local SQLite database directly:
   ```typescript
   const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
   ```

---

## 7. Actionable Step-by-Step Remediation Roadmap

### Phase 1: Critical Security & Secret Management (Immediate)
1. **Eradicate Fallback PostgreSQL String:** Remove `'postgres://postgres:postgres@...'` from `db.ts`.
2. **Remove Authentication Backdoor:** Delete lines 20–28 in `app/auth.ts`.
3. **Dynamic NextAuth Secret:**
   - Add `AWS::SecretsManager::Secret` for `${EnvironmentName}-web-auth-secret`.
   - Attach IAM read policy to `EC2SSMRole`.
   - Retrieve secret in EC2 UserData and inject into `/etc/react-webapp.env`.
4. **Create `.env.example`:** Document `AUTH_SECRET`, `SQLITE_DB_PATH`, `APP_ENV`, `PORT`.

### Phase 2: Embedded SQLite Realization (High Priority)
1. **Fix Host Directory Permissions:**
   In `infra/modules/app.yaml` UserData:
   `mkdir -p /var/data/sqlite && chown -R 1001:1001 /var/data/sqlite && chmod 770 /var/data/sqlite`.
2. **Implement SQLite in Application:**
   Replace `postgres.js` with `better-sqlite3`. Implement schema initialization and refactor `data.ts`, `actions.ts`, and `auth.ts`.
3. **Enhance Health Check:**
   Update `/api/health` to verify that SQLite can perform a read/write transaction on `/app/data/app.db`.

### Phase 3: Infrastructure & Pipeline Remediation (Medium Priority)
1. **Fix SSM Deployment Script:**
   In `.github/workflows/deploy.yml`, authenticate with ECR, run `docker pull $IMAGE_URI`, and then restart `react-webapp`.
2. **Add ALB HTTPS Listener:**
   In `infra/modules/app.yaml`, add `CertificateArn` parameter and configure port 443 HTTPS listener.
3. **Clean Up Security Groups:**
   Remove unused MySQL port 3306 from `security-groups.yaml`.
4. **Build Quality Enforcement:**
   Remove `ignoreBuildErrors: true` from `next.config.js`.

---

## 8. AWS Well-Architected Framework Compliance Scorecard

| Pillar | Rating | Baseline Findings | Target Status Post-Remediation |
| :--- | :---: | :--- | :--- |
| **Security** | **FAIL** | Hardcoded credentials in `db.ts`, auth backdoor in `auth.ts`, missing `AUTH_SECRET`, unencrypted ALB listener (port 80 only). | **PASS**: Secrets Manager dynamic retrieval, zero hardcoded secrets, ALB HTTPS listener, scoped IAM roles. |
| **Reliability** | **FAIL** | Host volume permission conflict prevents SQLite writes; single AZ SPOF without automated backups; SSM deploy doesn't pull images. | **PASS**: Host volume permissions fixed (`chown 1001:1001`), SQLite WAL mode enabled, verified deployment pipeline. |
| **Performance Efficiency** | **WARN** | 4-second TCP timeout attempting to connect to non-existent PostgreSQL server on localhost. | **PASS**: Microsecond-latency in-process SQLite queries. |
| **Cost Optimization** | **PASS** | Highly cost-effective single EC2 design avoiding managed RDS hourly charges. | **PASS**: Preserves low-cost profile. |
| **Operational Excellence** | **FAIL** | Suppressed TypeScript build errors; application code does not match documented architecture (Postgres instead of SQLite). | **PASS**: Clean `tsc` compilation, authentic SQLite implementation, functional CI/CD pipeline. |

---

## 9. Verification & Audit Attestation

This audit was conducted by inspecting CloudFormation templates (`infra/modules/*.yaml`), application source code (`app/**/*`), container definitions (`app/Dockerfile`), and pipeline workflows (`.github/workflows/*.yml`) in repository `option-2-web-db-single-ec2`.

**Verification Command References:**
- CloudFormation Linting: `cfn-lint infra/modules/*.yaml`
- TypeScript Static Verification: `cd app && npx tsc --noEmit`
- Clean Production Build: `cd app && npm run build`
- Zero-Secret Grep Validation: `grep -rn "postgres://postgres:" .`
