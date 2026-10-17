# Deploying The Morning Edition

The app has three parts, and each goes to its own free service:

| Part | Folder | Where it runs |
|---|---|---|
| Database and logins | `supabase/` | Supabase (you already have this) |
| Python engine (news, AI editor, PDF, cartoons) | `engine/` | Render |
| Website | `web/` | Vercel |

Do the steps in order. The website needs the engine's URL, and Supabase needs the website's URL.

---

## 1. Push the code to GitHub

### 1a. Check that no secrets will be uploaded

Open Git Bash in `~/Desktop/paper` and run:

```bash
cat .gitignore            # must list .env and .env.*
git status                # engine/.env and web/.env.local must NOT appear
```

If `engine/.env` or `web/.env.local` was ever committed before, take it out of git. This keeps the file on your PC:

```bash
git rm --cached engine/.env web/.env.local
```

### 1b. Commit

```bash
git add .
git commit -m "Morning Edition: games, cartoons, glass UI, deploy config"
```

### 1c. Create the GitHub repo and push

1. Go to https://github.com/new, name the repo (for example `morning-edition`), and choose Private or Public. Do **not** tick "Add a README".
2. Copy the repo URL, then run:

```bash
git remote -v                                   # if it shows nothing, add the remote:
git remote add origin https://github.com/<your-username>/morning-edition.git
git branch -M main
git push -u origin main
```

If Git asks for a password, sign in through the browser window it opens. Alternatively, use a GitHub Personal Access Token as the password.

---

## 2. Database: Supabase

Your project already exists. Check two things:

1. **SQL Editor:** make sure `supabase/schema.sql` was run, and then `supabase/migrations/002_article_body.sql` once.
2. **Authentication → Sign In / Providers → Email:** "Confirm email" should be on.

You will come back to Supabase in step 5 to add the live website address.

Keep these values open in a tab, since you'll paste them below. They are all under **Project Settings → API**:
- **Project URL**
- **anon / publishable key** (used by the website)
- **service_role / secret key** (used by the engine only; never put it in the website)

---

## 3. Engine: Render

1. Go to https://render.com and sign up with GitHub.
2. Click **New → Blueprint**, pick your repo, and Render reads `render.yaml` from the repo root.
   - If you'd rather set it up by hand, use **New → Web Service** with these settings:
     - Root Directory `engine`
     - Runtime Python
     - Build `pip install -r requirements.txt`
     - Start `uvicorn main:app --host 0.0.0.0 --port $PORT`
     - Environment variable `PYTHON_VERSION=3.12.7`
3. Fill in the environment variables. These are the same values as in your local `engine/.env`:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `OPENROUTER_API_KEY` | your OpenRouter key |
| `OPENROUTER_MODEL` | the model you use locally |
| `SERVICE_SHARED_SECRET` | a long random string. Make one with `openssl rand -hex 32` in Git Bash. **Write it down**, because Vercel needs the same one. |
| `APP_PUBLIC_URL` | leave as `http://localhost:3000` for now and fix it in step 5 |

4. Click **Create / Apply** and wait for the build to finish (a few minutes).
5. Open `https://<your-engine>.onrender.com/health`. If it returns `{"status":"ok"...}`, the engine is live. Copy this base URL for the next step.

> The free Render plan sleeps after 15 minutes without visits, so the first request after a nap takes about a minute. To keep it awake, use a free monitor such as https://cron-job.org to open `/health` every 10 minutes.

---

## 4. Website: Vercel

1. Go to https://vercel.com, sign up with GitHub, then click **Add New → Project** and import the repo.
2. Under **Root Directory**, click Edit and choose **`web`**. This is important. Vercel detects Next.js automatically.
3. Under **Environment Variables**, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable key |
| `ENGINE_URL` | `https://<your-engine>.onrender.com` (no slash at the end) |
| `SERVICE_SHARED_SECRET` | **exactly** the same string you gave Render |
| `CRON_SECRET` | another random string from `openssl rand -hex 32` |

4. Click **Deploy**. When it finishes, you get an address like `https://morning-edition.vercel.app`.

The daily 5 AM (Pakistan time) paper run comes from `web/vercel.json` and starts automatically. You can see it under Project → Settings → Cron Jobs.

---

## 5. Connect the pieces

1. **Supabase → Authentication → URL Configuration**
   - Set **Site URL** to `https://morning-edition.vercel.app` (your Vercel address).
   - Under **Redirect URLs**, add `https://morning-edition.vercel.app/auth/callback`. Keep `http://localhost:3000/auth/callback` too, so local testing still works.
2. **Render → your engine → Environment:** set `APP_PUBLIC_URL` to your Vercel address and save. Render redeploys on its own.

Without step 5.1, the links in the verification emails would point to localhost.

---

## 6. Test the live site

1. Open your Vercel address and sign up with a real email.
2. Verify it with the code, then finish onboarding. The first paper takes a while, longer if the engine was asleep.
3. Check that the following work:
   - opening a story;
   - Download PDF;
   - the Ask bar;
   - Games;
   - Cartoons.

If something fails:
- **Vercel → Project → Logs** shows website errors.
- **Render → your engine → Logs** shows engine errors, such as a wrong key or a feed that failed.
- An "engine unavailable" message usually means `ENGINE_URL` or `SERVICE_SHARED_SECRET` doesn't match between Vercel and Render.

---

## Updating later

Every `git push` to `main` redeploys both Vercel and Render on its own:

```bash
git add .
git commit -m "what changed"
git push
```
