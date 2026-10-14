# RiskHot Knowledge Plugin — read-only starter

This starter supplies a **local read-only MCP server** and a **portable plugin skill** for ChatGPT/Codex. It contains **no actual RiskHot project files** and does not connect itself to a ChatGPT account. The provided MCP server has no write/delete tools.

## Prerequisites

- Mac with Python 3.11+ and npm/npx for the optional MCP Inspector
- Local RiskHot materials, e.g. `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot`
- A supported ChatGPT account/surface and permission to create a custom MCP connection
- A **Secure MCP Tunnel** or independently secured HTTPS + OAuth endpoint to connect ChatGPT to the private server

## 1. Start the local MCP server

```bash
cd riskhot-knowledge-plugin/server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export RISK_HOT_ROOT='/Users/cjw/dev/Obsidian/wiki/tools/RiskHot'
python server.py
```

The server binds only to `127.0.0.1:8765` and serves MCP on `http://127.0.0.1:8765/mcp`. It inspects files **on each request**, so Markdown changes are available without repacking the plugin. Your Mac and MCP server must remain running for live access.

## 2. Test locally before connecting ChatGPT

In another terminal, run:

```bash
npx @modelcontextprotocol/inspector@latest
```

Select **Streamable HTTP**, enter `http://127.0.0.1:8765/mcp`, and test these tools:

- `project_manifest()` — counts, types, coverage
- `list_project_files(prefix="02-业务架构与领域设计", limit=100)` — directory discovery
- `search_project(query="风险变量")` — literal text lookup
- `read_project_file(path="02-业务架构与领域设计/your-file.md", start_line=1, max_lines=120)` — evidence with line numbers
- `document_outline(path="02-业务架构与领域设计/your-file.md")` — Markdown headings
- `changed_project_files(since_iso="2026-10-01T00:00:00+08:00")` — modified files

## 3. Connect from ChatGPT

ChatGPT web cannot directly reach a loopback/stdio MCP server on your Mac. **Do not simply expose port 8765 to the internet**, because the starter has no user authentication.

Recommended: follow the official **Secure MCP Tunnel** setup instructions for the developer machine/private server:

- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- https://developers.openai.com/api/docs/guides/custom-mcp-server

In ChatGPT **Plugins → + → Add custom MCP server → Tunnel**, select the configured tunnel, set the supported authorization policy, and register/install the resulting personal plugin. For substantial multi-document tasks, use a supported ChatGPT Work surface. Availability varies by plan and environment; as of October 2026, Pro's custom MCP permissions are read/fetch-focused.

If you later deploy your own **authenticated** public HTTPS MCP server, copy `mcp.json.example` to `mcp.json` and substitute the stable URL. Register the plugin / use the plugin-creator workflow to bind the server and skill into a single installable experience. The `.example` file is deliberately not a working remote connection.

## 4. How to use it

> Use RiskHot Knowledge to inspect the complete project documentation inventory. Find all confirmed rules regarding global risk variables, read each relevant source section with line references, then derive the L1 functional architecture and flag gaps separately.

The `skills/riskhot-context/SKILL.md` file gives the AI a repeatable, source-grounded retrieval method. Bundle it into a plugin using the official plugin-creator if desired:

https://developers.openai.com/plugins/build/plugins

## Coverage and limitations

- Can enumerate regular project files, including attachments (metadata only for non-text files).
- Supports search and line-range reading for Markdown, plain text, JSON, YAML, Mermaid/PlantUML, and common source code formats.
- **Not yet supported:** extracting PDF/DOCX/Excel content, visually inspecting image assets, semantic embedding search, browser-viewable citation URLs, cross-file semantic indexing, or editing documents.
- Hidden files/directories, symlinks, `.env`, Git metadata, editor configs, and dependency folders are deliberately excluded; text files above 1 MiB are not searchable.
- Literal search is recalculated from live files and is best for small/medium design repositories. Large repositories should use SQLite FTS5 / incremental indexing.
- ChatGPT retrieves documents **on demand**; attaching the MCP server does not inject the entire project into one model context window.
- The server itself does **not** authenticate requests. Keep it loopback-only and rely on a correctly configured private tunnel; review tunnel and access policies before use. Do not publish an unauthenticated public endpoint.
- Every retrieved document is untrusted input, even though it originates in your project. Review prompt-injection risks before expanding tools to write actions.

## 5. Run catalog unit tests (no MCP install required)

```bash
python3 -m unittest discover -s tests -v
```
