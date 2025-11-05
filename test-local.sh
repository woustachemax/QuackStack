#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
  local test_name=$1
  local command=$2
  
  echo -e "${YELLOW}Testing: ${test_name}${NC}"
  
  if eval "$command" &> /dev/null; then
    echo -e "${GREEN}✓ PASSED${NC}\n"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ FAILED${NC}\n"
    ((TESTS_FAILED++))
  fi
}

if [ ! -f .env ]; then
  echo -e "${RED}✗ .env not found${NC}\n"
  exit 1
fi

echo "📦 Building..."
pnpm build
echo -e "${GREEN}✓ Built${NC}\n"

echo "🗄️ Database..."
pnpm exec prisma generate &> /dev/null
pnpm exec prisma db push --skip-generate &> /dev/null
echo -e "${GREEN}✓ Ready${NC}\n"

run_test "Help" "node dist/cli.js --help"
run_test "Version" "node dist/cli.js --version"
run_test "Context" "timeout 60s node dist/cli.js --context"

echo ""
echo "📊 Results: ${GREEN}${TESTS_PASSED} passed${NC}, ${RED}${TESTS_FAILED} failed${NC}"

[ $TESTS_FAILED -eq 0 ] && exit 0 || exit 1