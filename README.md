# Bharat Meet - Online Meeting Platform


Features:

- Rate limiting to prevent abuse and DoS attacks
- Real-time messaging using Socket.io
- **Thread Replies (Message Quoting) for targeted responses in channels**
- Send attachments as messages using UploadThing
- Delete & Edit messages in real time for all users
- Create Text, Audio and Video call Channels
- 1:1 conversation between members
- 1:1 video calls between members
- Member management (Kick, Role change Guest / Moderator)
- Unique invite link generation & full working invite system
- Infinite loading for messages in batches of 10 (tanstack/query)
- Server creation and customization
- Beautiful UI using TailwindCSS and ShadcnUI
- Full responsivity and mobile UI
- Installable mobile PWA with device push alerts
- Personal reminders with scheduled notifications
- Light / Dark mode
- Websocket fallback: Polling with alerts
- ORM using Prisma
- PostgreSQL database
- Authentication with Clerk

### Prerequisites

**Node.js 24.x**

### Cloning the repository

```shell
git clone https://github.com/AntonioErdeljac/next13-discord-clone.git
```

### Install packages

```shell
npm i
```

### Setup .env file

Copy `.env.example` to `.env` and fill in the values from Clerk, PostgreSQL,
UploadThing, and LiveKit.

```js
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=
NEXT_PUBLIC_CLERK_SIGN_UP_URL=
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=


DATABASE_URL=

UPLOADTHING_SECRET=
UPLOADTHING_APP_ID=

LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
NEXT_PUBLIC_LIVEKIT_URL=

# Required for production; development can use the in-memory fallback
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional web push notifications (generate with `npx web-push generate-vapid-keys`)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@your-domain.com

# Background reminder delivery (Upstash QStash)
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
```

**Note**: The application includes rate limiting to prevent abuse. It uses an in-memory fallback only in development. Production startup requires Upstash Redis credentials and `NEXT_PUBLIC_SITE_URL`, so rate limits and realtime origin checks remain consistent across instances.

### Mobile PWA and scheduled alerts

The app can be installed from a supported mobile browser using **Install Bharat Meet** (on iOS Safari, use Share → Add to Home Screen). It uses the same signed-in account and APIs as the desktop app. To deliver push alerts when the app is closed, create a VAPID key pair with `npx web-push generate-vapid-keys`, add the public/private keys and a `mailto:` subject to the deployment environment, and add the QStash token plus current/next signing keys from Upstash. Scheduled delivery uses signed, one-shot QStash messages rather than frequent Vercel Cron jobs, so it works on Vercel Hobby deployments too. Reminders created without QStash are saved and alert while the app is open; @mentions and fired reminders are saved in the in-app notification center. Push keys are optional for installation and in-app reminders.

### Setup Prisma

Add a PostgreSQL database and set its connection string in `DATABASE_URL`.

```shell
npm run db:generate
npm run db:push

```

The repository contains an incremental migration for the newer presence and
direct-message reaction tables. Existing environments can use `npm run db:push`
for schema synchronization, then run `npm run db:generate` after schema changes.
For a fresh production database, establish the baseline schema before applying
the incremental migration in `prisma/migrations`.

Before deploying the mobile reminder feature, apply the added `Reminder` and
`PushSubscription` tables to the target database. For an existing database that
is managed with `db:push`, run `npm run db:push` with its `DATABASE_URL` set to
that database; for a migration-managed database, apply the new migration after
the existing migration baseline is established.

### Start the app

```shell
npm run dev
```

## Available commands

Running commands with npm `npm run [command]`

| command         | description                              |
| :-------------- | :--------------------------------------- |
| `dev`           | Starts a development instance of the app |
| `build`         | Creates a production build                 |
| `start`         | Starts the production server               |
| `lint`          | Runs the Next.js lint checks               |
| `test`          | Runs the Vitest test suite                 |
| `db:generate`   | Regenerates the Prisma client              |
| `db:push`       | Synchronizes the Prisma schema             |

### Release validation

```shell
npm test
npm run lint
npm run build
```

Deployments can use `GET /api/health` as a liveness check. It returns `200`
when the application can reach PostgreSQL and `503` when the database check
fails.

### Deploy to Vercel

Import the repository into Vercel. The included `vercel.json` uses `npm ci` and
`npm run build`. Add every variable from `.env.example` in the Vercel project
settings, using production values for Clerk, PostgreSQL, UploadThing, and
LiveKit.

For Clerk Frontend API proxying, set `NEXT_PUBLIC_CLERK_PROXY_URL` to
`/__clerk/` in the Vercel environment, then deploy the proxy route before
enabling it in Clerk. In the Clerk production instance, set the Frontend API
proxy URL to `https://<your-production-domain>/__clerk`. The app forwards this
path to the Frontend API and supplies the server-only Clerk secret and trusted
client IP. Keep Vercel's `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and
`CLERK_SECRET_KEY` set to the matching live-instance keys. Add and verify a
custom Clerk domain and its DNS records in the Clerk Dashboard if you need
branded authentication and Account Portal URLs.

Vercel hosts the Next.js application and HTTP API routes, but its serverless
runtime does not provide a persistent Socket.IO process. Keep the current
Socket.IO realtime endpoint on a long-running Node host, or migrate realtime
events to a managed provider before relying on presence, typing, and live chat
in production.
