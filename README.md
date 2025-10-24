# Agama Technologies — Full‑Stack AI Consulting Site

A production‑ready starter for Agama Technologies, built with **Node.js + Express + MongoDB** and a clean static frontend.
It includes:

- Native **email/password auth** with bcrypt + HTTP‑only JWT cookies
- Free **maturity assessment** (Observability, Security, AIOps, Analytics)
- **Partial report** for free; **mock payment** unlocks the full report
- Single **Render Web Service** + **MongoDB** (Atlas or self‑hosted)
- Modern, enterprise look & feel with animations (Bootstrap + AOS)

## Project Structure

```
/backend
  index.js              # Express server, routes, static serving
  /models               # Mongoose models (User, Assessment, Report, Payment)
  /utils/scoring.js     # Scoring + benchmarks loader
  /data                 # Benchmarks and question banks
  /public               # Static frontend (copied from ../frontend at build time)
  package.json
  .env.example
/frontend
  index.html, assessment.html, report.html, login.html, signup.html, dashboard.html
  /css/styles.css
render.yaml             # Render IaC (optional)
README.md
```

---

## 1) Create a MongoDB database (MongoDB Atlas)

1. Go to https://www.mongodb.com/cloud/atlas and create/sign in to your account.
2. **Create a free cluster** (Shared, M0 is fine for testing).
3. Create a **Database User** (username + password).
4. Add **Network Access** → IP allowlist: `0.0.0.0/0` (or restrict to Render).
5. Get your **Connection String** from Atlas (looks like: `mongodb+srv://.../mydb?retryWrites=true&w=majority`).

Update `/backend/.env` from `.env.example`:
```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<dbName>?retryWrites=true&w=majority
JWT_SECRET=<generate a long random string>
ALLOWED_ORIGINS=https://www.agamatechnologies.com,http://localhost:5173,http://localhost:3000
```

---

## 2) Run locally

### Prereqs
- Node.js 18+
- npm

### Steps
```bash
# from repo root
cp backend/.env.example backend/.env
# edit backend/.env with your Atlas URI + JWT_SECRET

cd backend
npm install
npm run build-frontend   # copies ../frontend into ./public
npm run dev              # starts server on http://localhost:3000
```

Visit `http://localhost:3000`.

---

## 3) Deploy to Render (Web Service)

You can use the included `render.yaml` (recommended) or configure manually in the Render dashboard.

### Option A — render.yaml

1. Push this repo to GitHub.
2. In Render → **Blueprints**, select your repo containing `render.yaml`.
3. Set environment variables:

- `MONGODB_URI` — your Atlas connection string
- `JWT_SECRET` — long random
- `ALLOWED_ORIGINS` — e.g. `https://www.agamatechnologies.com`

Render will build and start the app.

### Option B — Manual (Web Service)

1. Create a **Web Service** in Render, link your GitHub repo.
2. **Root Directory**: `/backend`
3. **Build Command**: `npm ci && npm run build-frontend`
4. **Start Command**: `npm start`
5. **Environment Variables**:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `ALLOWED_ORIGINS`

(Optional) Add custom domain `www.agamatechnologies.com` to the service.

---

## 4) Required ENV variables (Render)

- `PORT` (Render provides this automatically)
- `MONGODB_URI` (Atlas connection string)
- `JWT_SECRET` (long random string)
- `JWT_COOKIE_NAME` (default: `at_session`)
- `JWT_EXPIRES_DAYS` (default: `7`)
- `ALLOWED_ORIGINS` (comma‑separated list of allowed origins)

---

## 5) GitHub + VS Code Quickstart

**Initialise repo and push:**
```bash
# inside project folder
git init
git branch -M main
git add .
git commit -m "Initial commit: Agama Technologies app"

# create a new empty repo on GitHub first, then:
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

**From VS Code:**
- Open the folder (`File → Open Folder...`).
- If not initialised, use **Source Control** panel → "Initialize Repository".
- Commit changes via Source Control (message + checkmark).
- "Publish Branch" or `git push` to GitHub.

**Clone on a new machine:**
```bash
git clone https://github.com/<your-username>/<repo-name>.git
code <repo-name>
```

---

## 6) Using the App

1. Visit `/signup.html` to create an account.
2. Run a free assessment at `/assessment.html`.
3. You’ll see a **partial** report. Click **Unlock full report** to simulate payment and reveal everything.

> This project intentionally avoids any third‑party auth or storage services—only MongoDB and a single Render Web Service are required.
