# Supabase launch setup

The application code is connected to the Vercel-managed Supabase project. Vercel marks Marketplace credentials as sensitive, so the first database migration must be run in the authenticated dashboard.

1. In Vercel, open **Storage → surgical-society-pecs → Query**.
2. Paste the complete contents of `supabase/migrations/202607270001_initial_academy.sql` and run it once.
3. Open the connected Supabase dashboard and go to **Authentication → Users**.
4. Add the one administrator account with your own email and a strong password, then confirm the email.
5. Return to the Query editor and run:

   ```sql
   select public.bootstrap_first_admin('YOUR-EMAIL-ADDRESS');
   ```

6. Log into the website through the **Staff** area. The Administration page will now be visible. Create the first student event code and demonstrator codes there.

Before publishing, set the Supabase **Site URL** and **Redirect URLs** to the final Vercel domain. Enable MFA for the administrator and demonstrators. A custom SMTP provider is optional for the first demonstration but recommended before real student onboarding.

Never place `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or Postgres URLs in browser code. They are used only by server routes in this project.

The production deployment also requires a strong random `CRON_SECRET`. Vercel sends it as a bearer token when invoking the daily six-month retention job. Mark `CRON_SECRET`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, and database credentials as sensitive environment variables and never prefix them with `NEXT_PUBLIC_`.
