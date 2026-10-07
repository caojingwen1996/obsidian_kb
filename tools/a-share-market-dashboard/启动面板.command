#!/bin/bash

fail() {
  printf '%s\n' "$1" >&2
  if [ -t 0 ]; then
    read -r -p '按回车键退出……' _reply
  fi
  exit 1
}

cd -- "$(dirname -- "$0")" || fail '无法进入面板目录。'

# Finder 启动的终端可能没有加载 Homebrew 的 PATH。
export PATH="${PATH:-/usr/bin:/bin}:/opt/homebrew/bin:/usr/local/bin"
runtime_root="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
dashboard_node="$(command -v node)"
if [ -z "$dashboard_node" ] && [ -x "$runtime_root/node/bin/node" ]; then
  dashboard_node="$runtime_root/node/bin/node"
fi
[ -n "$dashboard_node" ] || fail '未找到 Node.js，请先安装 Node.js 后重试。'

dashboard_python="$(command -v python3)"
if [ -z "$dashboard_python" ] && [ -x "$runtime_root/python/bin/python3" ]; then
  dashboard_python="$runtime_root/python/bin/python3"
fi
[ -n "$dashboard_python" ] || fail '未找到 Python 3，请先安装 Python 3 后重试。'
"$dashboard_python" -c 'import sys; sys.exit(0 if sys.version_info.major == 3 else 1)' \
  || fail 'Python 3 无法运行，请检查安装。'

printf '%s\n' '正在重新构建大盘面板……'
"$dashboard_node" scripts/build.mjs \
  || fail '大盘面板构建失败，已停止启动，避免打开旧看板。'
printf '%s\n' '构建完成，正在启动本地服务；按 Ctrl+C 停止。'
"$dashboard_python" -u scripts/local_proxy.py
status=$?
if [ "$status" -ne 0 ] && [ "$status" -ne 130 ]; then
  fail "本地服务异常退出（退出码 $status），请查看上方错误。"
fi
