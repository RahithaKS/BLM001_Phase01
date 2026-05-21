# LedgerLM - Complete Deployment Guide

## Overview
This guide covers deploying LedgerLM from Replit to your local laptop, then to a production server.

---

# PART 1: Download from Replit to Local Laptop

## Step 1.1: Download Project Files

### Navigation:
1. Open your Replit project in browser
2. Look at the **left sidebar** → find the **Files panel**
3. At the top of Files panel, click the **three dots (⋮)** menu
4. Click **"Download as zip"**
5. Save file to your Downloads folder

### Expected Outcome:
- File downloaded: `LedgerLM.zip` (approximately 50-100 MB)

### Verification:
- [ ] ZIP file downloaded successfully
- [ ] File size is greater than 10 MB

---

## Step 1.2: Extract Project Files

### Windows:
1. Go to Downloads folder
2. Right-click on `LedgerLM.zip`
3. Select **"Extract All..."**
4. Choose destination: `C:\Projects\LedgerLM`
5. Click **Extract**

### Mac/Linux:
```bash
cd ~/Downloads
unzip LedgerLM.zip -d ~/Projects/LedgerLM
```

### Expected Outcome:
A folder with these items:
```
LedgerLM/
├── client/           # Frontend React code
├── server/           # Backend Node.js code
├── python_backend/   # Python AI services
├── shared/           # Shared types and schemas
├── uploads/          # File uploads folder
├── package.json      # Node.js dependencies
├── tsconfig.json     # TypeScript config
├── vite.config.ts    # Vite config
├── drizzle.config.ts # Database config
└── .env.example      # Environment template
```

### Verification:
- [ ] Folder `client/` exists
- [ ] Folder `server/` exists
- [ ] Folder `python_backend/` exists
- [ ] File `package.json` exists

---

# PART 2: Install Prerequisites on Local Laptop

## Step 2.1: Install Node.js (Version 18 or higher)

### Windows:
1. Open browser → go to: https://nodejs.org/
2. Download **LTS version** (18.x or 20.x)
3. Run the installer (.msi file)
4. Click **Next** through all steps
5. Check **"Automatically install necessary tools"**
6. Click **Install** → **Finish**

### Mac:
```bash
brew install node@20
```

### Linux (Ubuntu/Debian):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Verification Command:
```bash
node --version
npm --version
```

### Expected Outcome:
```
v20.x.x (or v18.x.x)
10.x.x
```

### Acceptance Criteria:
- [ ] `node --version` shows v18.0.0 or higher
- [ ] `npm --version` shows 8.0.0 or higher

---

## Step 2.2: Install Python 3.11

### Windows:
1. Open browser → go to: https://www.python.org/downloads/
2. Download **Python 3.11.x**
3. Run installer
4. **IMPORTANT:** Check ✅ **"Add Python to PATH"** at bottom
5. Click **Install Now**
6. Click **Close** when done

### Mac:
```bash
brew install python@3.11
```

### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip
```

### Verification Command:
```bash
python --version
# or on Linux/Mac:
python3 --version
```

### Expected Outcome:
```
Python 3.11.x
```

### Acceptance Criteria:
- [ ] Python version is 3.11.x
- [ ] `pip --version` works without error

---

## Step 2.3: Install PostgreSQL Database

### Windows:
1. Open browser → go to: https://www.postgresql.org/download/windows/
2. Click **Download the installer**
3. Download version **15.x or 16.x**
4. Run installer
5. Set **password** for postgres user → **WRITE THIS DOWN!**
6. Keep default port: **5432**
7. Click **Next** → **Install** → **Finish**

### Mac:
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Verification Command:
```bash
# Windows (in Command Prompt as Administrator):
psql -U postgres -c "SELECT version();"

# Mac/Linux:
sudo -u postgres psql -c "SELECT version();"
```

### Expected Outcome:
```
PostgreSQL 15.x or 16.x
```

### Acceptance Criteria:
- [ ] PostgreSQL service is running
- [ ] Can connect with `psql` command
- [ ] Know the postgres password

---

## Step 2.4: Create Database and User

### Open PostgreSQL Command Line:

**Windows:**
1. Open Start Menu
2. Search for **"SQL Shell (psql)"**
3. Press Enter for server, database, port, username
4. Enter your postgres password

**Mac/Linux:**
```bash
sudo -u postgres psql
```

### Run These SQL Commands:
```sql
-- Create database
CREATE DATABASE ledgerlm;

-- Create user with password (CHANGE 'your_secure_password_here')
CREATE USER ledgerlm_user WITH PASSWORD 'your_secure_password_here';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE ledgerlm TO ledgerlm_user;

-- Connect to the database
\c ledgerlm

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO ledgerlm_user;

-- Exit
\q
```

### Verification Command:
```bash
# Test connection with new user:
psql -U ledgerlm_user -d ledgerlm -h localhost

