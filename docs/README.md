# Technical Documentation - Option 2: Web Application + Local DB on Single EC2

Welcome to the technical documentation for **Option 2: Web Application + Local SQLite Database on Single EC2 with CloudFront Caching**.

This `docs/` folder contains comprehensive documentation on infrastructure deployment, remote operations, database persistence, and maintenance.

---

## 📚 Documentation Index

1. [Deployment Guide](./deployment-guide.md)
   - Prerequisites & Required Tools
   - Environment Configuration (`dev.json` & `prod.json`)
   - CI/CD Automated Deployment via GitHub Actions
   - Manual Deployment via AWS CLI & `deploy.sh`
   - Custom Domain & DNS Mapping (`png261.dev`)
   - Remote Container Reloading via AWS Systems Manager (SSM Run Command)
   - Teardown & Resource Cleanup

2. [Operations & Usage Guide](./operations-guide.md)
   - Local Development & Testing (`npm run dev`, API tests)
   - Database Persistence & EBS Mount Management (`/var/data/sqlite`)
   - Remote Administration via AWS SSM Session Manager
   - Monitoring & Observability (CloudWatch Logs & Alarms)
   - Backup & Snapshot Strategy for Local SQLite Database
   - Troubleshooting & Frequently Encountered Issues

---

## 🏛️ Architecture Overview

Option 2 is an all-in-one standalone server architecture optimized for maximum cost savings while preserving high edge performance:

```
[Users / Browsers]
        │
        ▼ (HTTPS / DNS CNAME)
[Amazon CloudFront CDN] ────── (Edge Caching for /_next/static/*)
        │ (Forward Dynamic Requests)
        ▼
[Application Load Balancer (ALB)] ── (Public Subnets AZ1 & AZ2)
        │
        ▼ (Port 80 / Target Group Health Check: /api/health)
[Standalone EC2 Instance] ────────── (Private Subnet AZ1)
        ├── Docker Next.js Container (Port 80)
        └── Encrypted EBS gp3 Volume (/var/data/sqlite)
```

### Key Architectural Highlights:
- **Single EC2 Server (Compute + Database):** Hosts both the Dockerized Next.js frontend/backend and local SQLite database, avoiding the monthly overhead of a dedicated RDS instance.
- **Amazon CloudFront CDN:** Protects the single EC2 instance by caching all static Next.js assets (`/_next/static/*`), reducing CPU and RAM load by 80–90%.
- **Isolated in Private Subnet:** The EC2 instance has no public IP address and no open inbound SSH port; it is accessed exclusively via ALB and AWS Systems Manager.
- **Persistent EBS Storage:** SQLite database file is stored on an encrypted Amazon EBS gp3 volume mounted at `/var/data/sqlite`, ensuring data survives container reloads.
- **AWS SSM Container Reload:** CI/CD triggers zero-SSH remote container updates via `aws ssm send-command`.

---

## ⚡ Quick Start

### 1. Run the Web Application Locally
```bash
cd app
npm install
npm run dev
# Open http://localhost:3000 in your browser
```

### 2. Deploy Infrastructure to Development Environment
```bash
cd infra
chmod +x deploy.sh
./deploy.sh dev
```
