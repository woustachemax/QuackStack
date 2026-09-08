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

check_file() {
  local file=$1
  local test_name=$2
  
  echo -e "${YELLOW}Checking: ${test_name}${NC}"
  
  if [ -f "$file" ] && [ -s "$file" ]; then
    echo -e "${GREEN}✓ ${file} exists and has content${NC}\n"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}✗ ${file} missing or empty${NC}\n"
    ((TESTS_FAILED++))
  fi
}

check_env() {
  echo -e "${YELLOW}Checking environment...${NC}"
  
  if [ ! -f .env ]; then
    echo -e "${RED}✗ .env file not found${NC}\n"
    exit 1
  fi
  
  source .env
  
  if [ -z "$QUACKSTACK_OPENAI_KEY" ] && \
     [ -z "$QUACKSTACK_ANTHROPIC_KEY" ] && \
     [ -z "$QUACKSTACK_GEMINI_KEY" ] && \
     [ -z "$QUACKSTACK_DEEPSEEK_KEY" ] && \
     [ -z "$QUACKSTACK_MISTRAL_KEY" ]; then
    echo -e "${RED}✗ No AI provider key found${NC}\n"
    exit 1
  fi
  
  if [ -z "$QUACKSTACK_DATABASE_URL" ]; then
    echo -e "${RED}✗ QUACKSTACK_DATABASE_URL not set${NC}\n"
    exit 1
  fi
  
  echo -e "${GREEN}✓ Environment OK${NC}\n"
}

check_env

echo "📦 Building..."
pnpm build

if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Build failed${NC}\n"
  exit 1
fi
echo -e "${GREEN}✓ Build successful${NC}\n"

echo "🗄️ Database setup..."
pnpm exec prisma generate &> /dev/null
pnpm exec prisma db push --skip-generate &> /dev/null
echo -e "${GREEN}✓ Database ready${NC}\n"

echo "🔗 Linking..."
npm link &> /dev/null
echo ""

run_test "Help command" "quack --help"
run_test "Version command" "quack --version"

echo -e "${YELLOW}Testing: Agent-attributed blame (on quackstack's own repo)${NC}"
BLAME_OUT=$(quack blame src/lib/ai-provider.ts:130 2>&1)
if echo "$BLAME_OUT" | grep -q "b804f6f" && echo "$BLAME_OUT" | grep -qi "Claude Code"; then
  echo -e "${GREEN}✓ PASSED${NC}\n"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "$BLAME_OUT"
  echo ""
  ((TESTS_FAILED++))
fi

run_test "Agent authors breakdown" "quack authors --agents"

echo "📁 Creating test directory..."
TEST_DIR=$(mktemp -d)
cp .env "$TEST_DIR/"
mkdir -p "$TEST_DIR/src"
echo "console.log('test');" > "$TEST_DIR/src/index.js"
cd "$TEST_DIR"
echo -e "${GREEN}✓ Test project ready${NC}\n"

run_test "Context generation" "quack --context"

check_file ".cursorrules" "Cursor rules file"
check_file ".windsurfrules" "Windsurf rules file"
check_file ".clinerules" "Cline rules file"
check_file ".aider.conf.yml" "Aider config file"
check_file ".aider.context.md" "Aider context file"

if [ -f ".continue/context.md" ] && [ -s ".continue/context.md" ]; then
  echo -e "${GREEN}✓ .continue/context.md exists${NC}\n"
  ((TESTS_PASSED++))
else
  echo -e "${RED}✗ .continue/context.md missing${NC}\n"
  ((TESTS_FAILED++))
fi

run_test "Docs generation" "quack --docs"
check_file "CODEBASE.md" "Codebase documentation"

echo "🧹 Cleanup..."
cd - > /dev/null
rm -rf "$TEST_DIR"
echo ""

echo "========================"
echo "📊 Results"
echo "========================"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Tests failed${NC}"
  exit 1
fi