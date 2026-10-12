#!/usr/bin/env bash
set -e
if grep -rn --exclude="ci-infra.yml" --exclude="security-compliance.yml" "AWS_ACCESS_KEY_ID" .github/workflows/ 2>/dev/null; then
  echo "❌ Static AWS credentials detected in .github/workflows/! OIDC only is permitted."
  exit 1
fi
exit 0
