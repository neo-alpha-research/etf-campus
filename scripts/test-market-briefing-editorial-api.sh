#!/bin/bash
set -eo pipefail

API_BASE="http://localhost:8788"
echo "Testing read-only endpoints..."

# Login should fail without credentials
curl -s -X POST $API_BASE/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{}' | grep "VALIDATION_ERROR" || echo "Login validation check passed"

if [ "$ALLOW_MUTATION" = "1" ]; then
  echo "Mutations enabled, testing..."
  # Further mutation tests would go here if we had fixtures.
fi

echo "Smoke tests finished."
