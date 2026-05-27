#!/bin/bash
# Script to check API logs for hits

echo "=== Track API Logs Analysis ==="
echo ""

echo "📊 Total Track API requests in last 7 days:"
docker logs admin-center-backend-dev --since 7d 2>&1 | grep -c "\[Track API\] Received request" || echo "0"

echo ""
echo "📋 Last 10 Track API requests:"
docker logs admin-center-backend-dev 2>&1 | grep -A 8 "\[Track API\] Received request" | tail -100

echo ""
echo "✅ Last 10 successful trackings:"
docker logs admin-center-backend-dev 2>&1 | grep "\[Track API\] Successfully tracked" | tail -10

echo ""
echo "❌ Any errors in Track API:"
docker logs admin-center-backend-dev --since 7d 2>&1 | grep -E "\[Track API\].*Error|Validation failed" | tail -10

echo ""
echo "🔍 Checking for blocked/failed requests:"
docker logs admin-center-backend-dev --since 7d 2>&1 | grep -iE "refused|timeout|blocked|401|403|500" | grep -iE "track|api" | tail -10







