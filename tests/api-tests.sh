```bash
#!/bin/bash
set -e
BASE="http://localhost:3000"

echo "1) Test tenant route"
curl -s $BASE/api/tenant/tenant123 | jq

echo "\n2) Test create-order (POST)"
curl -s -X POST $BASE/api/create-order -H "Content-Type: application/json" -d '{"tenantId":"tenant123","amount":8000}' | jq

echo "\n3) Test create-order missing fields (should 400)"
curl -s -X POST $BASE/api/create-order -H "Content-Type: application/json" -d '{}' -w "\nHTTP_CODE:%{http_code}\n" | jq -c || true

echo "\n4) Test create-order (GET should 405)"
curl -s -X GET $BASE/api/create-order -w "\nHTTP_CODE:%{http_code}\n" | jq -c || true

echo "\n5) Test verify-payment (POST) - demo signature"
curl -s -X POST $BASE/api/verify-payment -H "Content-Type: application/json" -d '{"razorpay_payment_id":"pay_123","razorpay_order_id":"order_test_123","razorpay_signature":"sig","tenantId":"tenant123"}' | jq

echo "\n6) Test webhook (POST)"
curl -s -X POST $BASE/api/webhook -H "Content-Type: application/json" -d '{"event":"payment.captured","payload":{}}' | jq

echo "\nAll tests ran (check responses above)."
```