# Telegram Earning Bot

Production-ready Telegram earning bot with:

- Telegraf bot flows for tasks, referrals, wallet, and withdrawals
- Express admin API and React admin dashboard in one deployable service
- Firebase Firestore transaction-safe wallet ledger
- Manual withdrawal approval flow
- Referral rewards triggered on the referred user's first completed task

## Stack

- Backend: Node.js, Express, TypeScript
- Bot: Telegraf
- Database: Firebase Firestore via Admin SDK
- Admin UI: React + Vite
- Deployment: Render, Railway, Docker, VPS

## Project Structure

```text
admin/   React admin dashboard
server/  Express API, Telegram webhook, Firestore services
shared/  Shared constants, types, formatters, validators
```

## Core Features

- Auto-register users from Telegram ID
- Reward users `₹10` per task by default
- Reward referrers `₹5` when invited users complete their first task
- Minimum withdrawal of `₹30`
- Each task can only be completed once per user
- Task verification cooldown to reduce instant abuse
- Admin task CRUD, user lookup, referral ledger, withdrawal approval and rejection
- Immutable wallet transactions for every balance mutation

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Fill in your Telegram bot values:
   `BOT_TOKEN`, `BOT_USERNAME`, `WEBHOOK_BASE_URL`, `TELEGRAM_WEBHOOK_SECRET`
3. Fill in Firebase service account values:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
4. Generate an admin password hash:

```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1], 12).then(v=>console.log(v))" "your-admin-password"
```

5. Put the hash into `ADMIN_PASSWORD_HASH`.
6. Set a long random `SESSION_SECRET`.

## Local Development

Install dependencies:

```bash
npm install
```

Run the full workspace in development mode:

```bash
npm run dev
```

Important:

- Telegram webhooks require a public HTTPS URL.
- For local bot testing, expose your local server with a tunnel such as `ngrok` or `cloudflared`, then set `WEBHOOK_BASE_URL` to that public URL.

Useful commands:

```bash
npm run typecheck
npm run test
npm run build
npm run start
```

## Firebase Notes

The app uses these top-level collections:

- `users`
- `tasks`
- `taskCompletions`
- `referrals`
- `withdrawals`
- `walletTransactions`
- `stats`

Recommended Firestore setup:

- Enable Firestore in Native mode
- Use the Admin SDK service account from the server only
- Do not expose Firebase client credentials in the admin React app

## Telegram Bot Flow

1. User sends `/start`
2. Bot creates or refreshes the Firestore user record
3. Dashboard shows balance, tasks, referral state, and withdrawal action
4. User opens a task, waits for the cooldown, and verifies completion
5. Balance is credited inside a Firestore transaction
6. If it was the user's first completed task and they were referred, the referrer gets the referral reward
7. User can request withdrawal once balance reaches the minimum

## Admin Dashboard

The admin dashboard is served by the same Express app.

Available admin capabilities:

- Password login via secure cookie session
- Create, edit, pause, and delete tasks
- Review user balances, risks, and wallet activity
- Approve or reject withdrawals
- Inspect referral reward status

## Deployment

### Render

1. Create a new Web Service from this repo.
2. Use the provided `Dockerfile`.
3. Add all environment variables from `.env.example`.
4. Set `WEBHOOK_BASE_URL` to your Render service URL.
5. Deploy. On startup, the app registers the Telegram webhook automatically.

### Railway

1. Create a new project from the repo.
2. Railway will detect the Dockerfile or you can run the standard Node build.
3. Add the same environment variables.
4. Set `WEBHOOK_BASE_URL` to the Railway public domain.
5. Deploy and verify `/health`.

### VPS

1. Install Node 20 or run the app with Docker.
2. Clone the repo and run `npm install`.
3. Run `npm run build`.
4. Start with `npm run start` behind Nginx or Caddy.
5. Terminate HTTPS at the reverse proxy.
6. Set `WEBHOOK_BASE_URL` to the public HTTPS domain.

## Production Checklist

- Use a real HTTPS domain
- Store secrets only in deployment environment variables
- Restrict Firebase service account access to the project
- Rotate `SESSION_SECRET` and admin password periodically
- Monitor structured logs from the Express service
- Review Firestore quotas and billing for expected traffic

## Verified In This Workspace

- `npm run typecheck`
- `npm run test`
- `npm run build`
