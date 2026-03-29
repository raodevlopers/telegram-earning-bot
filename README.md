# Telegram Earning Bot

Production-ready Telegram earning bot with:

- Telegraf bot flows for tasks, referrals, wallet, and withdrawals
- Express admin API and React admin dashboard
- Firebase Firestore transaction-safe wallet ledger
- Manual withdrawal approval flow
- Referral rewards triggered on the referred user's first completed task

## Stack

- Backend: Node.js, Express, TypeScript
- Bot: Telegraf
- Database: Firebase Firestore via Admin SDK
- Admin UI: React + Vite
- Hosting: Railway for backend, Firebase Hosting for admin, Docker-compatible

## Project Structure

```text
admin/   React admin dashboard
server/  Express API, Telegram webhook, Firestore services
shared/  Shared constants, types, formatters, validators
scripts/ PowerShell automation helpers for GitHub, Railway, and Firebase Hosting
```

## Core Features

- Auto-register users from Telegram ID
- Reward users `INR 10` per task by default
- Reward referrers `INR 5` when invited users complete their first task
- Minimum withdrawal of `INR 30`
- Each task can only be completed once per user
- Task verification cooldown to reduce instant abuse
- Admin task CRUD, user lookup, referral ledger, and withdrawal approval or rejection
- Immutable wallet transactions for every balance mutation

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Fill in your Telegram bot values:
   `BOT_TOKEN`, `BOT_USERNAME`, `WEBHOOK_BASE_URL`, `TELEGRAM_WEBHOOK_SECRET`
3. Fill in Firebase Admin service-account values:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
4. Generate an admin password hash:

```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1], 12).then(v=>console.log(v))" "your-admin-password"
```

5. Put the hash into `ADMIN_PASSWORD_HASH`.
6. Set a long random `SESSION_SECRET`.
7. If the admin panel is hosted separately on Firebase Hosting, set `ADMIN_ORIGIN` to that public admin URL.

## Local Development

Install dependencies:

```bash
npm install
```

Run the full workspace in development mode:

```bash
npm run dev
```

Useful commands:

```bash
npm run typecheck
npm run test
npm run build
npm run start
```

Important:

- Telegram webhooks require a public HTTPS URL.
- For local bot testing, expose your local server with a tunnel such as `ngrok` or `cloudflared`, then set `WEBHOOK_BASE_URL` to that public URL.

## Deployment Scripts

Ready-to-run PowerShell helpers live in `scripts/`:

- `scripts/github-publish.ps1` creates or reuses the GitHub repo and pushes `main`
- `scripts/railway-deploy.ps1` creates or links a Railway project, sets variables, and deploys the backend
- `scripts/firebase-hosting-deploy.ps1` builds the admin app and deploys it to Firebase Hosting

Examples:

```powershell
.\scripts\github-publish.ps1 -GitHubOwner raodevlopers -RepoName telegram-earning-bot
.\scripts\railway-deploy.ps1 -ProjectName telegram-earning-bot -ServiceName bot-backend
.\scripts\firebase-hosting-deploy.ps1 -ProjectId hybrid-engineer -ApiBaseUrl https://your-railway-app.up.railway.app
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

The admin dashboard can run in two modes:

- Same-origin from the Express backend
- Separate Firebase Hosting deployment using `VITE_API_BASE_URL` and credentialed CORS back to Railway

Available admin capabilities:

- Password login
- Task creation, editing, pausing, and deletion
- User balance and risk review
- Referral inspection
- Withdrawal approval and rejection

## Deployment

### Railway Backend

1. Authenticate with Railway CLI using `railway login`.
2. Ensure `.env` contains real Firebase Admin credentials. The Firebase web config alone is not enough for the backend.
3. Run `.\scripts\railway-deploy.ps1`.
4. Confirm the generated Railway domain is the same one stored in `WEBHOOK_BASE_URL`.
5. Open `/health` on the deployed backend.

### Firebase Hosting Admin

1. Authenticate with Firebase CLI.
2. Run `.\scripts\firebase-hosting-deploy.ps1 -ProjectId hybrid-engineer -ApiBaseUrl https://your-railway-app.up.railway.app`.
3. Use the returned Hosting URL as `ADMIN_ORIGIN` in the Railway backend.

### GitHub Publish

1. Authenticate with GitHub CLI using `gh auth login --web --git-protocol https`.
2. Run `.\scripts\github-publish.ps1 -GitHubOwner raodevlopers -RepoName telegram-earning-bot`.

## Production Checklist

- Use a real HTTPS Railway domain before going live
- Store secrets only in deployment environment variables
- Restrict Firebase service-account access to the project
- Rotate `SESSION_SECRET` and the admin password periodically
- Monitor structured logs from the Express service
- Review Firestore quotas and billing for expected traffic

## Verified In This Workspace

- `npm run typecheck`
- `npm run test`
- `npm run build`
