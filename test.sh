#!/bin/bash

echo "🧪 QuackStack Test Suite"
echo "========================"
echo ""

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

echo "📦 Building..."
cd ~/code/quackstack
pnpm build

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Build successful${NC}\n"
else
  echo -e "${RED}✗ Build failed${NC}\n"
  exit 1
fi

echo "🔗 Linking locally..."
npm link
echo ""

run_test "Help command" "quack --help"

run_test "Version command" "quack --version"

cd ~/code/episteme

run_test "Context generation (--context)" "timeout 30s quack --context"

run_test "Docs generation (--docs)" "timeout 30s quack --docs"

echo -e "${YELLOW}Checking generated files...${NC}"

FILES=(".cursorrules" ".windsurfrules" ".clinerules" ".continue/context.md" ".aider.conf.yml" "CODEBASE.md")

for file in "${FILES[@]}"; do
  if [ -f "$file" ] || [ -d "$(dirname $file)" ]; then
    echo -e "${GREEN}✓ ${file} exists${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ ${file} missing${NC}"
    ((TESTS_FAILED++))
  fi
done
echo ""

echo -e "${YELLOW}Testing: Interactive mode starts${NC}"
timeout 5s bash -c 'echo "" | quack' &> /dev/null
if [ $? -eq 124 ] || [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ PASSED${NC}\n"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAILED${NC}\n"
  ((TESTS_FAILED++))
fi

echo -e "${YELLOW}Testing package manager compatibility...${NC}"

if command -v pnpm &> /dev/null; then
  echo "Testing with pnpm..."
  pnpm remove -g quackstack &> /dev/null
  pnpm add -g quackstack &> /dev/null
  if quack --version &> /dev/null; then
    echo -e "${GREEN}✓ pnpm works${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ pnpm failed${NC}"
    ((TESTS_FAILED++))
  fi
fi

if command -v bun &> /dev/null; then
  echo "Testing with bun..."
  bun remove -g quackstack &> /dev/null
  bun pm -g trust quackstack &> /dev/null
  bun add -g quackstack &> /dev/null
  hash -r
  if quack --version &> /dev/null; then
    echo -e "${GREEN}✓ bun works${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ bun failed${NC}"
    ((TESTS_FAILED++))
  fi
fi

# Test npm
echo "Testing with npm..."
npm install -g quackstack &> /dev/null
if quack --version &> /dev/null; then
  echo -e "${GREEN}✓ npm works${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ npm failed${NC}"
  ((TESTS_FAILED++))
fi

echo ""
echo "========================"
echo "📊 Test Results"
echo "========================"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
fi