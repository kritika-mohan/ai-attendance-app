# SMARTCURRICULUM – Deployment Guide

## Prerequisites

- [Node.js 18+](https://nodejs.org)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local edge function testing)
- A free [Supabase](https://supabase.com) account
- An [OpenRouter](https://openrouter.ai) account

---

## Step 1 – Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Note your **Project URL** and **Anon Key** from:
   - Project → Settings → API

---

## Step 2 – Run the Database Schema

1. In Supabase Dashboard → **SQL Editor** → **New Query**
2. Paste the contents of `supabase/schema.sql`
3. Click **Run**

You should see tables: `users`, `sessions`, `attendance`.

---

## Step 3 – Configure API Keys

Open `config.js` and fill in your keys:

```js
const CONFIG = {
  SUPABASE_URL:       "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY:  "eyJhbGciOi...",
  OPENROUTER_API_KEY: "sk-or-v1-...",
  // ...
};
```

> ⚠️ **Never commit real API keys to GitHub.** Add `config.js` to `.gitignore` in production.

---

## Step 4 – Deploy the Edge Function

### 4a. Login to Supabase CLI

```bash
npx supabase login
```

### 4b. Link your project

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

(Find `PROJECT_REF` in Project Settings → General)

### 4c. Set the secret key (stored securely, never in frontend)

```bash
npx supabase secrets set QR_SECRET_KEY="your-very-long-random-secret-string-here"
```

Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4d. Deploy the function

```bash
npx supabase functions deploy verify-token --no-verify-jwt
```

✅ The function URL will be:  
`https://<your-project-ref>.supabase.co/functions/v1/verify-token`

---

## Step 5 – Enable Email Auth (Supabase)

1. Dashboard → **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. For development, optionally disable **Confirm email** (Authentication → Settings → toggle off)

---

## Step 6 – Run the App Locally

No build step needed — just open with a local server:

### Option A: VS Code Live Server Extension
Right-click `index.html` → **Open with Live Server**

### Option B: npx serve
```bash
cd "e:\COLLEGE\ai attendance app\ai-attendance-app"
npx serve .
```

Then open: `http://localhost:3000`

---

## Step 7 – Test the Full Flow

1. Open `http://localhost:3000`
2. Click **Get Started** → `login.html`
3. **Register** a Teacher account (role: Teacher, course: "Computer Science")
4. **Register** a Student account (role: Student, same course)
5. Log in as **Teacher** → `teacher.html`
   - Click **Start Attendance**
   - QR code appears and rotates every 30s
6. Open another browser tab / your phone
7. Log in as **Student** → `student.html`
   - Click **Scan QR Code** → allow camera
   - Scan the teacher's QR
   - You should see ✅ success
8. Back on Teacher page → live table updates
9. Go to `dashboard.html` → charts render, click **Generate Insights**

---

## File Structure Reference

```
ai-attendance-app/
├── config.js                    ← 🔑 API keys (never commit real keys)
├── index.html                   ← Landing page
├── login.html                   ← Auth (login / register)
├── teacher.html                 ← QR generation + live attendance
├── student.html                 ← QR scanner + history
├── dashboard.html               ← Analytics + AI insights
├── css/
│   └── styles.css               ← Complete design system
├── js/
│   ├── supabaseClient.js        ← Supabase singleton
│   ├── auth.js                  ← Authentication module
│   ├── qrGenerator.js           ← Dynamic QR + 30s refresh
│   ├── qrScanner.js             ← Camera scanner
│   ├── attendance.js            ← Data fetching + CSV export
│   ├── dashboard.js             ← Charts + realtime
│   ├── aiInsights.js            ← OpenRouter API client
│   └── utils.js                 ← Toast, theme, helpers
└── supabase/
    ├── schema.sql               ← PostgreSQL schema + RLS
    └── functions/
        └── verify-token/
            └── index.ts         ← Deno edge function (security layer)
```

---

## Security Architecture

| Layer | Protection |
|---|---|
| QR token | SHA-256 hash of `sessionId:timestamp:SECRET_KEY` (key only on server) |
| Token expiry | 35-second window enforced server-side |
| Replay attacks | Timestamp uniqueness prevents reuse |
| Duplicate attendance | `UNIQUE (session_id, student_id)` in DB |
| Device spoofing | `UNIQUE (session_id, device_id)` in DB |
| Row Level Security | Students read only own records; teachers read own sessions |
| Service role insert | Only edge function can insert attendance (not client) |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Camera not opening | Allow camera permissions in browser settings |
| QR scan fails | Make sure the session isn't expired; teacher should refresh |
| "User profile not found" | Check RLS policies — users need the `users_insert_own` policy |
| AI insights blank | Verify `OPENROUTER_API_KEY` in `config.js` |
| Edge function 401 | Make sure `QR_SECRET_KEY` secret is set in Supabase |
| Realtime not working | Run `ALTER PUBLICATION supabase_realtime ADD TABLE attendance;` in SQL Editor |

---

## Hosting (Production)

Deploy to any static host (no server needed except Supabase):

- **Netlify**: Drag and drop the folder
- **Vercel**: `npx vercel` in the project directory
- **GitHub Pages**: Push to `gh-pages` branch

> Remember to set `config.js` values to environment variables or use a `.env` injection tool for production builds.