"""Read-only RiskHot MCP server, compatible with MCP Python SDK v2."""

import os
from pathlib import Path

from mcp.server import MCPServer
from mcp.types import ToolAnnotations

from catalog import Catalog

ROOT = os.getenv("RISK_HOT_ROOT")
if not ROOT:
    raise SystemExit("Please set RISK_HOT_ROOT to your RiskHot project directory")

catalog = Catalog(Path(ROOT))
mcp = MCPServer("RiskHot Knowledge")
READ_ONLY = ToolAnnotations(read_only_hint=True, open_world_hint=False)


@mcp.tool(annotations=READ_ONLY)
def project_manifest() -> dict:
    """Discover the current RiskHot project structure, file types, and search coverage."""
    return catalog.manifest()


@mcp.tool(annotations=READ_ONLY)
def list_project_files(prefix: str = "", limit: int = 100) -> dict:
    """List files under an optional RiskHot-relative directory or path."""
    return catalog.list_files(prefix, limit)


@mcp.tool(annotations=READ_ONLY)
def search_project(query: str, limit: int = 20) -> dict:
    """Search live RiskHot text files by a literal term; return source paths and line numbers."""
    return catalog.search(query, limit)


@mcp.tool(annotations=READ_ONLY)
def read_project_file(path: str, start_line: int = 1, max_lines: int = 120) -> dict:
    """Read a bounded section of a RiskHot file, with source line numbers."""
    return catalog.read_file(path, start_line, max_lines)


@mcp.tool(annotations=READ_ONLY)
def document_outline(path: str) -> dict:
    """Read the Markdown heading outline of a project document."""
    return catalog.outline(path)


@mcp.tool(annotations=READ_ONLY)
def changed_project_files(since_iso: str, limit: int = 100) -> dict:
    """List RiskHot files modified after an ISO-8601 timestamp with a timezone offset."""
    return catalog.changes_since(since_iso, limit)


if __name__ == "__main__":
    host = os.getenv("RISK_HOT_HOST", "127.0.0.1")
    if host != "127.0.0.1":
        raise SystemExit("This private starter binds only to 127.0.0.1 for safety")
    port = int(os.getenv("RISK_HOT_PORT", "8765"))
    print(f"RiskHot MCP on http://127.0.0.1:{port}/mcp", flush=True)
    mcp.run(
        transport="streamable-http",
        host=host,
        port=port,
        stateless_http=True,
        json_response=True,
    )
