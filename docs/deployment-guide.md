# Deployment Guide - Option 2: Web Application + Local DB on Single EC2

This guide provides step-by-step instructions for deploying the AWS CloudFormation infrastructure and containerized web application for **Option 2: Web Application + Local SQLite Database on Single EC2**.

---

## 1. Prerequisites

Ensure the following tools and permissions are set up:

- **AWS CLI v2**: Configured with administrator or adequate IAM privileges across CloudFormation, EC2, VPC, ELBv2, CloudFront, ECR, SSM, and CloudWatch.
- **Docker Engine**: Docker 24.x+ or Docker Desktop.
- **Node.js**: Node.js 20.x LTS or higher.
- **Python 3**: Python 3.10+ (for environment parameter parsing).
- **cfn-lint** *(optional)*: For validating CloudFormation templates (`pip install cfn-lint`).

---

## 2. Infrastructure Code Structure

All CloudFormation files reside under `infra/`:

```text
infra/
├── environments/
│   ├── dev.json             # Environment parameters for Development
│   └── prod.json            # Environment parameters for Production
└── modules/
    ├── vpc-subnets.yaml     # Module 1: VPC, IGW, Public Subnets (2 AZs), Private Subnet (1 AZ)
    ├── security-groups.yaml # Module 2: Security Groups for ALB and EC2 Instance
    ├── iam-roles.yaml       # Module 3: EC2 IAM Role & Instance Profile (SSM, ECR ReadOnly)
    └── app.yaml             # Module 4: ALB, Standalone EC2 Instance, EBS Volume, CloudFront
```

---

## 3. Environment Parameter Configuration

Configuration files are located in `infra/environments/dev.json` and `infra/environments/prod.json`.

| Parameter | Dev Value | Prod Value | Description |
| :--- | :--- | :--- | :--- |
| `EnvironmentName` | `dev` | `prod` | Prefix for naming and tagging AWS resources |
| `InstanceType` | `t3.micro` | `t3.medium` (4GB RAM) | EC2 instance sizing (t3.medium recommended for DB + App) |
| `WebVolumeSize` | `20` | `50` | Root EBS volume size in GB (gp3 encrypted) |
| `LogRetentionDays` | `14` | `30` | CloudWatch log retention period in days |

---

## 4. Automated Deployment via GitHub Actions (CI/CD)

The repository features a modular CI/CD pipeline split into 4 focused GitHub Actions workflows:
- `.github/workflows/ci-app.yml`: Application testing and validation (`test/test_api.js`).
- `.github/workflows/ci-infra.yml`: Infrastructure validation and linting (`cfn-lint`).
- `.github/workflows/build-ecr.yml`: Builds Docker container image and pushes to Amazon ECR.
- `.github/workflows/deploy.yml`: Deploys CloudFormation stacks and triggers instance refresh.

### Required GitHub Repository Secrets:
Under **Settings** -> **Secrets and variables** -> **Actions**:
- `AWS_ACCESS_KEY_ID`: IAM user/role access key.
- `AWS_SECRET_ACCESS_KEY`: IAM user/role secret access key.
- `AWS_REGION`: AWS Region (default: `ap-southeast-1`).

### Automated Workflow Stages:
1. **Application Testing & Linting:** Runs unit tests and validates CloudFormation syntax with `cfn-lint`.
2. **Docker Build & Push to ECR:** Multi-stage Docker build, pushed to Amazon ECR with tags `dev-latest` (on `dev`) or `latest` (on `main`).
3. **Infrastructure Deployment:** Triggers GitHub Actions CD (`deploy.yml`) to update CloudFormation stacks.
4. **Remote Container Reload via SSM:**
   After pushing the image, GitHub Actions CD queries the EC2 instance ID and runs:
   ```bash
   aws ssm send-command \
     --instance-ids "$INSTANCE_ID" \
     --document-name "AWS-RunShellScript" \
     --parameters 'commands=["systemctl restart react-webapp"]'
   ```
   This restarts the systemd service to pull and run the new container without requiring SSH access.

---

## 5. Manual Deployment via AWS CLI

### Step 1: Build and Push Docker Image to ECR

```bash
# Configure environment
export AWS_REGION="ap-southeast-1"
export ENV="dev" # or prod
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REPO_NAME="${ENV}-option-2-web-app"
export IMAGE_TAG="dev-latest" # or latest for prod

# Create ECR repository if needed
aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$AWS_REGION" 2>/dev/null || \
aws ecr create-repository --repository-name "$REPO_NAME" --region "$AWS_REGION"

# Log in to ECR
aws ecr get-login-password --region "$AWS_REGION" | \
docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build and push image
cd app
docker build -t "$REPO_NAME:$IMAGE_TAG" .
docker tag "$REPO_NAME:$IMAGE_TAG" "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:${IMAGE_TAG}"
docker push "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}:${IMAGE_TAG}"
cd ..
```

### Step 2: Run Deployment Script

```bash
cd infra
chmod +x deploy.sh

# Deploy to Dev
./deploy.sh dev dev-latest

# Deploy to Prod
./deploy.sh prod latest
```

The script executes:
1. `${ENV}-network`: Provisions VPC and subnets.
2. `${ENV}-security-groups`: Creates ALB and EC2 Security Groups.
3. `${ENV}-iam`: Configures the EC2 Instance Profile with SSM and ECR permissions.
4. `${ENV}-app`: Provisions the EC2 instance, creates the `/var/data/sqlite` persistent directory, launches the Application Load Balancer, and sets up CloudFront.
5. Invokes AWS Systems Manager to trigger container reload on the target instance.

---

## 6. Custom Domain & DNS Mapping

Retrieve the CloudFront domain from stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name dev-app \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomain'].OutputValue" \
  --output text
```

In your DNS manager:
- **Record Type:** `CNAME`
- **Host:** `opt2-dev` (or `opt2` for Prod)
- **Target:** `<distribution-id>.cloudfront.net`
- **Proxy Status:** **DNS Only (Grey Cloud ☁️)**

---

## 7. Infrastructure Teardown & Resource Cleanup

To delete all provisioned resources:

```bash
ENV="dev" # or prod

aws cloudformation delete-stack --stack-name "${ENV}-app"
aws cloudformation wait stack-delete-complete --stack-name "${ENV}-app"

aws cloudformation delete-stack --stack-name "${ENV}-iam"
aws cloudformation wait stack-delete-complete --stack-name "${ENV}-iam"

aws cloudformation delete-stack --stack-name "${ENV}-security-groups"
aws cloudformation wait stack-delete-complete --stack-name "${ENV}-security-groups"

aws cloudformation delete-stack --stack-name "${ENV}-network"
aws cloudformation wait stack-delete-complete --stack-name "${ENV}-network"

echo "✅ Teardown complete for environment: $ENV"
```