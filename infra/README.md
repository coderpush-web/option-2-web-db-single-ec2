# Infrastructure Modules - option-2-web-db-single-ec2

This directory contains standalone AWS CloudFormation modules supporting both **Development (`dev`)** and **Production (`prod`)** environments.

## 1. Module Structure
- `modules/vpc-subnets.yaml`: Provisions VPC, Internet Gateway, 2 Public Subnets (ALB), and 1 Private Subnet (Standalone EC2).
- `modules/security-groups.yaml`: Manages Security Groups for ALB (ports 80/443) and the Standalone EC2 instance.
- `modules/iam-roles.yaml`: Configures EC2 IAM Instance Profile with AWS SSM Session Manager and Amazon ECR ReadOnly access.
- `modules/app.yaml`: Provisions compute & storage resources (Standalone EC2, encrypted EBS GP3 volume mounted at `/var/data/sqlite`, ALB, CloudFront Distribution).

## 2. Environment Configuration
- `environments/dev.json`: Cost-optimized parameters for Development (t3.micro, 20GB EBS).
- `environments/prod.json`: Production configuration (t3.medium 4GB RAM recommended for DB + App, 50GB EBS).

## 3. Automated CI/CD Deployment
Deployments are fully automated via GitHub Actions (`.github/workflows/deploy.yml`):
- **Production (`prod`)**: Automatically deploys when image build & push completes on `main`.
- **Manual Trigger (`workflow_dispatch`)**: Can be dispatched anytime from the GitHub Actions tab targeting `dev` or `prod`.