# If prompted for password, enter: your_secure_password_here
# Then type \q to exit
```

### Expected Outcome:
```
ledgerlm=> 
```
(You're connected to the database)

### Acceptance Criteria:
- [ ] Database `ledgerlm` created
- [ ] User `ledgerlm_user` created
- [ ] Can connect as `ledgerlm_user`

---

# PART 3: Configure the Application

## Step 3.1: Create Environment Configuration File

### Navigation:
1. Open your project folder: `C:\Projects\LedgerLM` (or `~/Projects/LedgerLM`)
2. Create a new file named exactly: `.env`

### File Content - COPY AND MODIFY:
```env
# ===========================================
# DATABASE CONFIGURATION
# ===========================================
# Format: postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
# CHANGE: Replace 'your_secure_password_here' with your actual password
DATABASE_URL=postgresql://ledgerlm_user:your_secure_password_here@localhost:5432/ledgerlm

# ===========================================
# OPENAI API KEY (Required for AI features)
# ===========================================
# Get your key from: https://platform.openai.com/api-keys
# CHANGE: Replace with your actual OpenAI API key
OPENAI_API_KEY=sk-your-openai-api-key-here

# ===========================================
# SESSION SECURITY
# ===========================================
# Generate a random string (32+ characters)
# CHANGE: Replace with a long random string
SESSION_SECRET=replace-with-a-very-long-random-string-at-least-32-characters

# ===========================================
# PYTHON BACKEND URL
# ===========================================
# Keep as localhost for local development
PYTHON_API_URL=http://localhost:8000

# ===========================================
# SERVER CONFIGURATION
# ===========================================
PORT=5000
NODE_ENV=development

# ===========================================
# EMAIL CONFIGURATION (Optional)
# ===========================================
# Only needed if you want email login to work
# SMTP_HOST=smtp.your-email-provider.com
# SMTP_PORT=465
# SMTP_USER=your-email@example.com
# SMTP_PASS=your-email-password
# EMAIL_FROM=noreply@yourdomain.com
```

### What to Change (Summary):
| Line | What to Change | Example |
|------|----------------|---------|
| `DATABASE_URL` | Replace password | `...ledgerlm_user:MyP@ssw0rd123@localhost...` |
| `OPENAI_API_KEY` | Your OpenAI key | `sk-proj-abc123...` |
| `SESSION_SECRET` | Random 32+ chars | `a7b3c9d2e5f8g1h4j6k8m0n3p5q7r9s2t4` |

### Verification:
Open the file and check:
- [ ] DATABASE_URL has your actual password
- [ ] OPENAI_API_KEY starts with `sk-`
- [ ] SESSION_SECRET is at least 32 characters

---

## Step 3.2: Install Node.js Dependencies

### Navigation:
1. Open Terminal/Command Prompt
2. Navigate to project folder

### Commands:
```bash
# Windows:
cd C:\Projects\LedgerLM

# Mac/Linux:
cd ~/Projects/LedgerLM

# Install dependencies
npm install
```

### Expected Outcome:
```
added 500+ packages in 2m
```
(Numbers may vary)

### Acceptance Criteria:
- [ ] No ERROR messages (warnings are OK)
- [ ] `node_modules/` folder created
- [ ] Message shows "added XXX packages"

---

## Step 3.3: Install Python Dependencies

### Navigation:
```bash
cd python_backend
```

### Commands:
```bash
# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate

# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### If requirements.txt is missing, run:
```bash
pip install fastapi uvicorn openai psycopg2-binary pandas openpyxl pdfplumber python-multipart aiofiles tiktoken numpy scipy beautifulsoup4 lxml requests python-dotenv pydantic pydantic-settings
```

### Expected Outcome:
```
Successfully installed fastapi-0.x.x uvicorn-0.x.x ...
```

### Acceptance Criteria:
- [ ] No ERROR messages
- [ ] Can run `python -c "import fastapi; print('OK')"`

---

## Step 3.4: Initialize Database Tables

### Navigation:
Go back to main project folder:
```bash
cd ..
# or
cd C:\Projects\LedgerLM
```

### Command:
```bash
npm run db:push
```

### Expected Outcome:
```
[✓] Changes applied
```
Or list of tables being created

### Acceptance Criteria:
- [ ] No connection errors
- [ ] Shows tables created or "no changes"

### Verification - Check Tables Exist:
```bash
psql -U ledgerlm_user -d ledgerlm -h localhost -c "\dt"
```

### Expected Outcome:
List of tables including:
- users
- enterprise_documents
- cube_fact_data
- cube_ingestion_jobs
- (and more)

---

## Step 3.5: Create Uploads Folder

### Commands:
```bash
# In project root folder
mkdir -p uploads

# Mac/Linux - set permissions:
chmod 755 uploads
```

