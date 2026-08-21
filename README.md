

<div align="center">

<img src="apps/client/public/images/tenet_logo_draft.jpg" alt="Tenet logo" width="140" />

# Tenet

**An AI agent that resolves GitHub issues and reviews pull requests.**
Comment `/tenet-build` on an issue and it explores the repo, writes the fix, then opens a PR.

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
![Bun](https://img.shields.io/badge/Bun-1.x-000?logo=bun&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

</div>

## Demo

<div align="center">

https://github.com/user-attachments/assets/a7d8b62e-65cb-4b47-95f3-6e308fcc37a6

</div>

## How it works

Tenet runs in two modes, both triggered from GitHub:

| Mode | Trigger | What it does |
|------|---------|--------------|
| `issue_build` | Comment `/tenet-build` on an issue | Reads the issue, explores the repo with read/grep/list/write tools, commits a fix to a new branch, opens a PR, and comments the link back on the issue. |
| `pr_review` | Run a review on a PR | Posts a structured review: summary (with a haiku), file-by-file walkthrough, a Mermaid sequence diagram, and security / quality / performance / maintainability findings with severity and suggested fixes. |

You bring your own LLM key (OpenAI, Anthropic, Google, Azure, Cohere, Mistral, or
OpenRouter), and keys are stored encrypted (AES-256). Each user gets 2 runs, resetting
every 2 days.

## Architecture

Tenet is a Bun monorepo (`apps/*`) with three apps:

| App | Package | Role |
|-----|---------|------|
| `apps/agent` | `@tenet/agent` | The AI worker. Clones the repo, runs the LLM tool loop, writes PRs/reviews. Runs sandboxed in Docker on Google Cloud Run. |
| `apps/bot` | `@tenet/bot` | Probot GitHub App. Listens for issue/PR webhooks and forwards them to the client. |
| `apps/client` | (app) | React 19 + TanStack (Router/Query/Start) dashboard and landing page, with a Nitro + tRPC backend. |

```
GitHub issue  ──/tenet-build──▶  apps/bot (Probot)
                                      │
                                      ▼
                        apps/client  /api/webhook/run
                        (tRPC runAgent · quota · Prisma)
                                      │  triggers Cloud Run job
                                      ▼
                        apps/agent (Bun · Docker · sandboxed)
                          reads repo · runs LLM · Octokit
                                      │
                    opens PR / posts review comment on GitHub
                                      │  callback
                                      ▼
                        apps/client  /api/webhook/run-complete
```

**Stack:** TypeScript · Bun · Prisma + MongoDB · better-auth (GitHub OAuth) ·
Upstash Redis cache · TailwindCSS 4 + Radix UI · Octokit · LangSmith tracing ·
oxlint / oxfmt.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1
- A [MongoDB](https://www.mongodb.com/) database (Prisma datasource)
- A [GitHub App](https://docs.github.com/en/apps) (App ID + private key + OAuth credentials)
- An LLM provider API key (OpenAI, Anthropic, Google, Azure, Cohere, Mistral, or OpenRouter)
- Optional, for production: Google Cloud Run (agent execution) and Upstash Redis (caching)

## Installation

```sh
# 1. Clone and install (installs all workspaces)
git clone https://github.com/yashraj-n/tenet.git
cd tenet
bun install

# 2. Configure the agent
cp apps/agent/.env.example apps/agent/.env
# then fill in the values (see Configuration below)

# 3. Configure the client
# create apps/client/.env.local and fill in the values (see Configuration below)

# 4. Push the Prisma schema to MongoDB
cd apps/client && bun run db:push && cd ../..

# 5. Run the client (dashboard + landing) on http://localhost:3000
bun dev
```

Run the Probot listener separately when you want to receive GitHub webhooks:

```sh
cd apps/bot && bun dev
```

## Configuration

### Agent: `apps/agent/.env`

Copy [`apps/agent/.env.example`](apps/agent/.env.example) and fill in:

| Variable | Description |
|----------|-------------|
| `APP_ID` | Your GitHub App ID. |
| `WEBHOOK_SECRET` | GitHub App webhook secret (`development` for local). |
| `LOG_LEVEL` | `trace` / `debug` / `info` verbosity. |
| `WEBHOOK_PROXY_URL` | [smee.io](https://smee.io/new) URL for local webhook forwarding. |
| `LLM_PROVIDER` | `openai` \| `anthropic` \| `google` \| `azure` \| `cohere` \| `mistral` \| `openrouter`. |
| `LLM_MODEL` | Model name for the chosen provider (e.g. `gpt-5.5`). |
| `OPENROUTER_API_KEY` | Required only when `LLM_PROVIDER=openrouter`. |
| `DOCKER_SOCK_PATH` | Docker socket path (local sandbox execution). |

At runtime on Cloud Run the agent also receives per-job context (`REPO_NAME`, `ISSUE_ID`,
`PR_NUMBER`, `OWNER_NAME`, `AGENT_MODE`, `LLM_API_KEY`, `CALLBACK_URL`, `SECRET_WEBHOOK_KEY`,
`RUN_ID`, `CUSTOM_INSTRUCTIONS`) injected by the client, so you don't set these by hand.

### Client: `apps/client/.env.local`

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MongoDB connection string. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app credentials (user sign-in). |
| `APP_ID` / `PRIVATE_KEY` | GitHub App ID and private key (repo access via Octokit). |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | better-auth session secret and base URL. |
| `ENCRYPTION_SECRET` | Key used to AES-256-encrypt stored LLM API keys. |
| `SECRET_WEBHOOK_KEY` | Shared secret validating agent completion callbacks. |
| `GOOGLE_PROJECT_ID` / `GOOGLE_PROJECT_REGION` | Google Cloud project + region for Cloud Run jobs. |
| `GOOGLE_CLOUD_RUN_WORKER_NAME` | Name of the Cloud Run job that runs the agent. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account JSON used to trigger Cloud Run jobs. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis cache (issue/PR lists). |
| `TRUSTED_ORIGINS` / `SERVER_URL` | Allowed origins and public server URL. |
| `VITE_APP_TITLE` | App title shown in the UI. |

## Usage

1. Install the Tenet GitHub App on a repository.
2. Sign in to the dashboard at `http://localhost:3000` with GitHub and add your LLM
   provider key under **Settings**.
3. Open an issue describing a bug or feature, then comment **`/tenet-build`**.
4. Tenet queues a run, resolves the issue, and opens a PR. Track progress under
   **Runs** in the dashboard, or watch for the PR link comment on the issue.

## Scripts

Run from the repo root:

| Command | Description |
|---------|-------------|
| `bun dev` | Start the client (Vite dev server on :3000). |
| `bun run lint` | Lint with oxlint. |
| `bun run lint:fix` | Lint and autofix. |
| `bun run fmt` | Format with oxfmt. |
| `bun run fmt:check` | Check formatting. |

Per-app typecheck: `cd apps/agent && bun run typecheck` (or `apps/client`, `apps/bot`).

## Contributing

Issues and PRs are welcome. See the [Contributing Guide](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

[ISC](LICENSE) © 2026 Yashraj Narke
