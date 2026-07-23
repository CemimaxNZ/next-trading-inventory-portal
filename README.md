# Next Trading Inventory Management Portal

Internal inventory management portal built with Next.js 15 App Router, TypeScript, Tailwind CSS, and Supabase.

## Features

- Login-protected internal portal with Supabase Authentication
- Role-based access for `admin`, `operator`, and `viewer`
- Dashboard with inventory and operations summary cards
- Product catalog with low-stock monitoring
- Purchase order workflow with automatic stock updates on arrival
- Shipment workflow with automatic in-transit to on-hand stock movement
- Inventory transaction ledger for every stock movement
- Manual stock adjustment flow for admins and operators
- User management tools for admins
- Seed SQL for a working demo dataset

## Project structure

- `src/app`: Next.js routes, layouts, and server actions
- `src/components`: portal UI building blocks
- `src/lib`: Supabase helpers, auth guards, types, and utilities
- `supabase/schema.sql`: database schema, RLS, functions, and triggers
- `supabase/seed.sql`: sample business data

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project and enable Email authentication.

3. Copy `.env.example` to `.env.local` and add:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

4. In the Supabase SQL editor, run:

   1. `supabase/schema.sql`
   2. `supabase/shipment-status-and-optional-fields.sql`
   3. `supabase/shipment-etd-and-multi-po.sql`
   4. `supabase/seed.sql`

5. Create your first auth user in Supabase Authentication.

6. Promote that user to admin by running this SQL with the real user email:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'admin@nexttrading.local';
   ```

7. Start the app:

   ```bash
   npm run dev
   ```

   The local portal will run on `http://127.0.0.1:3456`.

8. Sign in with the user you created.

## Notes

- All portal routes require login through middleware and server-side guards.
- The `SUPABASE_SERVICE_ROLE_KEY` is used only for admin-only user management actions on the server.
- Shipments support ETD, ETA, status, and linking multiple purchase orders in one container.
- Operators can adjust stock and update shipment / purchase order statuses, but cannot manage users or delete products.
- Product creation and editing are restricted to admins in this implementation.

## Recommended deployment workflow

Use GitHub + Vercel automatic deployment for the smoothest updates.

### One-time repository setup

This project includes a `repo-git` helper so the project can behave like its own repository even when it lives inside a larger local folder structure.

1. Initialize the local repository metadata if needed:

   ```bash
   ./repo-git status
   ```

2. Add the GitHub remote:

   ```bash
   ./repo-git remote add origin https://github.com/CemimaxNZ/next-trading-inventory-portal.git
   ```

3. Create the first commit:

   ```bash
   ./repo-git add .
   ./repo-git commit -m "Initial portal setup"
   ```

4. Push to GitHub:

   ```bash
   ./repo-git branch -M main
   ./repo-git push -u origin main
   ```

5. In Vercel, import `CemimaxNZ/next-trading-inventory-portal` and keep the existing environment variables.

### Future updates

After the one-time setup above, the update flow becomes:

```bash
./repo-git add .
./repo-git commit -m "Describe the change"
./repo-git push
```

Pushing to GitHub will trigger a new Vercel deployment automatically.
