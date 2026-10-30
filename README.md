# 🚀 Rocket

A suite of tools for F3 PAX. The first tool is a **backblast builder**: sign in, write up a
beatdown, and copy a Slack-ready backblast. Backblasts are shared with every signed-in user.

## Stack

- **[Next.js](https://nextjs.org) + TypeScript + Tailwind** for the web app
- **Postgres + [Drizzle ORM](https://orm.drizzle.team)** for the database (works with any Postgres host: Supabase, Neon, Railway, local Docker, …)
- **[Better Auth](https://www.better-auth.com)** for login (email + password to start)
- **pnpm workspaces** monorepo so new tools can be added alongside the first

## Layout

```
apps/
  web/            Next.js app (UI, auth, server actions)
packages/
  core/           Shared F3 domain types and logic (e.g. backblast formatting)
  db/             Drizzle schema, migrations and database client
```

New tools go in `apps/` (or as routes inside `apps/web`); code shared between them goes in `packages/`.

## Getting started

Requirements: Node 22+, pnpm 10+, and Docker (or any Postgres database).

```bash
pnpm install
cp .env.example .env            # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
ln -s ../../.env apps/web/.env  # let Next.js read the root .env
docker compose up -d            # local Postgres
pnpm --filter @rocket/db db:migrate
pnpm dev                        # http://localhost:3000
```

## Scripts

| Command                                | What it does                              |
| -------------------------------------- | ----------------------------------------- |
| `pnpm dev`                             | Run the web app in development            |
| `pnpm build`                           | Build everything                          |
| `pnpm lint` / `pnpm typecheck`         | Lint and type-check all packages          |
| `pnpm test`                            | Run unit tests                            |
| `pnpm format`                          | Format with Prettier                      |
| `pnpm --filter @rocket/db db:generate` | Generate a migration after schema changes |
| `pnpm --filter @rocket/db db:migrate`  | Apply migrations to `DATABASE_URL`        |
| `pnpm --filter @rocket/db db:studio`   | Browse the database in Drizzle Studio     |

## Secrets

Secrets (`DATABASE_URL`, `BETTER_AUTH_SECRET`) live only in `.env` files, which are git-ignored.
Never commit them. In production, set them as environment variables on your host.

## License

[GPL-3.0](LICENSE)
