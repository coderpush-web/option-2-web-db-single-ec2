#!/usr/bin/env bash
set -e

if command -v ferret-scan >/dev/null 2>&1; then
  ferret-scan --config .devsecops/ferret-scan.yaml .
else
  if git grep -E -I "(password|secret|token|api_key)\s*[:=]\s*[\"'][^\"']{8,}[\"']" -- ':!*.json' ':!*.sample' ':!package-lock.json' 2>/dev/null; then
    echo "❌ Potential secret or PII pattern detected!"
    exit 1
  fi
fi
exit 0
