#!/bin/bash
set -euo pipefail

REPO_DIR="/var/www/hales-ai-website"
APP_NAME="hales-ai-website"
CANDIDATE_TAG="${APP_NAME}:candidate"
ALLOW_CANONICAL_OVERRIDE="${ALLOW_CANONICAL_OVERRIDE:-0}"

assert_file_hash() {
  local file="$1"
  local expected="$2"
  if [[ ! -f "$file" ]]; then
    echo "[CANONICAL-GATE] Missing required file: $file"
    return 1
  fi
  local actual
  actual=$(sha256sum "$file" | awk '{print $1}')
  if [[ "$actual" != "$expected" ]]; then
    echo "[CANONICAL-GATE] Hash mismatch for $file"
    echo "[CANONICAL-GATE] Expected: $expected"
    echo "[CANONICAL-GATE] Actual:   $actual"
    echo "[CANONICAL-GATE] Refusing deploy to prevent website regression."
    return 1
  fi
}

assert_contains() {
  local file="$1"
  local needle="$2"
  if ! grep -Fq "$needle" "$file"; then
    echo "[CANONICAL-GATE] Required marker not found in $file: $needle"
    return 1
  fi
}

assert_not_contains() {
  local file="$1"
  local needle="$2"
  if grep -Fq "$needle" "$file"; then
    echo "[CANONICAL-GATE] Regression marker found in $file: $needle"
    return 1
  fi
}

smoke_check() {
  local ok=0
  for _ in 1 2 3 4 5 6; do
    if curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1; then
      ok=1
      break
    fi
    sleep 3
  done
  if [[ "$ok" -ne 1 ]]; then
    echo "[SMOKE] localhost:3000 did not become healthy"
    return 1
  fi

  if ! curl -fsS http://127.0.0.1:3000/lab/hal/index.html | grep -Fq "hales:sentinel-ready"; then
    echo "[SMOKE] HAL document missing"
    return 1
  fi

  if ! curl -fsS https://hales.ai >/dev/null 2>&1; then
    echo "[SMOKE] https://hales.ai not reachable after deploy"
    return 1
  fi
}

cd "$REPO_DIR"
git fetch origin
git reset --hard origin/main

if [[ "$ALLOW_CANONICAL_OVERRIDE" != "1" ]]; then
  echo "[CANONICAL-GATE] Running source-of-truth checks"

  assert_file_hash src/App.tsx a423957879a6bfbc78589e48b2054ac2c5e9a779e045600c3c196c1ebb7a7d1c
  assert_file_hash src/components/experience/HalesExperience.tsx 729aeb758aae26748ae4bc50a5c1387435b7cef6c0a188ed44777b2218768ba3
  assert_file_hash src/components/experience/experience.css 207d701a8db76d28d2250f8b267f8d7c77f69cd5bdeb1f1a74d012374fe6e1a0
  assert_file_hash src/components/VoiceButton.tsx 6d293f5a5185bf0b686db5ae96b327d3a7a551002829953e8092627541b35487
  assert_file_hash src/hooks/use-vapi.ts c7e88040370f7925c6c9def79647fe1d61928dc48d82d0f8d9e9ee07ced9d070
  assert_file_hash src/components/ChatInterface.tsx 94a9624c8afce7fa13d49911bb867fb224522627ae9c6fa77d70a93f89e76f10
  assert_file_hash src/pages/cupcake/sandbox/cupcakegpt/page.tsx 1a8a3a5594d0403dea79496bad1064154257a8bb01e692b325bb591b8aca9a94
  assert_file_hash public/lab/hal/index.html 0c8fed7b15bbd9fa71d20816b094716552dba952d6048159f5d53e3eea80163d
  assert_file_hash public/lab/sentinel/index.html b335733a0b39fc8580ed0b330f4826325eee6bda946c00b83aa22c89c46d63a2
  assert_file_hash Dockerfile c8b7f03c6eab0f87e798154ca170fe4cc1233a3a4551ddba082895690e041f24
  assert_file_hash index.html cd9d981f2c6d51b20772451583e20ab5cb82db71a3e0213a01ca866c6449e973
  assert_file_hash public/favicon.svg 01bb4ff889b11ab699457c2bf39974900eda77d9405a2bd1291d27d983aaf421

  assert_contains src/App.tsx "HalesExperience"
  assert_contains src/App.tsx "ChatInterface"
  assert_contains src/components/experience/HalesExperience.tsx "SentinelLab"
  assert_contains public/lab/hal/index.html "TALK TO HAL"
  assert_contains public/lab/hal/index.html "hales:sentinel-ready"
  assert_contains src/components/ChatInterface.tsx "hales-public-chat"
  assert_not_contains src/pages/cupcake/sandbox/cupcakegpt/page.tsx "VITE_CUPCAKEGPT_KEY"
  assert_not_contains Dockerfile "VITE_CUPCAKEGPT_KEY"
  assert_not_contains src/App.tsx "Under Construction"

  echo "[CANONICAL-GATE] Passed"
else
  echo "[CANONICAL-GATE] OVERRIDE ENABLED (ALLOW_CANONICAL_OVERRIDE=1)"
fi

PREV_IMAGE_TAG=""
if docker image inspect "$APP_NAME" >/dev/null 2>&1; then
  PREV_IMAGE_TAG="${APP_NAME}:rollback-$(date +%Y%m%d%H%M%S)"
  docker tag "$APP_NAME" "$PREV_IMAGE_TAG"
  echo "[ROLLBACK] Backup image tagged: $PREV_IMAGE_TAG"
fi

docker build --no-cache -t "$CANDIDATE_TAG" .
docker stop "$APP_NAME" || true
docker rm "$APP_NAME" || true
if ! docker run -d -p 3000:3000 --restart always --name "$APP_NAME" "$CANDIDATE_TAG" || ! smoke_check; then
  echo "[ROLLBACK] Smoke check failed, attempting rollback"
  docker stop "$APP_NAME" || true
  docker rm "$APP_NAME" || true
  if [[ -n "$PREV_IMAGE_TAG" ]]; then
    docker run -d -p 3000:3000 --restart always --name "$APP_NAME" "$PREV_IMAGE_TAG"
    echo "[ROLLBACK] Restored previous image: $PREV_IMAGE_TAG"
  else
    echo "[ROLLBACK] No previous image available"
    exit 1
  fi
  exit 1
fi

docker tag "$CANDIDATE_TAG" "$APP_NAME"
echo "Deployed at $(date)"
