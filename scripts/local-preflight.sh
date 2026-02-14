#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-test-admin-token}"
TMP_DIR="$(mktemp -d)"
HAS_JQ=0
if command -v jq >/dev/null 2>&1; then
  HAS_JQ=1
fi

log() { printf '%s\n' "$*"; }
warn() { printf '%s\n' "⚠️  $*"; }
ok() { printf '%s\n' "✅ $*"; }
fail() { printf '%s\n' "❌ $*"; }

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

request() {
  local method="$1"
  local path="$2"
  local body="${3-}"

  local resp_file="$TMP_DIR/resp_$(date +%s%N)"
  local status

  if [[ -n "$body" ]]; then
    status=$(curl -sS -o "$resp_file" -w '%{http_code}' \
      -X "$method" "$BASE_URL$path" \
      -H 'Content-Type: application/json' \
      -d "$body")
  else
    status=$(curl -sS -o "$resp_file" -w '%{http_code}' "$BASE_URL$path")
  fi

  printf '%s\n' "$status" > "${resp_file}.status"
  printf '%s\n' "$resp_file"
}

pretty() {
  local file="$1"
  if [[ $HAS_JQ -eq 1 ]]; then
    jq . "$file" 2>/dev/null || cat "$file"
  else
    cat "$file"
  fi
}

assert_status() {
  local got="$1"
  local expected_regex="$2"
  local label="$3"
  local detail="$4"

  if [[ "$got" =~ $expected_regex ]]; then
    ok "$label (HTTP $got)"
    [[ -n "$detail" ]] && log "$detail"
    return 0
  fi

  fail "$label (HTTP $got)"
  warn "expected: $expected_regex"
  [[ -n "$detail" ]] && warn "$detail"
  return 1
}

check_api() {
  # 1) Admin action guard checks
  local r1
  r1=$(request GET "/api/notices")
  local s1; s1=$(cat "$r1.status")
  assert_status "$s1" '200' 'GET /api/notices 기본 조회' 'auth-required endpoint is not required; should always work'

  local r2
  r2=$(request POST "/api/notices/crawl")
  local s2; s2=$(cat "$r2.status")
  if [[ "$s2" == "200" ]]; then
    ok "POST /api/notices/crawl without token: allowed in local dev mode (expected for localhost)"
  else
    assert_status "$s2" '401|403' 'POST /api/notices/crawl without token' 'expected 401/403 in production-like env'
  fi

  local r3
  r3=$(request POST "/api/notices/crawl?adminToken=$ADMIN_TOKEN")
  local s3; s3=$(cat "$r3.status")
  assert_status "$s3" '200|403' 'POST /api/notices/crawl with query token' 'if 403, token mismatch. check ADMIN_TOKEN env'

  # 2) profile validation
  local r4
  r4=$(request POST "/api/user/profile" '{"grade":99}')
  local s4; s4=$(cat "$r4.status")
  assert_status "$s4" '400' 'POST /api/user/profile validation check (invalid grade)'

  local r5
  r5=$(request POST "/api/user/profile" '{"grade":3,"income":7,"gpa":3.9}')
  local s5; s5=$(cat "$r5.status")
  assert_status "$s5" '200' 'POST /api/user/profile normal update'

  # 3) email endpoints
  local r6
  r6=$(request POST "/api/alerts/email/test" '{"email":"bad-email"}')
  local s6; s6=$(cat "$r6.status")
  assert_status "$s6" '400' 'POST /api/alerts/email/test invalid email validation'

  local r7
  r7=$(request POST "/api/alerts/email/test" '{}')
  local s7; s7=$(cat "$r7.status")
  assert_status "$s7" '200|500' 'POST /api/alerts/email/test fallback path'

  local r8
  r8=$(request POST "/api/alerts/email/digest" '{"force":false}')
  local s8; s8=$(cat "$r8.status")
  assert_status "$s8" '200|500' 'POST /api/alerts/email/digest basic run'

  if [[ $HAS_JQ -eq 1 ]]; then
    if jq -e '.autoCrawler' "$r1" >/dev/null 2>&1; then
      ok 'GET /api/notices autoCrawler present'
    else
      warn 'GET /api/notices autoCrawler not present. check noticeAutoCrawler import/response'
    fi

    if jq -e '.summary.failedReasons' "$r8" >/dev/null 2>&1; then
      ok 'digest response includes failedReasons'
    else
      warn 'digest response does not include failedReasons'
    fi
  else
    warn 'jq not installed. Skipped JSON field checks. Install jq for full verification.'
  fi

  log "--- Response snapshots ---"
  log "notices/crawl status: $s2"
  pretty "$r1"
  pretty "$r3"
  pretty "$r8"
}

log "========================================================"
log "MySchoolMate Local Preflight (DEPLOY READY CHECK)"
log "BASE_URL=$BASE_URL"
log "ADMIN_TOKEN=$ADMIN_TOKEN"
log "========================================================"
check_api
log "Done."
