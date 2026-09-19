#!/bin/bash
# Build and validate on the Mac; the shared server performs no npm/Node work.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
REMOTE=root@134.199.239.171
APP=hales-ai-website
NGINX_IMAGE=sha256:b76de378d57272a1dd9091a05dd548a3639dfb792ebdbf95d06704d2950afdea
RELEASE_COMMIT=""
PAGE_SHA256=""

usage() { echo "usage: $0 --release-commit <origin/main sha> --page-sha256 <reviewed page sha256> [--apply]"; }
APPLY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-commit) RELEASE_COMMIT="$2"; shift 2;;
    --page-sha256) PAGE_SHA256="$2"; shift 2;;
    --apply) APPLY=1; shift;;
    *) usage; exit 2;;
  esac
done
[[ "$RELEASE_COMMIT" =~ ^[0-9a-f]{40}$ && "$PAGE_SHA256" =~ ^[0-9a-f]{64}$ ]] || { usage; exit 2; }

cd "$ROOT"
git fetch --quiet origin main
[[ "$(git rev-parse origin/main)" == "$RELEASE_COMMIT" ]] || { echo "release commit is not current origin/main"; exit 1; }

WORK=$(mktemp -d "${TMPDIR:-/tmp}/hales-prebuilt.XXXXXX")
cleanup() { python3 - "$WORK" <<'PY'
import shutil,sys
shutil.rmtree(sys.argv[1],ignore_errors=True)
PY
}
trap cleanup EXIT
git archive "$RELEASE_COMMIT" | tar -x -C "$WORK"

assert_hash() { [[ "$(shasum -a 256 "$WORK/$1" | awk '{print $1}')" == "$2" ]] || { echo "canonical hash mismatch: $1"; exit 1; }; }
assert_hash src/App.tsx a423957879a6bfbc78589e48b2054ac2c5e9a779e045600c3c196c1ebb7a7d1c
assert_hash src/components/experience/HalesExperience.tsx 729aeb758aae26748ae4bc50a5c1387435b7cef6c0a188ed44777b2218768ba3
assert_hash src/components/experience/experience.css 207d701a8db76d28d2250f8b267f8d7c77f69cd5bdeb1f1a74d012374fe6e1a0
assert_hash src/components/VoiceButton.tsx 6d293f5a5185bf0b686db5ae96b327d3a7a551002829953e8092627541b35487
assert_hash src/hooks/use-vapi.ts c7e88040370f7925c6c9def79647fe1d61928dc48d82d0f8d9e9ee07ced9d070
assert_hash src/components/ChatInterface.tsx 94a9624c8afce7fa13d49911bb867fb224522627ae9c6fa77d70a93f89e76f10
assert_hash src/pages/cupcake/sandbox/cupcakegpt/page.tsx "$PAGE_SHA256"
assert_hash public/lab/hal/index.html 0c8fed7b15bbd9fa71d20816b094716552dba952d6048159f5d53e3eea80163d
assert_hash public/lab/sentinel/index.html b335733a0b39fc8580ed0b330f4826325eee6bda946c00b83aa22c89c46d63a2
assert_hash index.html cd9d981f2c6d51b20772451583e20ab5cb82db71a3e0213a01ca866c6449e973
assert_hash public/favicon.svg 01bb4ff889b11ab699457c2bf39974900eda77d9405a2bd1291d27d983aaf421
grep -Fq HalesExperience "$WORK/src/App.tsx"
grep -Fq ChatInterface "$WORK/src/App.tsx"
grep -Fq hales-public-chat "$WORK/src/components/ChatInterface.tsx"
! grep -Rqs VITE_CUPCAKEGPT_KEY "$WORK/src" "$WORK/public"

(cd "$WORK" && npm ci && npx tsc --noEmit && npx eslint src/components/cupcake src/pages/cupcake/sandbox/cupcakegpt/page.tsx && npm run build)
test -f "$WORK/dist/index.html"
grep -Rqs hales-public-chat "$WORK/dist/assets"
grep -Rqs cupcake-feed "$WORK/dist/assets"
grep -Fq hales:sentinel-ready "$WORK/dist/lab/hal/index.html"

cp "$WORK/ops/Dockerfile.prebuilt" "$WORK/Dockerfile.prebuilt"
(cd "$WORK" && find dist -type f -print0 | sort -z | xargs -0 shasum -a 256 > dist.sha256)
DIST_SHA=$(shasum -a 256 "$WORK/dist.sha256" | awk '{print $1}')
cat > "$WORK/release.json" <<EOF
{"releaseCommit":"$RELEASE_COMMIT","pageSha256":"$PAGE_SHA256","distManifestSha256":"$DIST_SHA","nginxImage":"$NGINX_IMAGE"}
EOF
ARTIFACT="$WORK/hales-prebuilt-$RELEASE_COMMIT.tgz"
(cd "$WORK" && COPYFILE_DISABLE=1 tar -czf "$ARTIFACT" dist dist.sha256 release.json nginx.conf Dockerfile.prebuilt)
ARTIFACT_SHA=$(shasum -a 256 "$ARTIFACT" | awk '{print $1}')
echo "validated local release=$RELEASE_COMMIT dist_manifest=$DIST_SHA artifact=$ARTIFACT_SHA"
[[ "$APPLY" == 1 ]] || { echo "dry-run complete; add --apply to transfer and deploy"; exit 0; }

