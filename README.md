# TapNova Talab

Standalone QR/NFC restaurant menu and ordering platform.

## Stack
- Vercel serverless API and static frontend
- Neon PostgreSQL
- Arabic/French public menu
- Admin dashboard for products, categories, tables, orders and service requests

## Required Vercel environment variables
- `DATABASE_URL`: Neon PostgreSQL connection string
- `ADMIN_KEY`: long random admin access key

Set both for Production, Preview and Development, then redeploy.

## Routes
- `/` public menu (query: `?slug=restaurant-slug`)
- `/admin` restaurant dashboard
- `/api/health` database health check
- `/api/menu?slug=...` public menu API
- `/api/admin` protected management API

The database must contain the TapNova Talab schema tables: restaurants, users, restaurant_members, categories, products, dining_tables, orders, order_items and service_requests.

This repository is separate from the older TapNova_menu project.
