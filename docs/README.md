# mcp-hub Documentation

> Son güncelleme: 2026-06-26 — yerel V5/V6 + remote infra merge

Bu klasör, platform durumu, strateji yolları ve operasyonel rehberleri tek yerde toplar.

## Platform değerlendirme (yerel)

| Dosya | İçerik |
|-------|--------|
| [assessment.md](./assessment.md) | Genel platform değerlendirmesi + harici yorumun cevabı |
| [architecture.md](./architecture.md) | Mimari özet, request flow, çift-stack problemi |
| [technical-debt.md](./technical-debt.md) | Teknik borç envanteri |
| [security.md](./security.md) | Güvenlik denetimi bulguları |
| [testing.md](./testing.md) | Test/CI durumu, exclude listesi, kapsam boşlukları |
| [plugins.md](./plugins.md) | 35 plugin uyumluluk matrisi (auth, meta, health) |
| [configuration.md](./configuration.md) | Config, env değişkenleri, auth/open mode, production checklist |
| [roadmap.md](./roadmap.md) | **Yol haritası** — 6 faz, zaman çizelgesi, exit gate'ler |
| [**v3-path/**](./v3-path/README.md) | **V3** — güvenli agent execution platformu |
| [**v4-path/**](./v4-path/README.md) | **V4** — premium AI engineering agent |
| [**v5-path/**](./v5-path/README.md) | **V5** — managed autonomous operations |
| [**v6-path/**](./v6-path/README.md) | **V6** — agent ekosistemi (multi-agent, skill store, enterprise) |
| [**v7-path/**](./v7-path/README.md) | **V7** — personal AI operating system |
| [manual-test-pack.md](./manual-test-pack.md) | CI dışı integration testler — release checklist |

## Getting Started

| Document | Description |
|----------|-------------|
| [Quick Start](../README.md#hızlı-başlangıç) | Install and run MCP-Hub |
| [Local Setup](../mcp-server/LOCAL_SETUP.md) | Detailed local development setup |
| [Environment Variables](../mcp-server/docs/environment-variables.md) | All configuration options |
| [Minimal Local Setup](examples/minimal-local-setup.md) | Smallest config for local dev |
| [RAG Ingestion Example](examples/rag-ingestion-workflow.md) | Document indexing workflow |
| [Code Intelligence Example](examples/code-intelligence-workflow.md) | Code review and repo analysis |

## Architecture & Features

| Document | Description |
|----------|-------------|
| [Architecture Overview](../mcp-server/ARCHITECTURE.md) | System design and components |
| [Plugin SDK](../mcp-server/docs/plugin-sdk.md) | SDK utilities and best practices |
| [Plugin Development](../mcp-server/docs/plugin-development.md) | How to build plugins |
| [Workspace Security](../mcp-server/docs/workspace-security-model.md) | Multi-workspace isolation |
| [RAG Ingestion](rag-ingestion.md) | Document ingestion pipeline |
| [Retrieval Evaluation](retrieval-evals.md) | RAG quality evaluation |
| [Jobs](../docs/jobs.md) | Async job queue |
| [Tools](../docs/tools.md) | MCP tool registry |
| [Observability](../docs/observability.md) | Metrics, tracing, and monitoring |

## Security & Integrations

| Document | Description |
|----------|-------------|
| [Security Model](../docs/security-model.md) | Auth, policy, and safety |
| [Transport Security](../docs/transport-security.md) | HTTPS and auth |
| [Cursor Setup](../mcp-server/docs/cursor-setup.md) | Cursor IDE integration |
| [Claude Desktop](../mcp-server/CLAUDE_DESKTOP_SETUP.md) | Claude Desktop config |
| [MCP Client Config](../mcp-server/docs/mcp-client-config.md) | MCP protocol setup |

## Contributing

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | How to contribute |
| [Changelog](../CHANGELOG.md) | Release history |
| [Release Process](RELEASE.md) | Versioning and release checklist |
| [Open-Source Readiness](OPEN-SOURCE-READINESS.md) | Pre-release checklist |
