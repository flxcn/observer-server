#!/bin/bash

# Test script for the export endpoint
# Usage: ./test-endpoint.sh [SERVER_URL]

SERVER_URL="${1:-http://localhost:3000}"

echo "🧪 Testing server at: $SERVER_URL"
echo ""

# Test 1: Health check
echo "1️⃣  Testing health endpoint..."
curl -s "$SERVER_URL/health" | jq '.'
echo ""

# Test 2: Main endpoint
echo "2️⃣  Testing stats endpoint..."
curl -s "$SERVER_URL/api/stats" | jq '.'
echo ""

# Test 3: Export endpoint with sample data
echo "3️⃣  Testing export endpoint with sample data..."
curl -X POST "$SERVER_URL/api/export-history" \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "test_participant_'$(date +%s)'",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "entryCount": 3,
    "history": [
      {
        "url": "https://www.google.com/search?q=test",
        "title": "test - Google Search",
        "lastVisitTime": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
        "visitCount": 1,
        "typedCount": 0
      },
      {
        "url": "https://www.princeton.edu",
        "title": "Princeton University",
        "lastVisitTime": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
        "visitCount": 5,
        "typedCount": 2
      },
      {
        "url": "https://github.com",
        "title": "GitHub",
        "lastVisitTime": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
        "visitCount": 10,
        "typedCount": 1
      }
    ]
  }' | jq '.'
echo ""

echo "✅ Test complete!"
