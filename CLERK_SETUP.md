# Clerk setup for CivicWatch (Vercel production)

Use this if your app is on **Vercel only** (not localhost).

Replace `pothole-riya.vercel.app` with your real Vercel domain if different.

---

## Step 1 — Clerk Dashboard → Configure → Domains

Add your Vercel domain:

| Field | Value |
|-------|--------|
| **Production domain** | `pothole-riya.vercel.app` |

(Clerk may auto-detect this after first login attempt.)

**Fallback development host** (if Clerk asks):

| Field | Value |
|-------|--------|
| **Development / fallback host** | `http://localhost:3000` |

You can leave this as localhost even if you never run locally — Clerk keeps a dev instance separate from production. It will **not** break Vercel.

---

## Step 2 — Configure → Paths → **Production** tab

Fill the **Production** tab (not Development) with full URLs:

| Clerk field | Value |
|-------------|--------|
| **Home URL** | `https://pothole-riya.vercel.app` |
| **Sign-in URL** | `https://pothole-riya.vercel.app/login` |
| **Sign-up URL** | `https://pothole-riya.vercel.app/register` |
| **After sign-in URL** | `https://pothole-riya.vercel.app/map` |
| **After sign-up URL** | `https://pothole-riya.vercel.app/map` |
| **Sign-out URL** / **After sign-out URL** | `https://pothole-riya.vercel.app/` |
| **Unauthorized sign-in URL** | `https://pothole-riya.vercel.app/login` |

**Sign-out URL** = where users go after clicking Logout → home page `/`.

---

## Step 3 — Configure → Paths → **Development** tab (optional)

Only needed if you test on your PC later:

| Field | Value |
|-------|--------|
| **Home URL** | `http://localhost:3000` |
| **Sign-in URL** | `http://localhost:3000/login` |
| **Sign-out URL** | `http://localhost:3000/` |
| **After sign-in** | `http://localhost:3000/map` |

---

## Step 4 — Redirect URLs (required)

**Configure → Redirect URLs** — add every URL below:

```
https://pothole-riya.vercel.app
https://pothole-riya.vercel.app/
https://pothole-riya.vercel.app/login
https://pothole-riya.vercel.app/register
https://pothole-riya.vercel.app/map
```

---

## Step 5 — Enable Google

**Configure → SSO connections** → **Google** → Enable

---

## Step 6 — Vercel environment variables

Vercel → Project → **Settings** → **Environment Variables**:

| Name | Value |
|------|--------|
| `REACT_APP_CLERK_PUBLISHABLE_KEY` | `pk_test_...` (your key from Clerk) |
| `REACT_APP_API_URL` | `https://civic-issue-api-612t.onrender.com` |
| `REACT_APP_SITE_URL` | `https://pothole-riya.vercel.app` |

Use **REACT_APP_** prefix only (not `VITE_`).

**Redeploy** after saving (Deployments → ⋯ → Redeploy).

---

## Step 7 — Enable Google + test

1. Open `https://pothole-riya.vercel.app/login`
2. You should see Clerk sign-in with **Continue with Google**
3. After sign-in → redirected to `/map`
4. Logout → back to home `/`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **Login keeps reloading after Google** | Fixed in code: app waits for backend sync before redirecting. Push latest code and **redeploy Vercel**. Also confirm `REACT_APP_API_URL` is set on Vercel. |
| Redirects to localhost | You filled **Development** paths but use **Production** tab with Vercel URLs |
| Sign-out goes wrong page | Set **Sign-out URL** to `https://pothole-riya.vercel.app/` |
| "Invalid redirect URL" | Add all URLs from Step 4 in Redirect URLs |
| Still email/password form | `REACT_APP_CLERK_PUBLISHABLE_KEY` missing on Vercel — redeploy |
| Fallback dev host confusion | Leave as `http://localhost:3000` — safe to ignore if you only use Vercel |
| Stuck on "Signing you in…" | Backend `/api/auth/clerk-sync` failed — check Render is running and `REACT_APP_API_URL` is correct |