REMOTE_ARTIFACT="/var/tmp/hales-prebuilt-$RELEASE_COMMIT.tgz"
scp -q "$ARTIFACT" "$REMOTE:$REMOTE_ARTIFACT"
ssh "$REMOTE" bash -s -- "$REMOTE_ARTIFACT" "$ARTIFACT_SHA" "$RELEASE_COMMIT" "$PAGE_SHA256" "$DIST_SHA" "$NGINX_IMAGE" <<'REMOTE_SCRIPT'
set -euo pipefail
ARTIFACT=$1; ARTIFACT_SHA=$2; COMMIT=$3; PAGE_SHA=$4; DIST_SHA=$5; NGINX_IMAGE=$6
APP=hales-ai-website; CANDIDATE="${APP}:prebuilt-${COMMIT:0:12}"; CNAME="${APP}-candidate-${COMMIT:0:12}-$$"
WORK=$(mktemp -d /var/tmp/hales-prebuilt.XXXXXX)
OWN_CANDIDATE=0
cleanup(){ if [[ "$OWN_CANDIDATE" == 1 ]]; then docker rm -f "$CNAME" >/dev/null 2>&1 || true; fi; python3 - "$WORK" "$ARTIFACT" <<'PY'
import os,shutil,sys
shutil.rmtree(sys.argv[1],ignore_errors=True)
try: os.unlink(sys.argv[2])
except FileNotFoundError: pass
PY
}
trap cleanup EXIT
exec 9>/var/lock/hales-ai-prebuilt-deploy.lock
flock -n 9 || { echo "another website deployment is active"; exit 1; }
docker inspect "$CNAME" >/dev/null 2>&1 && { echo "candidate name collision"; exit 1; }
MEM_KB=$(awk '/MemAvailable:/{print $2}' /proc/meminfo); DISK_KB=$(df -Pk /var/lib/docker | awk 'NR==2{print $4}')
(( MEM_KB >= 524288 && DISK_KB >= 1048576 )) || { echo "insufficient server headroom"; exit 1; }
# The running site is the rollback image. Prove it healthy before disturbing it.
docker inspect "$APP" >/dev/null
curl -fsS --connect-timeout 5 --max-time 20 --max-time 10 http://127.0.0.1:3000/ -o "$WORK/rollback-index.html"
curl -fsS --connect-timeout 5 --max-time 20 --max-time 10 http://127.0.0.1:3000/lab/hal/index.html -o "$WORK/rollback-hal.html"
grep -Fq hales:sentinel-ready "$WORK/rollback-hal.html"
[[ "$(sha256sum "$ARTIFACT" | awk '{print $1}')" == "$ARTIFACT_SHA" ]]
tar -xzf "$ARTIFACT" -C "$WORK" --no-same-owner
python3 - "$WORK/release.json" "$COMMIT" "$PAGE_SHA" "$DIST_SHA" "$NGINX_IMAGE" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); assert d=={'releaseCommit':sys.argv[2],'pageSha256':sys.argv[3],'distManifestSha256':sys.argv[4],'nginxImage':sys.argv[5]}
PY
(cd "$WORK" && sha256sum -c dist.sha256 >/dev/null)
[[ "$(sha256sum "$WORK/dist.sha256" | awk '{print $1}')" == "$DIST_SHA" ]]
docker image inspect "$NGINX_IMAGE" >/dev/null
OWN_CANDIDATE=1
DOCKER_BUILDKIT=0 docker build --pull=false --network=none --memory=128m --memory-swap=128m --cpu-period=100000 --cpu-quota=50000 --build-arg "NGINX_IMAGE=$NGINX_IMAGE" -f "$WORK/Dockerfile.prebuilt" -t "$CANDIDATE" "$WORK"
docker run -d --name "$CNAME" --memory=128m --cpus=.5 -p 127.0.0.1:3001:3000 "$CANDIDATE" >/dev/null
for _ in 1 2 3 4 5 6; do curl -fsS --connect-timeout 5 --max-time 20 http://127.0.0.1:3001/ -o "$WORK/candidate-index.html" && break; sleep 2; done
curl -fsS --connect-timeout 5 --max-time 20 http://127.0.0.1:3001/lab/hal/index.html -o "$WORK/candidate-hal.html"
grep -Fq hales:sentinel-ready "$WORK/candidate-hal.html"
curl -fsS --connect-timeout 5 --max-time 20 http://127.0.0.1:3001/cupcake -o "$WORK/candidate-cupcake.html"
docker rm -f "$CNAME" >/dev/null
OWN_CANDIDATE=0
PREV=$(docker inspect "$APP" --format '{{.Image}}')
ROLLBACK="${APP}:rollback-$(date -u +%Y%m%dT%H%M%SZ)"; docker tag "$PREV" "$ROLLBACK"
docker rm -f "$APP" >/dev/null
if ! docker run -d --name "$APP" --restart always -p 3000:3000 "$CANDIDATE" >/dev/null \
 || ! curl -fsS --connect-timeout 5 --max-time 20 --retry 6 --retry-delay 2 http://127.0.0.1:3000/lab/hal/index.html -o "$WORK/live-hal.html" \
 || ! grep -Fq hales:sentinel-ready "$WORK/live-hal.html" \
 || ! curl -fsS --connect-timeout 5 --max-time 20 --retry 3 https://hales.ai/cupcake -o "$WORK/live-cupcake.html"; then
  docker rm -f "$APP" >/dev/null 2>&1 || true
  docker run -d --name "$APP" --restart always -p 3000:3000 "$ROLLBACK" >/dev/null
  curl -fsS --connect-timeout 5 --max-time 20 --retry 6 --retry-delay 2 http://127.0.0.1:3000/lab/hal/index.html -o "$WORK/restored-hal.html"
  grep -Fq hales:sentinel-ready "$WORK/restored-hal.html" || echo "CRITICAL: rollback container did not pass HAL smoke"
  exit 1
fi
docker tag "$CANDIDATE" "$APP"
echo "deployed prebuilt release $COMMIT rollback=$ROLLBACK"
REMOTE_SCRIPT
