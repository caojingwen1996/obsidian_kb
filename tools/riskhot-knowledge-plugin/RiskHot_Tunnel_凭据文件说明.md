# RiskHot Tunnel 凭据文件说明

这次更新实现了一次配置、反复读取 Tunnel ID 与 Runtime API Key。原有脚本仍负责启动 RiskHot MCP Server、初始化与启动 Tunnel、健康检查以及进程清理。

## 文件位置

更新后的启动脚本仍放在 `riskhot-knowledge-plugin/riskhot-tunnel.command`，与 `server/` 同级。

凭据文件默认存放于 Mac 当前用户目录：

`~/.config/riskhot/tunnel.env`

示例内容：

```ini
TUNNEL_ID=tunnel_此处填写实际ID
API_KEY=此处填写实际RuntimeAPIKey
```

脚本读取纯 `KEY=VALUE`，不会执行文件中的 Shell 命令。API Key 以明文形式保存，但设置文件权限 `600`、配置目录权限 `700`，因此仅当前 Mac 用户能够访问。不要把实际配置文件放进 Git 仓库或分享给其他人。

## 首次配置

先把新版 `riskhot-tunnel.command` 替换旧版，然后在项目目录执行：

```bash
bash riskhot-tunnel.command --configure
```

根据提示分别输入 `tunnel_...` 和 Runtime API Key。API Key 输入时不回显。脚本自动创建配置目录和文件。

## 后续启动

```bash
bash riskhot-tunnel.command
```

将直接读取保存的 ID 和 Key，不再逐次询问。原有 MCP Server 自动启动与 Tunnel 健康检查功能保留。

## 修改凭据

```bash
bash riskhot-tunnel.command --configure
```

如果只更新 API Key，可直接重新启动。如果修改 Tunnel ID，更新凭据后执行：

```bash
bash riskhot-tunnel.command --reset
```

`--reset` 会备份旧的 Tunnel Client 连接配置并重新初始化，以使用新的 Tunnel ID。

## 查看或手工编辑配置

```bash
nano ~/.config/riskhot/tunnel.env
```

编辑完成后确保文件权限：

```bash
chmod 600 ~/.config/riskhot/tunnel.env
```

不要把实际 Key 粘贴到聊天中。

## 其他选项

```bash
bash riskhot-tunnel.command --check       # 仅检查连接状态
bash riskhot-tunnel.command --no-open     # 启动后不弹出管理页面
```

如果希望另存位置，可以先在终端设置 `RISK_HOT_TUNNEL_CONFIG_FILE=/其他路径/tunnel.env`，然后再运行 `--configure` 与日常启动命令；该变量需在每次运行时保持相同值。

## 验证范围

本次脚本已经通过 Bash 语法检查、交互配置测试、文件权限测试、缺失凭据测试，以及模拟 MCP/Tunnel 环境下的完整启动与清理测试。真实 macOS + OpenAI Tunnel 联通仍需在你的设备上验证。
