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
- Minimum withdrawal of `INR 35`
- Each task can only be completed once per user
- Three rich task types: Google Maps review, timed website visit, and timed Google search visit
- Screenshot proof uploads hosted on ImgBB for admin review
- Browser timer pages that guide users out of Telegram's in-app browser
- Daily personalized reminder nudges for active users
- Admin task CRUD, user lookup, referral ledger, and withdrawal approval or rejection
- Immutable wallet transactions for every balance mutation

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Fill in your Telegram bot values:
   `BOT_TOKEN`, `BOT_USERNAME`, `WEBHOOK_BASE_URL`, `TELEGRAM_WEBHOOK_SECRET`
3. Fill in Firebase Admin service-account values:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
4. Set `IMGBB_API_KEY` so task proof screenshots and admin task images can be uploaded.
5. Set `ADMIN_AUTH_EMAIL` to the Firebase Auth admin email you want to use for the dashboard.
6. Set `ADMIN_ORIGIN` to your Firebase Hosting URL if the admin panel is hosted separately.
7. Set a long random `SESSION_SECRET`.
8. Generate an admin password hash for the legacy backend fallback:

```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1], 12).then(v=>console.log(v))" "your-admin-password"
```

9. Put the hash into `ADMIN_PASSWORD_HASH`.
10. Create the Firebase Auth admin user and claims:

```powershell
$env:ADMIN_AUTH_PASSWORD="your-secure-admin-password"
npm run setup:firebase-admin
```

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
npm run preflight
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
- Deploy the included `firestore.rules` and `firestore.indexes.json` so direct client access stays blocked
- Firebase web config in the React app is safe to expose, but never expose Firebase Admin credentials in the browser

## Telegram Bot Flow

1. User sends `/start`
2. Bot creates or refreshes the Firestore user record
3. Dashboard shows balance, tasks, referral state, and withdrawal action
4. User starts a task and opens the hosted task-session page
5. The session page guides the user through Chrome/browser timing and proof collection
6. The user uploads a screenshot proof back in Telegram
7. Balance is credited inside a Firestore transaction once timer and proof requirements are met
8. If it was the user's first completed task and they were referred, the referrer gets the referral reward
9. User can request withdrawal once balance reaches the minimum

## Admin Dashboard

The admin dashboard can run in two modes:

- Same-origin from the Express backend
- Separate Firebase Hosting deployment using `VITE_API_BASE_URL` and credentialed CORS back to Railway

Available admin capabilities:

- Firebase Auth email and password login
- Task creation, editing, pausing, deletion, caption management, and reference-image uploads
- User balance and risk review
- Proof screenshot auditing with direct image links
- Referral inspection
- Withdrawal approval and rejection for UPI, PayPal, and Google Play code payouts

## Deployment

### Railway Backend

1. Authenticate with Railway CLI using `railway login`.
2. Ensure `.env` contains real Firebase Admin credentials. The Firebase web config alone is not enough for the backend.
3. Set `ADMIN_AUTH_EMAIL` on Railway to match the Firebase Auth admin email.
4. Run `.\scripts\railway-deploy.ps1`.
5. Confirm the generated Railway domain is the same one stored in `WEBHOOK_BASE_URL`.
6. Open `/health` on the deployed backend.

### Firebase Hosting Admin

1. Authenticate with Firebase CLI.
2. Run `.\scripts\firebase-hosting-deploy.ps1 -ProjectId hybrid-engineer -ApiBaseUrl https://your-railway-app.up.railway.app`.
3. Use the returned Hosting URL as `ADMIN_ORIGIN` in the Railway backend.
4. Sign in with the seeded Firebase Auth admin account from the setup script.
5. The deploy helper now pushes Hosting plus Firestore rules and indexes together.

### GitHub Publish

1. Authenticate with GitHub CLI using `gh auth login --web --git-protocol https`.
2. Run `.\scripts\github-publish.ps1 -GitHubOwner raodevlopers -RepoName telegram-earning-bot`.

## Production Checklist

- Use a real HTTPS Railway domain before going live
- Store secrets only in deployment environment variables
- Restrict Firebase service-account access to the project
- Run `npm run preflight` before your final deployment
- Rotate `SESSION_SECRET`, the Firebase Auth admin password, and the fallback admin password hash periodically
- Monitor structured logs from the Express service
- Review Firestore quotas and billing for expected traffic

## Verified In This Workspace

- `npm run typecheck`
- `npm run test`
- `npm run build`
