# Agent instructions for TapNova Talab

## Project scope
- This repository is the standalone TapNova Talab QR/NFC restaurant menu and ordering platform.
- Keep it separate from the older `Tapnova_menu` repository, Supabase project, and Netlify site. Do not modify or migrate those resources.
- Production app: Vercel project `tapnova-talab`, domain `https://tapnova-talab.vercel.app`.
- Database: Neon project `tapnova-talab-platform`, database `tapnova_talab`, default branch `production`.
- Stack: Node.js serverless functions on Vercel, static HTML/CSS/JS, PostgreSQL on Neon, and the existing `pg` driver.

## Required Neon workflow
1. Read the installed Neon skills before database or infrastructure work:
   - `neon` for project setup and agent workflow.
   - `neon-postgres` for SQL, schema, connections, migrations, and diagnostics.
   Official docs: https://neon.com/docs/ai/ai-agents-tools.md
2. Reuse the existing Neon project and default branch. Never create a replacement project just because a credential or environment variable is missing.
   - The committed `.neon` context file pins this repository to the existing Neon organization, project, and production branch. It contains IDs only, never credentials; do not overwrite it with another project.
3. Use the pooled Neon connection string in `DATABASE_URL` for Vercel application traffic. Use a direct/unpooled connection only for migrations and maintenance.
4. Never print, commit, log, expose, or ask the user to paste database URLs, passwords, API keys, admin codes, or other secrets. Do not retrieve decrypted Vercel environment values just to inspect them.
5. If `DATABASE_URL` is missing in Vercel, report that exact missing key and give the user a safe way to add it through Neon and Vercel. Do not invent a connection string.
6. Treat the `production` branch as live customer data. For schema changes, create a Neon development branch, test there, keep migration SQL in the repository, and request explicit approval before applying a migration to production.
7. Prefer read-only Neon diagnostics and queries first. Never drop, truncate, reset, or rewrite production data without explicit user approval.

## App architecture and routes
- `api/_db.js`: shared PostgreSQL pool and admin-key validation.
- `api/health.js`: database connectivity check at `/api/health`.
- `api/menu.js`: public menu retrieval and order creation.
- `api/service.js`: waiter/bill service requests.
- `api/admin.js`: protected restaurant, category, product, table, order, and service-request management.
- `public/index.html`: bilingual Arabic/French public menu.
- `public/admin.html`: admin dashboard.
- `/admin` rewrites to `/admin.html`; `/m/:slug` rewrites to the public menu.
- Core public tables: `restaurants`, `categories`, `products`, `dining_tables`, `orders`, `order_items`, `service_requests`. Auth-related tables may exist in the `neon_auth` schema.

## Safety and implementation rules
- Preserve the current deployment, domain, database, and schema unless a migration is necessary and approved.
- Keep secrets only in platform environment-variable stores; never add `.env` files or secrets to Git.
- Do not assume that a successful Vercel build means the database is connected. Verify `/api/health` and then test the real user flow.
- Before claiming the product is complete, verify: database health, restaurant creation, category/product creation, table QR generation, public menu loading, order submission, and admin order status updates.
- Validate and sanitize all user input; use parameterized SQL; avoid leaking internal error details to public clients.
- Public table orders and waiter/bill requests must resolve a table using its unguessable `public_token`; never accept a visible table number as proof of table access.
- Keep order status values aligned with the database constraint (`new`, `preparing`, `ready`, `delivered`, `cancelled`) and service-request statuses aligned with (`pending`, `acknowledged`, `completed`).
- Protect administrative endpoints. The current shared `ADMIN_KEY` implementation is a temporary single-admin gate, not multi-user authentication. Do not claim that user accounts or role-based access are implemented unless they are actually added and tested.
- The current product form accepts image URLs; do not claim direct image upload exists until a secure upload flow is implemented.
- Keep the UI mobile-first and support Arabic RTL and French LTR.
- Keep dependencies minimal and compatible with the Vercel Node runtime. Use pooled DB connections for serverless request traffic.

## Current known state (2026-10-30)
- Vercel latest production deployment is marked `READY`.
- Neon project and core public tables exist.
- The public business tables are currently empty; no restaurant, categories, products, tables, or orders have been seeded.
- Vercel currently has `ADMIN_KEY`, but `DATABASE_URL` was not present at the last environment-variable inventory.
- Until `DATABASE_URL` is added and `/api/health` returns `database: connected`, database-backed app functionality is not operational.
- Do not remove legacy Supabase or Telegram environment variables without first proving they are unused by every deployed route.
