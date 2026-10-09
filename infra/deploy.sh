#!/bin/bash
# Script triển khai hạ tầng tự động theo môi trường
ENV=${1:-dev}

if [ "$ENV" != "dev" ] && [ "$ENV" != "prod" ]; then
    echo "Usage: ./deploy.sh [dev|prod]"
    exit 1
fi

echo "=============================================="
echo "🚀 Triển khai Hạ tầng Môi trường: $ENV"
echo "=============================================="

# 1. Deploy Module Mạng (VPC, Subnets)
echo "1. Triển khai Network Module..."
aws cloudformation deploy \
  --template-file modules/vpc-subnets.yaml \
  --stack-name "$ENV-network" \
  --parameter-overrides EnvironmentName=$ENV \
  --region ap-southeast-1

# 2. Deploy Module Security Groups
echo "2. Triển khai Security Groups Module..."
aws cloudformation deploy \
  --template-file modules/security-groups.yaml \
  --stack-name "$ENV-security-groups" \
  --parameter-overrides EnvironmentName=$ENV \
  --region ap-southeast-1

# 3. Deploy Module IAM Roles
echo "3. Triển khai IAM SSM Module..."
aws cloudformation deploy \
  --template-file modules/iam-roles.yaml \
  --stack-name "$ENV-iam" \
  --parameter-overrides EnvironmentName=$ENV \
  --capabilities CAPABILITY_IAM \
  --region ap-southeast-1

# 4. Deploy Ứng dụng Compute theo tham số môi trường
echo "4. Triển khai Application Compute Stack..."
if [ -f "environments/$ENV.json" ]; then
    aws cloudformation deploy \
      --template-file modules/app.yaml \
      --stack-name "$ENV-app" \
      --parameter-overrides file://environments/$ENV.json \
      --region ap-southeast-1
else
    aws cloudformation deploy \
      --template-file modules/app.yaml \
      --stack-name "$ENV-app" \
      --parameter-overrides EnvironmentName=$ENV \
      --region ap-southeast-1
fi

echo "✅ Hoàn thành triển khai môi trường $ENV thành công!"
