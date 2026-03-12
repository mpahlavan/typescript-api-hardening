#!/bin/bash

BASE="http://localhost:5003"

echo "=============================="
echo "HEALTH CHECK"
echo "=============================="
curl -i $BASE/health
echo -e "\n"

echo "=============================="
echo "LIST TEMPLATES"
echo "=============================="
curl -i $BASE/templates
echo -e "\n"

echo "=============================="
echo "GET EXISTING TEMPLATE"
echo "=============================="
curl -i $BASE/templates/tpl_001
echo -e "\n"

echo "=============================="
echo "ERROR: GET NON EXISTING TEMPLATE"
echo "=============================="
curl -i $BASE/templates/not_exist
echo -e "\n"

echo "=============================="
echo "CREATE TEMPLATE (VALID)"
echo "=============================="
curl -i -X POST $BASE/templates \
-H "Content-Type: application/json" \
-d '{
"id":"tpl_004",
"title":"Test Template",
"source":{"type":"canvas","width":1080,"height":1080},
"order_index":4,
"categories":["test","demo"]
}'
echo -e "\n"

echo "=============================="
echo "ERROR: CREATE TEMPLATE WITH EMPTY BODY"
echo "=============================="
curl -i -X POST $BASE/templates \
-H "Content-Type: application/json" \
-d '{}'
echo -e "\n"

echo "=============================="
echo "ERROR: CREATE TEMPLATE WITH INVALID JSON"
echo "=============================="
curl -i -X POST $BASE/templates \
-H "Content-Type: application/json" \
-d '{invalid}'
echo -e "\n"

echo "=============================="
echo "UPDATE TEMPLATE (VALID)"
echo "=============================="
curl -i -X PATCH $BASE/templates/tpl_004 \
-H "Content-Type: application/json" \
-d '{"title":"Updated Template"}'
echo -e "\n"

echo "=============================="
echo "ERROR: UPDATE NON EXISTING TEMPLATE"
echo "=============================="
curl -i -X PATCH $BASE/templates/not_exist \
-H "Content-Type: application/json" \
-d '{"title":"Test"}'
echo -e "\n"

echo "=============================="
echo "SEARCH TEMPLATES"
echo "=============================="
curl -i "$BASE/templates/search?q=promo"
echo -e "\n"

echo "=============================="
echo "ERROR: SEARCH WITHOUT QUERY"
echo "=============================="
curl -i "$BASE/templates/search?q="
echo -e "\n"

echo "=============================="
echo "DELETE TEMPLATE (VALID)"
echo "=============================="
curl -i -X DELETE $BASE/templates/tpl_004
echo -e "\n"

echo "=============================="
echo "ERROR: DELETE NON EXISTING TEMPLATE"
echo "=============================="
curl -i -X DELETE $BASE/templates/not_exist
echo -e "\n"

echo "=============================="
echo "LIST CATEGORIES"
echo "=============================="
curl -i $BASE/categories
echo -e "\n"

echo "=============================="
echo "CREATE CATEGORY"
echo "=============================="
curl -i -X POST $BASE/categories \
-H "Content-Type: application/json" \
-d '{"slug":"demo_category"}'
echo -e "\n"

echo "=============================="
echo "ERROR: CREATE CATEGORY EMPTY BODY"
echo "=============================="
curl -i -X POST $BASE/categories \
-H "Content-Type: application/json" \
-d '{}'
echo -e "\n"

echo "=============================="
echo "STATS"
echo "=============================="
curl -i $BASE/stats
echo -e "\n"

echo "=============================="
echo "ERROR: UNKNOWN ROUTE"
echo "=============================="
curl -i $BASE/unknown_route
echo -e "\n"