# MyTrader (הטרייד שלי)

Investment simulator: Next.js 14, TypeScript, Tailwind, Framer Motion, Recharts, Zustand, decimal.js.

## Run
```
npm install
npm run dev
```
Open http://localhost:3000. Copy `.env.example` to `.env.local` to add keys.

## Real prices (free)
Create a Tiingo account, copy the token into `TIINGO_API_KEY`. Without it the app uses sample prices.

## Accounts and sync across devices (free)
1. Create a project at https://supabase.com.
2. SQL editor: run `supabase/schema.sql`.
3. Project Settings > API: copy the URL and anon key into `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (locally and in Vercel).
4. Authentication > Providers > Email: turn off "Confirm email" for instant sign-up, or keep it on and confirm via email.
Profiles then save to your account and update on every device you sign in on (changes appear within about 20 seconds or when you return to the tab).

## Deploy
Push to GitHub, import in Vercel, add the environment variables above.

## Auto-invest while the app is closed
Rules from Tools > Automation also run on the server every weekday (14:00 UTC, see `vercel.json`) for signed-in users. In Vercel add `SUPABASE_SERVICE_ROLE_KEY` and a long random `CRON_SECRET`, then redeploy. Rules skip a run when the profile lacks cash.
