#!/bin/bash
# RiskHot MCP Server + OpenAI Secure MCP Tunnel (macOS one-click launcher)
# macOS 自带 Bash 3.2 兼容；首次运行需要 Python3 和 tunnel-client。
# 放置位置：riskhot-knowledge-plugin/riskhot-tunnel.command（与 server/ 同级）。
# 运行方式：bash riskhot-tunnel.command [--configure|--reset|--check|--no-open]

set -euo pipefail
set +x
umask 077
export PATH="${PATH}:/opt/homebrew/bin:/usr/local/bin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# 将秘钥与项目代码分开存放，避免意外提交到 Git/Obsidian。
CREDENTIALS_FILE="${RISK_HOT_TUNNEL_CONFIG_FILE:-${XDG_CONFIG_HOME:-$HOME/.config}/riskhot/tunnel.env}"
CONFIGURE_ONLY=0
PROFILE="riskhot-local"
PROFILE_DIR="${TUNNEL_CLIENT_PROFILE_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/tunnel-client}"
PROFILE_FILE="${PROFILE_DIR}/${PROFILE}.yaml"
MCP_URL="${RISK_HOT_MCP_URL:-http://127.0.0.1:8765/mcp}"
HEALTH_PORT="${RISK_HOT_HEALTH_PORT:-8080}"
HEALTH_URL="http://127.0.0.1:${HEALTH_PORT}"
RISK_HOT_ROOT="${RISK_HOT_ROOT:-/Users/cjw/dev/Obsidian/wiki/tools/RiskHot}"
LOG_DIR="${HOME}/Library/Logs/RiskHot"
SERVER_DIR=""
VENV_DIR=""
MCP_PID=""
TUNNEL_PID=""
MCP_LOG=""
TUNNEL_LOG=""
RESET=0
CHECK_ONLY=0
OPEN_UI=1

usage() {
  cat <<'HELP'
用法：
  bash riskhot-tunnel.command            自动启动 MCP + Tunnel
  bash riskhot-tunnel.command --configure  首次输入并保存 Tunnel ID/API Key
  bash riskhot-tunnel.command --check    检查 MCP 和 Tunnel 状态（不启动）
  bash riskhot-tunnel.command --reset    备份并重新初始化 Tunnel 配置
  bash riskhot-tunnel.command --no-open  不自动打开管理页面

建议将文件放在 riskhot-knowledge-plugin/ 目录（与 server/ 同级）。
首次使用自动创建 server/.venv，安装 server/requirements.txt。

可选环境变量：
  RISK_HOT_ROOT             RiskHot 资料目录
  RISK_HOT_MCP_SERVER_DIR   包含 server.py 与 requirements.txt 的目录
  RISK_HOT_VENV_DIR         Python 虚拟环境目录，默认 server/.venv
  RISK_HOT_MCP_URL          默认 http://127.0.0.1:8765/mcp
  RISK_HOT_HEALTH_PORT      Tunnel 本地管理端口，默认 8080
  RISK_HOT_TUNNEL_CONFIG_FILE  自定义凭据配置文件路径

凭据文件（默认 ~/.config/riskhot/tunnel.env）：
  TUNNEL_ID=tunnel_xxx
  API_KEY=sk-xxx
文件仅当前用户可读写（chmod 600），存储明文秘钥，请勿上传或提交 Git。

注意：脚本退出时只关闭由本次脚本启动的进程，不终止已存在的 MCP 服务。
HELP
}

for arg in "$@"; do
  case "$arg" in
    --configure) CONFIGURE_ONLY=1 ;;
    --reset) RESET=1 ;;
    --check) CHECK_ONLY=1 ;;
    --no-open) OPEN_UI=0 ;;
    -h|--help) usage; exit 0 ;;
    *) printf '未知参数：%s\n' "$arg" >&2; usage >&2; exit 2 ;;
  esac
done

say()  { printf '\n▶ %s\n' "$*"; }
warn() { printf '⚠ %s\n' "$*" >&2; }
fail() { printf '\n✖ %s\n' "$*" >&2; exit 1; }

