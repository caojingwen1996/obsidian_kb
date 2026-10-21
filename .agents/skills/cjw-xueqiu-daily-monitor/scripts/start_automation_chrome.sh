#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_DIR="${XUEQIU_CHROME_PROFILE_DIR:-$SCRIPT_DIR/.xueqiu-automation-profile}"
DEFAULT_DEBUG_PORT="9333"
DEBUG_PORT="${XUEQIU_CHROME_DEBUG_PORT:-$DEFAULT_DEBUG_PORT}"
DEBUG_HOST="${XUEQIU_CHROME_DEBUG_HOST:-127.0.0.1}"
START_URL="${XUEQIU_CHROME_START_URL:-https://xueqiu.com/}"
LOG_FILE="${XUEQIU_CHROME_LOG_FILE:-$SCRIPT_DIR/.xueqiu-automation-chrome.log}"
VERSION_URL="http://${DEBUG_HOST}:${DEBUG_PORT}/json/version"
HEADLESS="${XUEQIU_CHROME_HEADLESS:-0}"

app_bundle_for_binary() {
  local chrome_bin="$1"
  case "$chrome_bin" in
    *.app/Contents/MacOS/*)
      printf '%s\n' "${chrome_bin%/Contents/MacOS/*}"
      return 0
      ;;
  esac
  return 1
}

find_chrome_path() {
  node "$SCRIPT_DIR/automation_browser.mjs" "$PROFILE_DIR"
}

if [[ "${DRY_RUN:-0}" != "1" ]] && curl -fsS --connect-timeout 1 --max-time 2 "$VERSION_URL" >/dev/null 2>&1; then
  echo "Automation Chrome already running at $VERSION_URL"
  exit 0
fi

CHROME_BIN="$(find_chrome_path)" || exit 1

CHROME_ARGS=(
  "--user-data-dir=$PROFILE_DIR"
  "--remote-debugging-port=$DEBUG_PORT"
  "--no-first-run"
  "--no-default-browser-check"
  "--disable-popup-blocking"
  "$START_URL"
)
if [[ "$HEADLESS" == "1" ]]; then
  CHROME_ARGS=("--headless=new" "--disable-background-networking" "${CHROME_ARGS[@]}")
elif [[ "$HEADLESS" != "0" ]]; then
  echo "XUEQIU_CHROME_HEADLESS must be 0 or 1." >&2
  exit 1
fi

CMD=()
if [[ "$(uname -s)" == "Darwin" && "$HEADLESS" == "0" ]]; then
  if APP_BUNDLE="$(app_bundle_for_binary "$CHROME_BIN")"; then
    CMD=(
      open
      -g -n -a
      "$APP_BUNDLE"
      --args
      "${CHROME_ARGS[@]}"
    )
  fi
fi

if [[ ${#CMD[@]} -eq 0 ]]; then
  CMD=(
    "$CHROME_BIN"
    "${CHROME_ARGS[@]}"
  )
fi

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  printf 'DRY RUN:'
  printf ' %q' "${CMD[@]}"
  printf '\n'
  exit 0
fi

mkdir -p "$PROFILE_DIR"
nohup "${CMD[@]}" >"$LOG_FILE" 2>&1 &

for _ in $(seq 1 20); do
  if curl -fsS --connect-timeout 1 --max-time 2 "$VERSION_URL" >/dev/null 2>&1; then
    echo "Automation Chrome started at $VERSION_URL"
    echo "Profile: $PROFILE_DIR"
    exit 0
  fi
  sleep 1
done

echo "Automation Chrome failed to start within timeout. Check $LOG_FILE" >&2
exit 1
