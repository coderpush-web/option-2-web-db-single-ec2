#!/bin/bash
set -e

ENV=${1:-dev}
if [ "$ENV" != "dev" ] && [ "$ENV" != "prod" ]; then
    echo "Usage: ./deploy.sh [dev|prod] [image_tag]"
    exit 1
fi

IMAGE_TAG=${2:-latest}
if [ "$ENV" = "dev" ] && [ -z "$2" ]; then
    IMAGE_TAG="dev-latest"
fi

REGION=${AWS_REGION:-ap-southeast-1}

echo "=============================================="
echo "🚀 Triển khai Hạ tầng Môi trường: $ENV"
echo "   ImageTag: $IMAGE_TAG"
echo "   Region:   $REGION"
echo "=============================================="

# 1. Deploy Module Mạng (VPC, Subnets)
echo "1. Triển khai Network Module ($ENV-network)..."
aws cloudformation deploy \
  --template-file modules/vpc-subnets.yaml \
  --stack-name "$ENV-network" \
  --parameter-overrides EnvironmentName="$ENV" \
  --no-fail-on-empty-changeset \
  --region "$REGION"

# 2. Deploy Module Security Groups
echo "2. Triển khai Security Groups Module ($ENV-security-groups)..."
aws cloudformation deploy \
  --template-file modules/security-groups.yaml \
  --stack-name "$ENV-security-groups" \
  --parameter-overrides EnvironmentName="$ENV" \
  --no-fail-on-empty-changeset \
  --region "$REGION"

# 3. Deploy Module IAM Roles
echo "3. Triển khai IAM SSM & ECR Module ($ENV-iam)..."
aws cloudformation deploy \
  --template-file modules/iam-roles.yaml \
  --stack-name "$ENV-iam" \
  --parameter-overrides EnvironmentName="$ENV" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --region "$REGION"

# 4. Deploy Ứng dụng Compute theo tham số môi trường
echo "4. Triển khai Application Compute Stack ($ENV-app)..."
PARAM_ARGS="EnvironmentName=$ENV ImageTag=$IMAGE_TAG"
if [ -f "environments/$ENV.json" ]; then
  EXTRA_PARAMS=$(python3 -c "
import json
try:
    with open('environments/$ENV.json') as f:
        d = json.load(f).get('Parameters', {})
    d.pop('ImageTag', None)
    print(' '.join(f'{k}={v}' for k, v in d.items()))
except Exception:
    pass
" 2>/dev/null || true)
  if [ -n "$EXTRA_PARAMS" ]; then
    PARAM_ARGS="$EXTRA_PARAMS ImageTag=$IMAGE_TAG"
  fi
fi

aws cloudformation deploy \
  --template-file modules/app.yaml \
  --stack-name "$ENV-app" \
  --parameter-overrides $PARAM_ARGS \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --region "$REGION"

# 5. Tải lại container mới nhất trên Web EC2 qua AWS SSM Run Command
echo "5. Tải lại Docker container mới trên EC2 qua SSM ($ENV-web-sqlite-server)..."
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=$ENV-web-sqlite-server" "Name=instance-state-name,Values=running" \
  --region "$REGION" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text 2>/dev/null || true)
if [ -n "$INSTANCE_ID" ] && [ "$INSTANCE_ID" != "None" ]; then
  aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["systemctl restart react-webapp"]' \
    --region "$REGION" >/dev/null 2>&1 || true
  echo "Đã gửi tín hiệu reload tới instance $INSTANCE_ID qua AWS SSM."
fi

echo ""
echo "=== CloudFormation Stack Outputs ==="
aws cloudformation describe-stacks \
  --stack-name "$ENV-app" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[*].[OutputKey,OutputValue]" \
  --output table 2>/dev/null || true

echo "✅ Hoàn thành triển khai môi trường $ENV thành công!"
