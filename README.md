# Option 2: Web Application + Local DB on Single EC2

Independent infrastructure and application source code for **Option 2: Web Application + Local Persistent DB on Single EC2 with Amazon CloudFront Edge Caching and AWS NAT Gateway**.

## 1. Architecture Overview
![Architecture](infra/architecture_diagram.png)

## 2. Cost Analysis

> 💡 **Verified via Infracost CLI:** Cost calculations derived directly from CloudFormation templates using `infracost scan ./infra/modules`.

### A. Component Cost Breakdown (Infracost CLI Verified)
| CloudFormation Module / Component | AWS Resource Type | Monthly Cost (USD) | Notes |
| :--- | :--- | :--- | :--- |
| **AWS NAT Gateway** | `AWS::EC2::NatGateway` | **$32.85** | Managed NAT Gateway in Public Subnet (0.0.0.0/0 egress) |
| **Application Load Balancer (ALB)** | `AWS::ElasticLoadBalancingV2::LoadBalancer` | **$16.43** | Multi-AZ SSL/TLS termination and health checking |
| **Single EC2 Web + Local DB** | `AWS::EC2::Instance` (`t3.micro` + EBS gp3) | **$9.49** | Baseline 1x instance (730 hrs/month) |
| **Secrets & Monitoring** | `SecretsManager`, `CloudWatch`, `SNS` | **$0.30** | Auth token secret + operational alarms |
| **Total Monthly Cost** | `infra/modules/` | **$59.07 / mo** | ~1,495,000 VND / month |

*(Saves **$69.35 / month** compared to the previous 7 VPC Interface Endpoints architecture at $102.20/month).*

### B. Cost by Purchasing Option & Commitment
| Purchasing Model | Web + DB Compute (`t3.micro`) | NAT Gateway & ALB | Total Monthly Cost | Approx. Local Currency (VND) |
| :--- | :--- | :--- | :--- | :--- |
| **On-Demand (Default)** | $9.49 | $49.58 | **$59.07 / mo** | ~1,495,000 VND |
| **1-Year Savings Plan** | $5.98 | $49.58 | **$55.56 / mo** *(6% savings)* | ~1,405,000 VND |
| **3-Year Savings Plan** | $3.79 | $49.58 | **$53.37 / mo** *(10% savings)* | ~1,350,000 VND |
| **Production Scale (`t3.small` 2GB RAM)** | $18.98 | $49.58 | **$68.56 / mo** | ~1,735,000 VND |

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