### Verification:
- [ ] Folder `uploads/` exists in project root

---

# PART 4: Start the Application Locally

## Step 4.1: Start Python Backend

### Open Terminal 1:
```bash
cd C:\Projects\LedgerLM\python_backend
# or
cd ~/Projects/LedgerLM/python_backend

# Activate virtual environment (if you created one)
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Start the server
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Expected Outcome:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Application startup complete.
```

### Acceptance Criteria:
- [ ] No ERROR messages
- [ ] Shows "running on http://0.0.0.0:8000"

### Keep this terminal open!

---

## Step 4.2: Start Node.js Server

### Open Terminal 2 (New Window):
```bash
cd C:\Projects\LedgerLM
# or
cd ~/Projects/LedgerLM

# Start the server
npm run dev
```

### Expected Outcome:
```
[express] serving on port 5000
Starting Python backend on port 8000...
Python backend started successfully
```

### Acceptance Criteria:
- [ ] Shows "serving on port 5000"
- [ ] No database connection errors

### Keep this terminal open!

---

## Step 4.3: Access the Application

### Open Web Browser:
Go to: `http://localhost:5000`

### Expected Outcome:
LedgerLM login page appears

### Acceptance Criteria:
- [ ] Page loads without errors
- [ ] Can see login form or dashboard

---

# PART 5: Testing Checklist (Local)

## Test 1: Application Loads
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open browser | Browser opens |
| 2 | Go to `http://localhost:5000` | Page starts loading |
| 3 | Wait 5 seconds | Login page or dashboard appears |

**Pass Criteria:** Page loads completely without error messages

---

## Test 2: Python Backend Health Check
### Command:
```bash
curl http://localhost:8000/api/v2/semantic-sql/health
```

### Expected Response:
```json
{"status":"healthy","service":"semantic_sql","cubes_available":0}
```

**Pass Criteria:** Returns JSON with `"status":"healthy"`

---

## Test 3: Database Connection
### Command:
```bash
curl http://localhost:5000/api/health
```

### Expected Response:
```json
{"status":"ok"}
```

**Pass Criteria:** Returns 200 OK response

---

## Test 4: File Upload (After Login)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in to application | Dashboard appears |
| 2 | Go to Enterprise Data section | Document list page |
| 3 | Upload small Excel file | File appears in list |
| 4 | Wait for processing | Status shows "completed" |

**Pass Criteria:** File uploads and processes without errors

---

## Test 5: SQL Ingestion
### Command (after uploading a file):
```bash
curl -X POST "http://localhost:8000/api/v2/semantic-sql/intent" \
  -H "Content-Type: application/json" \
  -d '{"cube_id": "YOUR_CUBE_ID", "query": "show total by month"}'
```

### Expected Response:
```json
{"success":true,"structured_query":{...}}
```

**Pass Criteria:** Returns `"success": true`

---

# PART 6: Deploy to Production Server

## Step 6.1: Prepare Production Server

### Minimum Requirements:
- **OS:** Ubuntu 20.04/22.04 LTS or CentOS 8+
- **RAM:** 4 GB minimum (8 GB recommended)
- **Storage:** 50 GB minimum
- **CPU:** 2 cores minimum

### Install Prerequisites on Server:
(Repeat Steps 2.1 - 2.4 on your server)

---

## Step 6.2: Transfer Files to Server

### Option A: Using SCP (Secure Copy)
```bash
# From your local machine:
scp -r ~/Projects/LedgerLM user@your-server-ip:/home/user/
```

### Option B: Using Git
```bash
# On local machine - initialize git and push:
cd ~/Projects/LedgerLM
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/ledgerlm.git
git push -u origin main

# On server - clone:
git clone https://github.com/your-username/ledgerlm.git
```

### Option C: Using SFTP/FTP Client
1. Download FileZilla: https://filezilla-project.org/
2. Connect to your server
3. Upload entire LedgerLM folder

---

## Step 6.3: Configure Production Environment

### Create Production .env file on server:
```bash
cd /home/user/LedgerLM
nano .env
```

### Production .env Content:
```env
# ===========================================
# PRODUCTION DATABASE
# ===========================================
DATABASE_URL=postgresql://ledgerlm_user:PRODUCTION_PASSWORD@localhost:5432/ledgerlm

# ===========================================
# OPENAI API KEY
# ===========================================
OPENAI_API_KEY=sk-your-production-openai-key

# ===========================================
# SESSION SECURITY (Use different from development!)
# ===========================================
SESSION_SECRET=production-very-long-random-string-different-from-dev

# ===========================================
# PYTHON BACKEND
# ===========================================
PYTHON_API_URL=http://localhost:8000

# ===========================================
# PRODUCTION SETTINGS
# ===========================================
PORT=5000
NODE_ENV=production
```

---

## Step 6.4: Install Process Manager (PM2)