# 安全读取纯 KEY=VALUE 文件；不执行 source/eval，防止配置文件执行任意命令。
load_credentials() {
  local line key value
  RISK_HOT_TUNNEL_ID=""
  CONTROL_PLANE_API_KEY=""
  [[ -f "${CREDENTIALS_FILE}" ]] || fail "凭据文件不存在：${CREDENTIALS_FILE}。请先运行 bash riskhot-tunnel.command --configure"
  [[ ! -L "${CREDENTIALS_FILE}" ]] || fail '凭据文件禁止使用符号链接。'
  [[ -O "${CREDENTIALS_FILE}" ]] || fail "凭据文件必须属于当前用户：${CREDENTIALS_FILE}"
  # chmod 修正意外过宽的权限；若系统禁止调整则拒绝继续使用。
  chmod 600 "${CREDENTIALS_FILE}" || fail "无法保护凭据文件权限：${CREDENTIALS_FILE}"

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    case "${line}" in
      ''|\#*) continue ;;
      *=*) key="${line%%=*}"; value="${line#*=}" ;;
      *) fail "凭据文件格式无效，请使用 KEY=VALUE：${CREDENTIALS_FILE}" ;;
    esac
    case "${key}" in
      TUNNEL_ID) RISK_HOT_TUNNEL_ID="${value}" ;;
      API_KEY) CONTROL_PLANE_API_KEY="${value}" ;;
      *) fail "凭据文件出现未知字段：${key}（仅支持 TUNNEL_ID 和 API_KEY）" ;;
    esac
  done < "${CREDENTIALS_FILE}"

  [[ "${RISK_HOT_TUNNEL_ID}" =~ ^tunnel_[A-Za-z0-9_-]+$ ]] || fail "配置的 Tunnel ID 格式不正确：${CREDENTIALS_FILE}"
  [[ -n "${CONTROL_PLANE_API_KEY}" ]] || fail "配置文件中 API_KEY 为空：${CREDENTIALS_FILE}"
  [[ "${CONTROL_PLANE_API_KEY}" != *[[:space:]]* ]] || fail 'API_KEY 不应含有空白字符，请检查是否复制了空格或引号。'
  export CONTROL_PLANE_API_KEY
}

configure_credentials() {
  local id key tmp config_dir
  [[ -t 0 ]] || fail '配置凭据需要交互式终端。'
  config_dir="$(dirname "${CREDENTIALS_FILE}")"
  mkdir -p "${config_dir}" || fail "无法建立配置目录：${config_dir}"
  chmod 700 "${config_dir}" || fail "无法限制配置目录权限：${config_dir}"
  [[ ! -L "${CREDENTIALS_FILE}" ]] || fail '凭据文件禁止使用符号链接。'
  if [[ -e "${CREDENTIALS_FILE}" && ! -O "${CREDENTIALS_FILE}" ]]; then
    fail '已有凭据文件属于其他用户，已拒绝覆盖。'
  fi
  say '配置 RiskHot Tunnel 凭据（仅需首次操作，或更换密钥时操作）'
  printf '请输入 Tunnel ID（tunnel_...）：'
  IFS= read -r id || fail '读取 Tunnel ID 失败。'
  [[ "${id}" =~ ^tunnel_[A-Za-z0-9_-]+$ ]] || fail 'Tunnel ID 格式有误。'
  printf '请输入 Runtime API Key（输入内容不回显）：'
  IFS= read -rs key || fail '读取 API Key 失败。'
  printf '\n'
  [[ -n "${key}" && "${key}" != *[[:space:]]* ]] || fail 'API Key 不能为空或包含空白字符。'
  tmp="$(mktemp "${config_dir}/.tunnel.env.tmp.XXXXXX")" || fail '无法创建临时凭据文件。'
  chmod 600 "${tmp}" || { rm -f "${tmp}"; fail '无法保护临时凭据文件。'; }
  if ! printf 'TUNNEL_ID=%s\nAPI_KEY=%s\n' "${id}" "${key}" >"${tmp}"; then
    rm -f "${tmp}"
    fail '保存凭据文件失败。'
  fi
  mv -f "${tmp}" "${CREDENTIALS_FILE}" || { rm -f "${tmp}"; fail '保存凭据文件失败。'; }
  chmod 600 "${CREDENTIALS_FILE}" || fail '无法设置凭据权限。'
  unset key
  printf '✔ 凭据已保存：%s（仅当前用户可读写）\n' "${CREDENTIALS_FILE}"
  printf '  如修改了 Tunnel ID，请下次运行 bash riskhot-tunnel.command --reset\n'
}

