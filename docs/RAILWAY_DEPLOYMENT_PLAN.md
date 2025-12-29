---
name: Railway Production Deployment
overview: Deploy Habitus to Railway with PostgreSQL database (Supabase), Cloudinary file storage, and custom subdomain habitus.nextstepslab.com. Migrate from SQLite to PostgreSQL and from local file storage to Cloudinary.
todos: []
---

# Railway Production Server Deployment Plan

## Overview

Deploy Habitus to Railway with:

- **PostgreSQL database** (Railway's built-in PostgreSQL - included in free tier)
- **Cloudinary** for file uploads (profile pictures)
- **Custom subdomain**: habitus.nextstepslab.com
- **Web service** serving both frontend and backend

## Why Railway?

- **Always-on free tier** - No cold starts (unlike Render)
- **$5/month credit** - Usually free for small apps
- **Simple setup** - Similar to Render but better free tier
- **Auto-deploy from GitHub** - Automatic deployments
- **Built-in PostgreSQL** - No need for external database service, included in Railway

## Architecture

```javascript
┌──────────────────────┐
│habitus.nextstepslab.com│
│   (Custom Subdomain)  │
└──────────┬────────────┘
         │
         ▼
┌─────────────────┐
│  Railway Web    │
│  Service        │
│  (Node.js)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │        │
    ▼        ▼
┌─────────┐ ┌──────────────┐
│PostgreSQL│ │  Cloudinary  │
│(Railway) │ │  (File Store)│
└─────────┘ └──────────────┘
```

---

## PHASE 1: Account Setup & Service Configuration

### Step 1.1: Create Railway Account

**Action:** Create a Railway account and verify email**Detailed Instructions:**

1. Go to https://railway.app
2. Click "Start a New Project" or "Login"
3. Sign up with:

- GitHub account (recommended - easier for deployment), OR
- Email address

4. If using GitHub, authorize Railway to access your repositories
5. Complete any onboarding steps

**Verification:**

- ✅ You can log into Railway dashboard
- ✅ You see the Railway dashboard home page
- ✅ GitHub is connected (if using GitHub signup)

**STOP HERE** - Verify you can access Railway dashboard before proceeding.---

### Step 1.2: Create Cloudinary Account

**Action:** Create a Cloudinary account and get API credentials**Detailed Instructions:**

1. Go to https://cloudinary.com/users/register/free
2. Fill out the registration form:

- Email address
- Password
- Full name
- Company (optional - can use personal name)

3. Verify your email address
4. After login, you'll see the Dashboard
5. On the Dashboard, you'll see your account details:

- **Cloud Name** (e.g., `dxyz123abc`)
- **API Key** (e.g., `123456789012345`)
- **API Secret** (click "Reveal" to see it)

**Save these credentials securely:**

- `CLOUDINARY_CLOUD_NAME`: [Your Cloud Name]
- `CLOUDINARY_API_KEY`: [Your API Key]
- `CLOUDINARY_API_SECRET`: [Your API Secret]

**Verification:**

- ✅ You can log into Cloudinary dashboard
- ✅ You can see your Cloud Name, API Key, and API Secret
- ✅ You've saved all three credentials

**STOP HERE** - Save credentials before proceeding.---

### Step 1.3: Set Up Railway PostgreSQL Database (Optional - Can Do Later)

**Action:** Note that Railway PostgreSQL will be set up in Step 3.1**Why Railway PostgreSQL:**

- **Included in Railway** - No separate account needed
- **Free tier** - Covered by Railway's $5/month credit
- **Simple setup** - Just add a service in Railway dashboard
- **Integrated** - Works seamlessly with Railway web service

**Note:** We'll create the PostgreSQL database service in Railway in Step 3.1 when we set up the project. **Important:** Railway does NOT automatically link the database to your web service. You will need to:

- Create the PostgreSQL service (Step 3.1)
- Manually link PostgreSQL variables to your web service (Step 3.1.1)
- Construct `DATABASE_URL` from individual PostgreSQL variables (Step 3.3)

**You can skip this step for now** - We'll do it in Step 3.1 when creating the Railway project.**STOP HERE** - You can proceed to Phase 2 (Code Updates) or wait until Step 3.1 to set up the database.---

## PHASE 2: Code Updates (Environment-Aware)

### Step 2.1: Update Port Configuration

**Action:** Make port handling support both `PORT` (Railway) and `VITE_PORT` (dev)**Files to modify:**

- `backend/src/setup/constants.ts`

**Changes needed:**

- Check for `PORT` environment variable first (Railway standard)
- Fallback to `VITE_PORT` if `PORT` not set (development)
- Update JSDoc comments in English
- Ensure error messages are in English

**Test after this step:**

- Run `npm run dev` locally - should still work with `VITE_PORT`
- Verify no errors in console

**STOP HERE** - Test local development still works.---

### Step 2.2: Add Database Dependencies

**Action:** Add PostgreSQL support packages**Files to modify:**

- `backend/package.json`

**Changes needed:**

- Add `pg` dependency (PostgreSQL client for Railway PostgreSQL)
- Add `@types/pg` as dev dependency
- Keep `sqlite3` (still needed for development)

**Commands:**

```bash
cd backend
npm install pg
npm install --save-dev @types/pg
```

**Test after this step:**

- Run `npm install` in root directory
- Verify no installation errors
- Verify `sqlite3` still works locally

**STOP HERE** - Verify dependencies install correctly.---

### Step 2.3: Update Database Class for Environment-Aware Support

**Action:** Make database.ts support both SQLite (dev) and PostgreSQL (Supabase) (prod)**Files to modify:**

- `backend/src/db/database.ts`

**Changes needed:**

- Detect database type: Check for `DATABASE_URL` → PostgreSQL (Railway), otherwise → SQLite
- Create separate connection logic for each database type
- Create separate schema creation for each (PostgreSQL vs SQLite syntax)
- Update all methods to work with both database types
- Add JSDoc comments in English
- Ensure error messages are in English
- Remove any dead code

**Key differences to handle:**

- PostgreSQL (Railway): `SERIAL PRIMARY KEY`, `TIMESTAMP`, no `PRAGMA`
- SQLite: `INTEGER PRIMARY KEY AUTOINCREMENT`, `DATETIME`, `PRAGMA` statements
- Connection: PostgreSQL uses connection pool, SQLite uses file path
- Return values: PostgreSQL `RETURNING` clause, SQLite `lastID`

**Test after this step:**

- Run `npm run dev` locally - should still use SQLite
- Run tests: `npm test` - all tests should pass
- Check for dead code in modified file

**STOP HERE** - Verify local development and tests still work.---

### Step 2.4: Add Cloudinary Dependency

**Action:** Add Cloudinary package**Files to modify:**

- `backend/package.json`

**Changes needed:**

- Add `cloudinary` dependency

**Commands to run:**

```bash
cd backend
npm install cloudinary
```

**Test after this step:**

- Run `npm install` in root directory
- Verify no installation errors

**STOP HERE** - Verify dependency installs correctly.---

### Step 2.5: Update Upload Middleware for Environment-Aware Support

**Action:** Make upload.ts support both local storage (dev) and Cloudinary (prod)**Files to modify:**

- `backend/src/middleware/upload.ts`
- `backend/src/server.ts` (may need updates for static file serving)

**Changes needed:**

- Detect storage type: Check for `CLOUDINARY_CLOUD_NAME` → Cloudinary, otherwise → local
- Create separate upload logic for each:
- Development: Continue using `multer.diskStorage`
- Production: Use Cloudinary SDK `uploader.upload()`
- Return appropriate URLs:
- Development: `/uploads/filename.jpg`
- Production: Cloudinary URL `https://res.cloudinary.com/...`
- Update static file serving in `server.ts`:
- Development: Keep `/uploads` route
- Production: Remove or conditionally disable `/uploads` route
- Add JSDoc comments in English
- Ensure error messages are in English
- Remove any dead code

**Test after this step:**

- Run `npm run dev` locally - should still use local file storage
- Test file upload locally - should save to `data/uploads/`
- Run tests: `npm test` - all tests should pass
- Check for dead code in modified files

**STOP HERE** - Verify local file uploads still work.---

### Step 2.6: Test Production Database Locally (Optional but Recommended)

**Action:** Test Railway PostgreSQL connection locally before deploying**Prerequisites:**

- Railway PostgreSQL database created (from Step 1.3 or Step 3.1)
- Connection string from Railway

**Instructions:**

1. In Railway dashboard, go to your PostgreSQL service
2. Go to "Variables" tab
3. Find `DATABASE_URL` - this is your connection string
4. Copy the connection string
5. Set `DATABASE_URL` in `config/.env` temporarily:
   ```javascript
         DATABASE_URL=postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
   ```

(Your actual connection string will be different)

6. Run the app: `npm run dev`
7. Verify it connects and creates schema
8. Remove `DATABASE_URL` from `.env` after testing (to go back to SQLite for local dev)

**Test after this step:**

- App connects to Railway PostgreSQL successfully
- Schema is created correctly
- Basic operations work
- Remove production credentials from `.env` after testing

**STOP HERE** - Verify Railway PostgreSQL connection works (optional step).---

### Step 2.7: Test Cloudinary Locally (Optional but Recommended)

**Action:** Test Cloudinary uploads locally before deploying**Prerequisites:**

- Cloudinary credentials from Step 1.2

**Instructions:**

1. Add to `config/.env` temporarily:

   ```javascript
   CLOUDINARY_CLOUD_NAME = your_cloud_name;
   CLOUDINARY_API_KEY = your_api_key;
   CLOUDINARY_API_SECRET = your_api_secret;
   ```

2. Run `npm run dev`
3. Test uploading a profile picture
4. Verify file appears in Cloudinary dashboard
5. Remove Cloudinary vars from `.env` after testing

**Test after this step:**

- File uploads to Cloudinary successfully
- URL is returned correctly
- File appears in Cloudinary media library

**STOP HERE** - Verify Cloudinary uploads work (optional step).---

### Step 2.8: Run Full Test Suite

**Action:** Ensure all tests pass after code changes**Commands:**

```bash
npm test
```

**Verification:**

- ✅ All tests pass
- ✅ No new test failures
- ✅ Code coverage maintained

**STOP HERE** - Fix any test failures before proceeding.---

## PHASE 3: Railway Deployment Configuration

### Step 3.1: Create New Project on Railway

**Action:** Create a new Railway project, add PostgreSQL database, and connect your GitHub repository**Detailed Instructions:**

1. In Railway dashboard, click "New Project"
2. Select "Deploy from GitHub repo"
3. If not connected, authorize Railway to access your GitHub account
4. Select your repository: `habitus` (or your repo name)
5. Railway will automatically detect it's a Node.js project
6. **Add PostgreSQL database:**

- In the project, click "New" → "Database" → "Add PostgreSQL"
- Name it `habitus-db` (or your preferred name)
- Railway will create the PostgreSQL service
- **Note:** Railway does NOT automatically link the database to your web service - you need to do this manually (see Step 3.1.1 below)

7. Click "Deploy Now" (we'll configure it properly in next steps)

**Note:** Railway will start deploying, but we'll configure environment variables and settings before it completes.**Verification:**

- ✅ Project is created on Railway
- ✅ PostgreSQL database service is created and linked
- ✅ GitHub repository is connected
- ✅ Initial deployment has started

**STOP HERE** - Don't worry if deployment fails, we'll configure it properly next.---

### Step 3.1.1: Link PostgreSQL Database to Web Service

**Action:** Manually link the PostgreSQL database service to your web service so `DATABASE_URL` is available**Detailed Instructions:**

1. In your Railway project dashboard, you should see two services:

   - Your web service (named after your repo, e.g., `habitus`)
   - Your PostgreSQL database service (e.g., `habitus-db`)

2. **Link `DATABASE_URL` from PostgreSQL service to your web service:**

   Railway provides `DATABASE_URL` directly from the PostgreSQL service. You just need to reference it:

   - Click on your **web service** (not the database)
   - Go to the **"Variables"** tab
   - Click **"New Variable"** → **"Add Reference"** (or similar option)
   - Select your PostgreSQL database service (e.g., `habitus-db`)
   - Select `DATABASE_URL` from the available variables
   - Railway will automatically create the reference with the value: `${{habitus-db.DATABASE_URL}}`
   - Replace `habitus-db` with your actual database service name if different

3. **Alternative method (if reference doesn't work):**

   If Railway doesn't provide `DATABASE_URL` directly, you can construct it from individual PostgreSQL variables:

   - Reference individual variables: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
   - Create `DATABASE_URL` manually:
     - Variable Name: `DATABASE_URL`
     - Value: `postgresql://${{POSTGRES_USER}}:${{POSTGRES_PASSWORD}}@${{POSTGRES_HOST}}:${{POSTGRES_PORT}}/${{POSTGRES_DB}}`

4. **Verify the link:**
   - In your web service → "Variables" tab
   - You should see `DATABASE_URL` listed
   - The value should be: `${{habitus-db.DATABASE_URL}}` (or your database service name)
   - Railway will automatically resolve this to the actual connection string at runtime

**Important Notes:**

- Railway does NOT automatically link services - you must do this manually
- Railway provides `DATABASE_URL` directly from the PostgreSQL service
- The reference value will be: `${{your-db-service-name.DATABASE_URL}}`
- Railway automatically resolves this reference to the actual connection string at runtime
- Replace `your-db-service-name` with your actual PostgreSQL service name (e.g., `habitus-db`)

**Verification:**

- ✅ `DATABASE_URL` appears in your web service's Variables tab
- ✅ The value is: `${{habitus-db.DATABASE_URL}}` (or your database service name)
- ✅ Railway will automatically resolve this to the actual connection string at runtime
- ✅ The resolved connection string format is: `postgresql://user:password@host:port/database`

**STOP HERE** - Verify `DATABASE_URL` is linked to your web service before proceeding.---

### Step 3.2: Configure Build and Start Commands

**Action:** Set up build and start commands for Railway**Detailed Instructions:**

1. In your Railway project, click on the service (should be named after your repo)
2. Go to "Settings" tab
3. Scroll to "Build & Deploy" section
4. Configure:

- **Build Command**: `npm install && npm run build`
- **Start Command**: `cd backend && npm start`
- **Root Directory**: Leave empty (root of repo)

5. Click "Save"

**Alternative: Create `railway.json` (Optional)**You can also create a `railway.json` file in project root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "cd backend && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Verification:**

- ✅ Build and start commands are configured
- ✅ Settings are saved

**STOP HERE** - Verify build/start commands are set correctly.---

### Step 3.3: Configure Environment Variables in Railway

**Action:** Set all required environment variables in Railway dashboard**Detailed Instructions:**

1. In your Railway service, go to "Variables" tab
2. Click "New Variable" for each variable below
3. Add the following variables one by one:

**Note:** The backticks below are just for documentation formatting. In Railway, enter the variable name and value WITHOUT backticks.

**Required Variables:**

- Variable Name: `NODE_ENV` → Value: `production`
- Variable Name: `TRUST_PROXY` → Value: `true`
- Variable Name: `VITE_SERVER_URL` → Value: `https://habitus.nextstepslab.com`
- Variable Name: `VITE_PORT` → Value: `${{PORT}}` (this references Railway's PORT variable)
- Variable Name: `PROJECT_ROOT` → Value: `/app` (Railway's project path)

**Example:** When adding `NODE_ENV`:

- In Railway's "Variable Name" field, enter: `NODE_ENV` (without backticks)
- In Railway's "Value" field, enter: `production` (without backticks)

**Database (Railway PostgreSQL - Manual Link Required):**

Railway provides `DATABASE_URL` directly from the PostgreSQL service. You just need to reference it in your web service.

**Link `DATABASE_URL` from PostgreSQL service:**

1. Go to your **web service** → "Variables" tab
2. Click "New Variable" → "Add Reference"
3. Select your PostgreSQL database service (e.g., `habitus-db`)
4. Select `DATABASE_URL` from the available variables
5. Railway will automatically create the reference with value: `${{habitus-db.DATABASE_URL}}`
   - Replace `habitus-db` with your actual database service name if different

**Alternative: Construct `DATABASE_URL` from individual variables (if reference doesn't work):**

If Railway doesn't provide `DATABASE_URL` directly, you can construct it:

1. Reference individual PostgreSQL variables: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
2. Create `DATABASE_URL` manually:
   - Variable Name: `DATABASE_URL`
   - Value: `postgresql://${{POSTGRES_USER}}:${{POSTGRES_PASSWORD}}@${{POSTGRES_HOST}}:${{POSTGRES_PORT}}/${{POSTGRES_DB}}`

**Verification:**

- ✅ `DATABASE_URL` exists in your web service's Variables tab
- ✅ The value is: `${{habitus-db.DATABASE_URL}}` (or your database service name)
- ✅ Railway will automatically resolve this to the actual connection string at runtime
- ✅ The resolved connection string format is: `postgresql://user:password@host:port/database`

**JWT & Auth:**

- Variable Name: `JWT_SECRET` → Value: [Generate a secure random string, e.g., use `openssl rand -hex 32`]
- Variable Name: `JWT_EXPIRES_IN` → Value: `7d`
- Variable Name: `MAGIC_LINK_EXPIRY_MINUTES` → Value: `15`
- Variable Name: `MAGIC_LINK_COOLDOWN_MINUTES` → Value: `5`

**Email (SMTP):**

- Variable Name: `SMTP_HOST` → Value: [Your SMTP host, e.g., `smtp.gmail.com`]
- Variable Name: `SMTP_PORT` → Value: `587` (or your SMTP port)
- Variable Name: `SMTP_USER` → Value: [Your SMTP username/email]
- Variable Name: `SMTP_PASS` → Value: [Your SMTP password/app password]

**Cloudinary:**

- Variable Name: `CLOUDINARY_CLOUD_NAME` → Value: [From Step 1.2]
- Variable Name: `CLOUDINARY_API_KEY` → Value: [From Step 1.2]
- Variable Name: `CLOUDINARY_API_SECRET` → Value: [From Step 1.2]

**Optional (if using):**

- Variable Name: `TELEGRAM_BOT_TOKEN` → Value: [Your Telegram bot token]
- Variable Name: `PERPLEXITY_API_KEY` → Value: [Your Perplexity API key]
- Variable Name: `PERPLEXITY_MODEL` → Value: `sonar`

3. Mark sensitive variables (JWT_SECRET, SMTP_PASS, CLOUDINARY_API_SECRET, DATABASE_URL) as "Secret" by toggling the lock icon

**Generate JWT_SECRET:**Run this command locally to generate a secure secret:

```bash
openssl rand -hex 32
```

Copy the output and use it as `JWT_SECRET`.**Important Notes:**

- Railway automatically provides `PORT` environment variable
- Railway provides individual PostgreSQL variables (`POSTGRES_HOST`, `POSTGRES_PORT`, etc.) that must be manually linked
- You need to construct `DATABASE_URL` from these variables (see Step 3.1.1 and Step 3.3)
- Use `${{PORT}}` syntax to reference Railway's PORT in VITE_PORT
- Use `${{VARIABLE_NAME}}` syntax to reference other Railway variables
- All secrets are encrypted in Railway

**Verification:**

- ✅ All required environment variables are set
- ✅ `DATABASE_URL` is present in your web service's Variables tab (manually linked from Step 3.1.1)
- ✅ Sensitive values are marked as secrets (lock icon)
- ✅ No typos in variable names

**STOP HERE** - Verify all environment variables are configured correctly.---

### Step 3.4: Configure Health Check

**Action:** Set up health check endpoint for Railway**Detailed Instructions:**

1. In Railway service, go to "Settings" tab
2. Scroll to "Healthcheck" section
3. Configure:

- **Healthcheck Path**: `/health`
- **Healthcheck Timeout**: `30` seconds

4. Click "Save"

**Note:** Your app already has a `/health` endpoint that returns `{"status":"ok"}`**Verification:**

- ✅ Health check is configured
- ✅ Path is set to `/health`

**STOP HERE** - Verify health check is configured.---

### Step 3.5: Deploy and Monitor

**Action:** Trigger deployment and monitor the build**Detailed Instructions:**

1. In Railway dashboard, go to "Deployments" tab
2. Click "Redeploy" or wait for automatic redeploy after variable changes
3. Watch the build logs:

- Click on the deployment
- View "Build Logs" and "Deploy Logs"
- Look for any errors

4. Wait for deployment to complete (usually 3-5 minutes)

**Monitor the deployment:**

- Check "Build Logs" for build progress
- Check "Deploy Logs" for runtime logs
- Look for any error messages

**Common issues to watch for:**

- Build failures (missing dependencies, TypeScript errors)
- Runtime errors (missing environment variables, database connection issues)
- Port binding errors

**Verification:**

- ✅ Build completes successfully
- ✅ Service shows "Active" status
- ✅ Health check endpoint `/health` returns 200 OK
- ✅ No critical errors in logs
- ✅ Railway provides a public URL (e.g., `habitus-production.up.railway.app`)

**STOP HERE** - Verify service is running and healthy.---

## PHASE 4: Domain Configuration

### Step 4.1: Add Custom Domain in Railway

**Action:** Configure habitus.nextstepslab.com subdomain in Railway**Detailed Instructions:**

1. In your Railway service, go to "Settings" tab
2. Scroll to "Domains" section
3. Click "Add Domain"
4. Enter: `habitus.nextstepslab.com`
5. Click "Add"
6. Railway will show you DNS configuration:

- **Record Type**: CNAME (usually)
- **Name**: `habitus`
- **Value**: Your Railway service hostname (e.g., `habitus-production.up.railway.app`)
- **TTL**: 3600 (or default)

**Save these DNS details:**

- Record Type: [CNAME or A]
- Name: `habitus`
- Value: [Railway hostname]

**Verification:**

- ✅ Custom domain is added in Railway
- ✅ DNS instructions are displayed
- ✅ You have the DNS record details saved

**STOP HERE** - Don't configure DNS yet, verify domain is added in Railway first.---

### Step 4.2: Configure DNS at Domain Registrar

**Action:** Add DNS record at your domain registrar for nextstepslab.com**Detailed Instructions:**

1. Log into your domain registrar (where nextstepslab.com is managed)
2. Find DNS management / DNS settings for `nextstepslab.com`
3. Add a new DNS record:

- **Type**: CNAME (or A if Railway provided IP)
- **Name/Host**: `habitus` (or `habitus.nextstepslab.com` depending on registrar)
- **Value/Target**: The Railway hostname from Step 4.1
- **TTL**: 3600 (or default)

**Common Registrars:**

- **Cloudflare**: DNS → Records → Add record
- **GoDaddy**: DNS Management → Add
- **Namecheap**: Advanced DNS → Add New Record
- **Google Domains**: DNS → Custom records → Create new record

**Important:**

- Only add the subdomain record (`habitus`), don't modify root domain records
- DNS propagation can take 5 minutes to 48 hours (usually 5-30 minutes)
- You can check propagation with: `nslookup habitus.nextstepslab.com`

**Verification:**

- ✅ DNS record is added at registrar
- ✅ Record type, name, and value are correct
- ✅ Record is saved

**STOP HERE** - Wait for DNS propagation (check with `nslookup` or `dig`).---

### Step 4.3: Verify DNS Propagation and SSL

**Action:** Wait for DNS to propagate and SSL certificate to be issued**Detailed Instructions:**

1. Wait 5-30 minutes for DNS propagation
2. Check DNS propagation:
   ```bash
            nslookup habitus.nextstepslab.com
            # or
            dig habitus.nextstepslab.com
   ```

Should return the Railway IP or hostname

3. In Railway dashboard, check "Domains" section
4. Wait for SSL certificate status to show "Active" or "Issued"

- Railway automatically provisions SSL via Let's Encrypt
- Usually takes 5-10 minutes after DNS propagates

5. Test the domain:

- Visit `https://habitus.nextstepslab.com/health`
- Should return `{"status":"ok"}`

**Verification:**

- ✅ DNS resolves correctly
- ✅ SSL certificate is active in Railway
- ✅ `https://habitus.nextstepslab.com/health` returns 200 OK
- ✅ No SSL warnings in browser

**STOP HERE** - Verify domain and SSL are working.---

## PHASE 5: Testing & Validation

### Step 5.1: Test Production Deployment

**Action:** Verify all functionality works in production**Test Checklist:**

1. **Health Check**: `https://habitus.nextstepslab.com/health` → Should return `{"status":"ok"}`
2. **Frontend**: `https://habitus.nextstepslab.com` → Should load React app
3. **API Endpoints**: Test a few API calls (e.g., `/api/auth/...`)
4. **Database**: Create a test user account
5. **File Upload**: Upload a profile picture (should use Cloudinary)
6. **Authentication**: Test login/signup flow
7. **Email**: Test magic link email sending (check SMTP works)

**Monitor Logs:**

- Check Railway logs for any errors
- Verify database connections are working
- Verify Cloudinary uploads are working

**Verification:**

- ✅ All core functionality works
- ✅ No critical errors in logs
- ✅ Database operations work
- ✅ File uploads work (check Cloudinary dashboard)

**STOP HERE** - Fix any issues found during testing.---

### Step 5.2: Final Code Quality Checks

**Action:** Ensure code quality requirements are met**Checklist:**

- ✅ Run full test suite: `npm test` (all tests pass)
- ✅ Check for dead code in all modified files
- ✅ Verify all comments are in English with JSDoc style
- ✅ Verify all error messages are in English
- ✅ No console.log statements with sensitive data
- ✅ Environment variables are properly used

**Commands:**

```bash
npm test
npm run lint  # if available
```

**Verification:**

- ✅ All tests pass
- ✅ No dead code
- ✅ Code quality standards met

**STOP HERE** - Complete final verification.---

## Development Environment Management

### Automatic Environment Detection

The application will **automatically detect** the environment and use the appropriate services:| Component | Development | Production ||-----------|------------|------------|| **Database** | SQLite (local `.db` file) | PostgreSQL (Railway) || **File Storage** | Local filesystem (`data/uploads/`) | Cloudinary || **Port** | `VITE_PORT` from `.env` | `PORT` from Railway || **Server URL** | `http://localhost:PORT` | `https://habitus.nextstepslab.com` || **Environment Variables** | `config/.env` file | Railway dashboard |

### How It Works

1. **Database**:

- Checks for `DATABASE_URL` → PostgreSQL (Railway) (production)
- Otherwise → SQLite (development)

2. **File Storage**:

- Checks for `CLOUDINARY_CLOUD_NAME` → Cloudinary (production)
- Otherwise → Local filesystem (development)

3. **Port**:

- Checks for `PORT` → Use it (production)
- Otherwise → Use `VITE_PORT` (development)

### Development Workflow (No Changes Required)

- ✅ Continue using `npm run dev` locally
- ✅ Keep your `config/.env` file with development settings
- ✅ SQLite database continues to work (`data/habitus.db`)
- ✅ Local file uploads continue to work (`data/uploads/`)
- ✅ No need to set Cloudinary or Supabase credentials locally
- ✅ No manual switching between dev/prod configurations

### Production Workflow

- ✅ Railway sets `NODE_ENV=production` automatically (via your env vars)
- ✅ Railway provides `PORT` automatically
- ✅ `DATABASE_URL` must be manually linked from PostgreSQL service to web service (Step 3.1.1)
- ✅ Set Cloudinary credentials in Railway dashboard
- ✅ Set other required env vars in Railway dashboard
- ✅ Application automatically uses production services

## Notes

- **Database**: Railway PostgreSQL (included in Railway, covered by $5/month credit)
- **Development**: SQLite continues to work locally without changes
- **File Storage**: Cloudinary free tier (25GB storage, 25GB bandwidth/month)
- **Development Storage**: Local filesystem (no limits, no account needed)
- **Domain**: habitus.nextstepslab.com subdomain configured in Railway dashboard
- **DNS**: CNAME record at domain registrar pointing to Railway service
- **SSL**: Automatically provisioned by Railway for the subdomain
- **Environment Switching**: Fully automatic - no manual configuration changes needed
- **Railway Free Tier**: $5/month credit, usually free for small apps, always-on (no cold starts)

## Troubleshooting

### Common Issues

**Database Connection Errors:**

- Verify PostgreSQL service is created in Railway
- **Most common issue:** `DATABASE_URL` is not linked to your web service
  - Check if `DATABASE_URL` exists in your web service's Variables tab
  - If not, reference it from your PostgreSQL service:
    1. Go to your web service → "Variables" tab
    2. Click "New Variable" → "Add Reference"
    3. Select your PostgreSQL database service
    4. Select `DATABASE_URL`
    5. The value should be: `${{your-db-service-name.DATABASE_URL}}`
  - If Railway doesn't provide `DATABASE_URL` directly, construct it from individual PostgreSQL variables
- Verify PostgreSQL service shows "Active" status in Railway
- Check Railway logs for database connection errors
- Ensure both services are in the same Railway project
- Verify the `DATABASE_URL` reference format: `${{service-name.DATABASE_URL}}`
- Railway will automatically resolve the reference to the actual connection string at runtime

**File Upload Errors:**

- Verify Cloudinary credentials are correct in Railway
- Check Cloudinary dashboard for upload limits
- Verify environment variables are set

**Build Failures:**

- Check build logs in Railway
- Verify all dependencies are in package.json
- Check TypeScript compilation errors

**DNS/SSL Issues:**

- Wait for DNS propagation (can take up to 48 hours)
- Verify DNS record is correct at registrar
- Check SSL certificate status in Railway dashboard
- Railway automatically provisions SSL - wait 5-10 minutes after DNS propagates

**Railway-Specific:**

- Check credit usage in Railway dashboard (Settings → Usage)
