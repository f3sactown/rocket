# 🚀 Rocket

A suite of tools for F3 PAX. The first tool is a **backblast builder**: sign in, write up a
beatdown, and copy a Slack-ready backblast. Backblasts are shared with every signed-in user.

## Stack

- **[Next.js](https://nextjs.org) + TypeScript + Tailwind** for the web app
- **[Supabase](https://supabase.com)** for the Postgres database and login (Supabase Auth)
- **pnpm workspaces** monorepo so new tools can be added alongside the first

## Layout

```
apps/
  web/            Next.js app (UI, server actions, Supabase clients)
packages/
  core/           Shared F3 domain types and logic (e.g. backblast formatting)
supabase/
  config.toml     Local Supabase settings
  migrations/     SQL migrations: tables and row-level security policies
```

New tools go in `apps/` (or as routes inside `apps/web`); code shared between them goes in `packages/`.

## Who can see what

Access rules live in the database as row-level security (`supabase/migrations`), so they hold no
matter which app or client talks to Supabase:

- Signed-out visitors can't read anything.
- Signed-in users can read every profile and backblast.
- Only a backblast's author can edit or delete it.

## Getting started

Requirements: Node 22+, pnpm 10+, and Docker (for the local Supabase stack).

```bash
pnpm install
pnpm db:start                   # starts local Supabase and applies migrations
cp .env.example apps/web/.env.local  # fill in the URL and publishable key printed by db:start
pnpm dev                        # http://localhost:3000
```

Local Supabase Studio runs at http://127.0.0.1:54323 and captured emails at http://127.0.0.1:54324.

### Hosted Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Link and push the schema: `pnpm supabase link --project-ref <ref>` then `pnpm db:push`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on your host.
4. In Authentication → URL Configuration, set the Site URL and add `<your-site>/auth/callback`
   as a redirect URL.

## Scripts

| Command                        | What it does                                        |
| ------------------------------ | --------------------------------------------------- |
| `pnpm dev`                     | Run the web app in development                      |
| `pnpm build`                   | Build everything                                    |
| `pnpm lint` / `pnpm typecheck` | Lint and type-check all packages                    |
| `pnpm test`                    | Run unit tests                                      |
| `pnpm format`                  | Format with Prettier                                |
| `pnpm db:start` / `db:stop`    | Start or stop the local Supabase stack              |
| `pnpm db:new <name>`           | Create a new migration file                         |
| `pnpm db:reset`                | Rebuild the local database from migrations          |
| `pnpm db:push`                 | Apply migrations to the linked hosted project       |
| `pnpm db:types`                | Regenerate TypeScript types from the local database |

## Moving off Supabase later

Everything is standard Postgres: `supabase db dump` (or `pg_dump`) exports the schema and data,
including users in `auth.users` with their hashed passwords. The app only talks to Supabase
through `apps/web/src/lib/supabase/` and `apps/web/src/lib/auth.ts`, which keeps a later switch
contained.

## Secrets

The URL and publishable key are designed to be public; row-level security protects the data.
Never commit or expose the **secret / service-role key** — it bypasses row-level security.
`.env` files are git-ignored.

## Versions and releases

Rocket is in **alpha** (`0.1.0-alpha.N`). Versions and the [changelog](CHANGELOG.md) are managed
automatically from commit messages; see [RELEASING.md](RELEASING.md).

## License

[GPL-3.0](LICENSE)