```bash
# Install PM2 globally
sudo npm install -g pm2
```

---

## Step 6.5: Create PM2 Configuration

### Create file: `ecosystem.config.js`
```javascript
module.exports = {
  apps: [
    {
      name: 'ledgerlm-node',
      script: 'npm',
      args: 'run dev',
      cwd: '/home/user/LedgerLM',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'ledgerlm-python',
      script: 'python',
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8000',
      cwd: '/home/user/LedgerLM/python_backend',
      interpreter: '/home/user/LedgerLM/python_backend/venv/bin/python'
    }
  ]
};
```

---

## Step 6.6: Start Services with PM2

```bash
cd /home/user/LedgerLM

# Start all services
pm2 start ecosystem.config.js

# Save configuration
pm2 save

# Enable auto-start on reboot
pm2 startup
# (Follow the command it outputs)
```

### Verification:
```bash
pm2 status
```

### Expected Outcome:
```
┌─────────────────┬────┬──────┬──────────┐
│ name            │ id │ mode │ status   │
├─────────────────┼────┼──────┼──────────┤
│ ledgerlm-node   │ 0  │ fork │ online   │
│ ledgerlm-python │ 1  │ fork │ online   │
└─────────────────┴────┴──────┴──────────┘
```

**Pass Criteria:** Both services show "online" status

---

## Step 6.7: Setup Nginx Reverse Proxy (Optional but Recommended)

### Install Nginx:
```bash
sudo apt install nginx
```

### Create Nginx Configuration:
```bash
sudo nano /etc/nginx/sites-available/ledgerlm
```

### Configuration Content:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # CHANGE THIS

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeout for large file uploads
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        client_max_body_size 500M;
    }
}
```

### Enable Site:
```bash
sudo ln -s /etc/nginx/sites-available/ledgerlm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 6.8: Setup SSL Certificate (HTTPS)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is automatic
```

---

# PART 7: Production Testing Checklist

## Test 1: Server Accessibility
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open browser | Browser opens |
| 2 | Go to `https://your-domain.com` | Page loads |
| 3 | Check for HTTPS | Lock icon in address bar |

**Pass Criteria:** Site loads with HTTPS

---

## Test 2: Services Running
```bash
pm2 status
```

**Pass Criteria:** Both services show "online"

---

## Test 3: Database Connected
```bash
pm2 logs ledgerlm-node --lines 50
```

**Pass Criteria:** No "database connection" errors

---

## Test 4: Full Workflow Test
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login with email | Receives login email |
| 2 | Access dashboard | Dashboard loads |
| 3 | Upload Excel file | File shows in list |
| 4 | Wait for processing | Status: "completed" |
| 5 | Ask AI question | Returns real data |

---

# PART 8: Acceptance Criteria Summary

## Infrastructure Criteria
- [ ] Node.js 18+ installed
- [ ] Python 3.11 installed
- [ ] PostgreSQL running
- [ ] Database and user created
- [ ] All tables created

## Application Criteria
- [ ] Application loads at correct URL
- [ ] No console errors in browser
- [ ] Login/authentication works
- [ ] File upload works
- [ ] SQL ingestion completes

## Production Criteria
- [ ] PM2 services running
- [ ] Auto-restart on reboot enabled
- [ ] HTTPS enabled (if using domain)
- [ ] Logs accessible via `pm2 logs`

## Performance Criteria
- [ ] Page loads in < 5 seconds
- [ ] File upload completes (500MB file in < 10 minutes)
- [ ] AI queries respond in < 30 seconds

---

# PART 9: Troubleshooting

## Common Issues

### Issue: "npm: command not found"
**Solution:** Reinstall Node.js, ensure PATH is set

### Issue: "Database connection refused"
**Solution:** 
1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Verify DATABASE_URL in .env
3. Check password is correct

### Issue: "OPENAI_API_KEY invalid"
**Solution:** Get new key from https://platform.openai.com/api-keys

### Issue: "Port 5000 already in use"
**Solution:** 
```bash
# Find what's using port 5000
lsof -i :5000
# Kill the process
kill -9 <PID>
```

### Issue: "Python module not found"
**Solution:** 
```bash
cd python_backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### Issue: "502 Bad Gateway" (Nginx)
**Solution:** Check if Node.js is running: `pm2 status`

---

# Quick Reference Commands

```bash
# Check service status
pm2 status

# View logs
pm2 logs ledgerlm-node
pm2 logs ledgerlm-python

# Restart services
pm2 restart all

# Stop services
pm2 stop all

# Check database
psql -U ledgerlm_user -d ledgerlm -c "SELECT COUNT(*) FROM users;"

# Test Python backend
curl http://localhost:8000/api/v2/semantic-sql/health

# Test Node.js backend
curl http://localhost:5000/api/health
```

---

*Last Updated: December 2025*
*Version: 1.0*