cleanup() {
  local code=$?
  trap - EXIT INT TERM HUP
  if [[ -n "${TUNNEL_PID}" ]] && kill -0 "${TUNNEL_PID}" 2>/dev/null; then
    say '正在关闭本次启动的 Tunnel……'
    kill -TERM "${TUNNEL_PID}" 2>/dev/null || true
    wait "${TUNNEL_PID}" 2>/dev/null || true
  fi
  if [[ -n "${MCP_PID}" ]] && kill -0 "${MCP_PID}" 2>/dev/null; then
    say '正在关闭本次启动的 RiskHot MCP Server……'
    kill -TERM "${MCP_PID}" 2>/dev/null || true
    wait "${MCP_PID}" 2>/dev/null || true
  fi
  unset CONTROL_PLANE_API_KEY
  if [[ "${code}" -ne 0 && "${code}" -ne 129 && "${code}" -ne 130 && "${code}" -ne 143 ]]; then
    [[ -z "${MCP_LOG}" ]] || warn "MCP 日志：${MCP_LOG}"
    [[ -z "${TUNNEL_LOG}" ]] || warn "Tunnel 日志：${TUNNEL_LOG}"
    if [[ -t 0 ]]; then
      printf '\n按回车键关闭窗口……'
      IFS= read -r _unused || true
    fi
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

if [[ "${CONFIGURE_ONLY}" -eq 1 ]]; then
  [[ "${RESET}" -eq 0 && "${CHECK_ONLY}" -eq 0 ]] || fail '--configure 不能与 --reset 或 --check 同时使用。'
  configure_credentials
  exit 0
fi

# 禁止其他 shell 中的 Tunnel 配置覆盖本脚本的 profile 选择。
unset TUNNEL_CLIENT_CONFIG TUNNEL_CLIENT_PROFILE TUNNEL_CLIENT_PROFILE_FILE
export TUNNEL_CLIENT_PROFILE_DIR="${PROFILE_DIR}"

command -v curl >/dev/null 2>&1 || fail '找不到 curl。'
[[ "${HEALTH_PORT}" =~ ^[0-9]+$ ]] || fail 'RISK_HOT_HEALTH_PORT 必须是数字。'
(( 10#${HEALTH_PORT} >= 1 && 10#${HEALTH_PORT} <= 65535 )) || fail 'Tunnel 管理端口超出合法范围。'

# 此脚本会管理本地的 Python MCP 服务，只接受 127.0.0.1 地址。
if [[ "${MCP_URL}" =~ ^http://127\.0\.0\.1:([0-9]+)/mcp/?$ ]]; then
  MCP_PORT="${BASH_REMATCH[1]}"
else
  fail "MCP 地址需使用 http://127.0.0.1:<端口>/mcp，当前值：${MCP_URL}"
fi
(( 10#${MCP_PORT} >= 1 && 10#${MCP_PORT} <= 65535 )) || fail 'MCP 服务端口超出合法范围。'
[[ "${HEALTH_PORT}" != "${MCP_PORT}" ]] || fail 'Tunnel 管理端口不能与 MCP 服务端口相同。'

# curl 返回的 HTTP 状态；400/405 等通常表示 MCP 端点存在但请求不是合法 JSON-RPC。
MCP_HTTP_CODE="000"
probe_mcp() {
  MCP_HTTP_CODE="$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 2 --max-time 4 -X POST \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    --data '{}' "${MCP_URL}" 2>/dev/null)" || MCP_HTTP_CODE="000"
  case "${MCP_HTTP_CODE}" in
    200|202|400|405|406|415|422) return 0 ;;
    *) return 1 ;;
  esac
}

check_tunnel() {
  local failed=0
  local code=""
  say "检查 Tunnel 健康状态：${HEALTH_URL}/healthz"
  code="$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 2 --max-time 5 "${HEALTH_URL}/healthz" 2>/dev/null)" || code="000"
  if [[ "${code}" == '200' ]]; then printf '✔ Health: HTTP 200\n'; else warn "Health 未通过（HTTP ${code}）"; failed=1; fi
  say "检查 Tunnel 就绪状态：${HEALTH_URL}/readyz"
  code="$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 2 --max-time 5 "${HEALTH_URL}/readyz" 2>/dev/null)" || code="000"
  if [[ "${code}" == '200' ]]; then printf '✔ Ready: HTTP 200\n'; else warn "Ready 未通过（HTTP ${code}）"; failed=1; fi
  printf '管理页面：%s/ui\n' "${HEALTH_URL}"
  return "${failed}"
}

if [[ "${CHECK_ONLY}" -eq 1 ]]; then
  say '检查 RiskHot MCP Server'
  MCP_CHECK_OK=1
  if probe_mcp; then
    printf '✔ MCP 可访问：%s（HTTP %s）\n' "${MCP_URL}" "${MCP_HTTP_CODE}"
  else
    warn "MCP 不可访问：${MCP_URL}（HTTP ${MCP_HTTP_CODE}）"
    MCP_CHECK_OK=0
  fi
  TUNNEL_CHECK_OK=1
  check_tunnel || TUNNEL_CHECK_OK=0
  if [[ "${MCP_CHECK_OK}" -eq 1 && "${TUNNEL_CHECK_OK}" -eq 1 ]]; then exit 0; fi
  exit 1
fi

say '读取已保存的 Tunnel ID 和 API Key'
load_credentials
printf '✔ 凭据文件：%s（API Key 已隐藏）\n' "${CREDENTIALS_FILE}"

[[ "$(uname -s)" == 'Darwin' ]] || warn '当前系统并非 macOS；脚本为 macOS 设计。'
command -v tunnel-client >/dev/null 2>&1 || fail '未找到 tunnel-client。请先运行：brew install openai/tools/tunnel-client'

# 定位启动器同级的 server/；同时兼容脚本放在工程上一级目录的场景。
if [[ -n "${RISK_HOT_MCP_SERVER_DIR:-}" ]]; then
  SERVER_DIR="${RISK_HOT_MCP_SERVER_DIR}"
elif [[ -f "${SCRIPT_DIR}/server/server.py" ]]; then
  SERVER_DIR="${SCRIPT_DIR}/server"
elif [[ -f "${SCRIPT_DIR}/riskhot-knowledge-plugin/server/server.py" ]]; then
  SERVER_DIR="${SCRIPT_DIR}/riskhot-knowledge-plugin/server"
else
  fail "未找到 RiskHot MCP 代码。请把脚本放在 riskhot-knowledge-plugin 目录（与 server/ 同级），或设置 RISK_HOT_MCP_SERVER_DIR。当前脚本目录：${SCRIPT_DIR}"
fi
[[ -f "${SERVER_DIR}/server.py" ]] || fail "找不到 ${SERVER_DIR}/server.py。"
[[ -f "${SERVER_DIR}/requirements.txt" ]] || fail "找不到 ${SERVER_DIR}/requirements.txt。"
SERVER_DIR="$(cd "${SERVER_DIR}" && pwd -P)"
VENV_DIR="${RISK_HOT_VENV_DIR:-${SERVER_DIR}/.venv}"

[[ -d "${RISK_HOT_ROOT}" ]] || fail "风险资料目录不存在：${RISK_HOT_ROOT}。请设置 RISK_HOT_ROOT 为 RiskHot 项目真实路径。"
[[ -r "${RISK_HOT_ROOT}" ]] || fail "无法读取 RiskHot 资料目录：${RISK_HOT_ROOT}。"
export RISK_HOT_ROOT
export RISK_HOT_HOST='127.0.0.1'
export RISK_HOT_PORT="${MCP_PORT}"

mkdir -p "${LOG_DIR}" "${PROFILE_DIR}"
chmod 700 "${LOG_DIR}" 2>/dev/null || true

say '检查并启动 RiskHot MCP Server'
if probe_mcp; then
  printf '✔ 已有 MCP 服务在运行（HTTP %s）；继续复用。\n' "${MCP_HTTP_CODE}"
  printf '  MCP 地址：%s\n' "${MCP_URL}"
else
  # 防止其他程序占用 MCP 端口，造成重复启动和诊断混乱。
  if command -v lsof >/dev/null 2>&1 && \
    lsof -nP -iTCP:"${MCP_PORT}" -sTCP:LISTEN 2>/dev/null | grep -q .; then
    fail "端口 ${MCP_PORT} 已有进程监听，但 MCP 校验失败（HTTP ${MCP_HTTP_CODE}）。请检查对应进程和 ${MCP_URL}。"
  fi

  command -v python3 >/dev/null 2>&1 || fail '找不到 python3。先安装 Python 3。'
  VENV_PY="${VENV_DIR}/bin/python"
  if [[ ! -x "${VENV_PY}" ]]; then
    say '首次创建 RiskHot MCP Python 虚拟环境'
    python3 -m venv "${VENV_DIR}" || fail '创建 Python 虚拟环境失败。请检查 Python 3 是否支持 venv。'
  fi

  # 仅在缺少启动所需 SDK 时安装依赖；不会每次都联网下载。
  if ! "${VENV_PY}" -c 'from mcp.server import MCPServer' >/dev/null 2>&1; then
    say '安装 RiskHot MCP Python 依赖（首次运行需要联网）'
    "${VENV_PY}" -m pip install -r "${SERVER_DIR}/requirements.txt" || \
      fail '安装 Python 依赖失败。请查看 pip 错误及 requirements.txt。'
  fi

  MCP_LOG="${LOG_DIR}/mcp-$(date +%Y%m%d-%H%M%S)-$$.log"
  : > "${MCP_LOG}"
  chmod 600 "${MCP_LOG}"
  say '启动本地 RiskHot MCP Server'
  printf '  数据目录：%s\n  MCP 地址：%s\n  服务日志：%s\n' "${RISK_HOT_ROOT}" "${MCP_URL}" "${MCP_LOG}"
  (cd "${SERVER_DIR}" && exec "${VENV_PY}" "${SERVER_DIR}/server.py") >"${MCP_LOG}" 2>&1 &
  MCP_PID=$!

  MCP_READY=0
  for ((i=1; i<=30; i++)); do
    if ! kill -0 "${MCP_PID}" 2>/dev/null; then
      tail -n 35 "${MCP_LOG}" >&2 || true
      fail 'RiskHot MCP Server 启动后立即退出；请查看上述日志。'
    fi
    if probe_mcp; then MCP_READY=1; break; fi
    sleep 1
  done
  if [[ "${MCP_READY}" -ne 1 ]]; then
    tail -n 35 "${MCP_LOG}" >&2 || true
    fail "启动超时：${MCP_URL} 未就绪（HTTP ${MCP_HTTP_CODE}）。"
  fi
  printf '✔ RiskHot MCP Server 已启动（HTTP %s）\n' "${MCP_HTTP_CODE}"
fi

if [[ "${RESET}" -eq 1 && -f "${PROFILE_FILE}" ]]; then
  BACKUP="${PROFILE_FILE}.backup-$(date +%Y%m%d-%H%M%S)"
  cp -p "${PROFILE_FILE}" "${BACKUP}"
  printf '✔ 已备份旧 Tunnel 配置：%s\n' "${BACKUP}"
fi

if [[ ! -f "${PROFILE_FILE}" || "${RESET}" -eq 1 ]]; then
  say '首次初始化 / 重新配置 Tunnel'
  TUNNEL_ID="${RISK_HOT_TUNNEL_ID}"
  [[ "${TUNNEL_ID}" =~ ^tunnel_[A-Za-z0-9_-]+$ ]] || fail 'Tunnel ID 格式有误。'
  INIT_ARGS=(init --sample sample_mcp_remote_no_auth --profile "${PROFILE}" \
    --profile-dir "${PROFILE_DIR}" --tunnel-id "${TUNNEL_ID}" \
    --mcp-server-url "${MCP_URL}" --health-listen-addr "127.0.0.1:${HEALTH_PORT}")
  if [[ "${RESET}" -eq 1 ]]; then INIT_ARGS+=(--force); fi
  tunnel-client "${INIT_ARGS[@]}" || fail 'Tunnel 初始化失败。'
else
  say '复用已存在的 Tunnel 配置'
  printf '  配置文件：%s\n' "${PROFILE_FILE}"
  printf '  如果更改 MCP 端口或 Tunnel ID，请添加 --reset 参数。\n'
fi

if command -v lsof >/dev/null 2>&1 && \
  lsof -nP -iTCP:"${HEALTH_PORT}" -sTCP:LISTEN 2>/dev/null | grep -q .; then
  fail "Tunnel 管理端口 ${HEALTH_PORT} 已被占用。请停止该进程或设置 RISK_HOT_HEALTH_PORT。"
fi

say '诊断 Tunnel 连接配置'
tunnel-client doctor --profile "${PROFILE}" --explain || fail 'Tunnel 诊断未通过。请检查 API Key、Tunnel ID 和连接地址。'

TUNNEL_LOG="${LOG_DIR}/tunnel-$(date +%Y%m%d-%H%M%S)-$$.log"
: > "${TUNNEL_LOG}"
chmod 600 "${TUNNEL_LOG}"
say '启动 Secure MCP Tunnel'
tunnel-client run --profile "${PROFILE}" --health.listen-addr "127.0.0.1:${HEALTH_PORT}" >"${TUNNEL_LOG}" 2>&1 &
TUNNEL_PID=$!

HEALTH_OK=0
READY_OK=0
for ((i=1; i<=30; i++)); do
  if ! kill -0 "${TUNNEL_PID}" 2>/dev/null; then
    tail -n 35 "${TUNNEL_LOG}" >&2 || true
    fail 'Tunnel 进程提前退出，请查看上述日志。'
  fi
  hc="$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 1 --max-time 2 "${HEALTH_URL}/healthz" 2>/dev/null)" || hc="000"
  rc="$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 1 --max-time 2 "${HEALTH_URL}/readyz" 2>/dev/null)" || rc="000"
  [[ "${hc}" == '200' ]] && HEALTH_OK=1
  [[ "${rc}" == '200' ]] && READY_OK=1
  if [[ "${HEALTH_OK}" -eq 1 && "${READY_OK}" -eq 1 ]]; then break; fi
  sleep 1
done

printf '\n===== RiskHot 服务状态 =====\n'
printf 'MCP Server：%s\n' "${MCP_URL}"
[[ "${HEALTH_OK}" -eq 1 ]] && printf '✔ Tunnel /healthz: 200 OK\n' || warn 'Tunnel /healthz 未通过'
[[ "${READY_OK}" -eq 1 ]] && printf '✔ Tunnel /readyz: 200 OK\n' || warn 'Tunnel /readyz 尚未就绪'
printf '管理界面：%s/ui\n' "${HEALTH_URL}"
printf 'MCP 日志：%s\n' "${MCP_LOG:-已有 MCP 服务，无本次启动日志}"
printf 'Tunnel 日志：%s\n' "${TUNNEL_LOG}"

if [[ "${OPEN_UI}" -eq 1 ]] && command -v open >/dev/null 2>&1; then
  open "${HEALTH_URL}/ui#overview" || warn '未能自动打开管理界面，请手动访问上述地址。'
fi
printf '\n两项服务将在本窗口运行。按 Ctrl+C 停止本次启动的 Tunnel 与 MCP。\n'
if [[ "${READY_OK}" -ne 1 ]]; then
  printf '可在另一终端执行：bash "%s" --check\n' "$0"
fi
wait "${TUNNEL_PID}"
