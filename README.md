# Option 2: Web Application + Local DB on Single EC2

Independent infrastructure and application source code for **Option 2: Web Application + Local Persistent DB on Single EC2 with Amazon CloudFront Edge Caching**.

## 1. Architecture Overview
![Architecture](infra/architecture_diagram.png)

### Key Architectural Highlights:
- **CloudFront CDN Edge Caching:** Caches static assets (`/_next/static/*`) globally, reducing direct request pressure on the single EC2 server to preserve CPU/RAM for the co-located local database.
- **Application Load Balancer (ALB):** Spans Multi-AZ Public Subnets, handling SSL/TLS termination and forwarding traffic to the private EC2 instance.
- **Single EC2 Web + Local Database:** Runs the Dockerized Next.js application alongside a local SQLite database mounted onto an encrypted EBS gp3 volume (`/var/data/sqlite`).
- **AWS SSM Container Reload:** CI/CD triggers zero-SSH remote container updates via `aws ssm send-command`, pulling the latest image without opening inbound port 22.
- **Automated Monitoring & Alerts:** CloudWatch Alarms (ALB 5XX and EC2 CPU > 85%) notify engineers via Amazon SNS Topic; log retention auto-expires after 14 days (Dev) / 30 days (Prod).
- **AWS-Native Custom Domain:** Directs user traffic via DNS CNAME (DNS-only) directly to Amazon CloudFront Edge & ALB endpoints.

## 2. Cost Analysis

> 💡 **Verified via Infracost CLI:** Cost calculations derived directly from CloudFormation templates using `infracost scan ./infra/modules`.

### A. Component Cost Breakdown (Infracost CLI Verified)
| CloudFormation Module / Component | AWS Resource Type | Monthly Cost (USD) | Notes |
| :--- | :--- | :--- | :--- |
| **Application Load Balancer (ALB)** | `AWS::ElasticLoadBalancingV2::LoadBalancer` | **$16.43** | Multi-AZ SSL/TLS termination and health checking |
| **Single EC2 Web + Local DB** | `AWS::EC2::Instance` (`t3.micro` + EBS gp3) | **$9.49** | Baseline 1x instance (730 hrs/month) |
| **Secrets & Monitoring** | `SecretsManager`, `CloudWatch`, `SNS` | **$0.30** | Auth token secret + operational alarms |
| **Subtotal (Core Web + Database Tier)** | `infra/modules/app.yaml` | **$26.22 / mo** | ~664,000 VND / month |
| **Private VPC Interface Endpoints (Optional)** | `AWS::EC2::VPCEndpoint` (7 endpoints) | **$102.20** | SSM, ECR, CloudWatch Logs in Private Subnets |
| **Total (Full Enterprise Isolated Architecture)** | `infra/modules/` | **$128.42 / mo** | ~3,250,000 VND / month |

### B. Cost by Purchasing Option & Architecture Mode
| Purchasing Model / Mode | Web + DB Compute (`t3.micro`) | ALB & Supporting | Total (Lean Mode)* | Total (Full Isolated) | Approx. Local Currency (Lean) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **On-Demand (Default)** | $9.49 | $16.73 | **$26.22 / mo** | **$128.42 / mo** | ~664,000 VND |
| **1-Year Savings Plan** | $5.98 | $16.73 | **$22.71 / mo** *(13% off)* | **$124.91 / mo** | ~575,000 VND |
| **3-Year Savings Plan** | $3.79 | $16.73 | **$20.52 / mo** *(22% off)* | **$122.72 / mo** | ~520,000 VND |
| **Production Scale (`t3.small` 2GB RAM)** | $18.98 | $16.73 | **$35.71 / mo** | **$137.91 / mo** | ~905,000 VND |

*\*Lean Mode: Compute + ALB + CloudFront routing without dedicated VPC Interface Endpoints ($102.20/mo).*

## 3. Disaster Recovery & Recovery Time (MTTR)

Tested and verified under real AWS Chaos Engineering scenarios:

| Failure Scenario | Recovery Mechanism | Measured Recovery Time (MTTR) | Data Integrity / Impact |
| :--- | :--- | :--- | :--- |
| **Container Process Crash (`docker kill`)** | Systemd watchdog unit auto-restart | **7 seconds** | 100% data intact; uptime reset 66,270s → 5.7s |
| **Sudden Hard OS Reboot (`reboot -f`)** | EBS gp3 auto-remount + SQLite WAL recovery | **16 seconds** | 100% data integrity verified (0 data loss) |
| **SQLite I/O Performance** | Better-sqlite3 WAL transaction on EBS gp3 | **3ms** per 1,000 writes | 0.003ms/row write; 0.004ms/query read |
| **Target Response Latency** | CloudWatch ALB Metrics | **8.8ms average** | Fast local SQLite response time |

## 4. Application Screenshots

| Development Environment (`opt2-dev.png261.dev`) | Production Environment (`opt2.png261.dev`) |
| :---: | :---: |
| ![Development Environment](docs/screenshots/dev_screenshot.png) | ![Production Environment](docs/screenshots/prod_screenshot.png) |
