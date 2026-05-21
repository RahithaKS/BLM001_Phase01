# LedgerLM - Quick Start Checklist (Windows)

## Prerequisites (Install These First)

```
✅ Node.js v20.x      → https://nodejs.org/
✅ Python 3.11        → https://www.python.org/ (CHECK "Add to PATH")
✅ PostgreSQL 17      → https://www.postgresql.org/download/windows/
✅ VS Code            → https://code.visualstudio.com/
```

---

## Setup Commands (Run in Order)

### 1. Download & Extract
```bash
# Download ZIP from Replit → Extract to Desktop\LedgerLM
```

### 2. Create Database
```bash
# Open Command Prompt (Admin)
psql -U postgres
CREATE DATABASE ledgerlm;
\c ledgerlm
CREATE EXTENSION vector;
\q
```

### 3. Create .env File
Create `.env` in project root:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/ledgerlm?sslmode=disable
NODE_ENV=development
SESSION_SECRET=change-this-secret-key
OPENAI_API_KEY=sk-your-key-here
```

### 4. Install Dependencies
```bash
# Open VS Code → Open project folder → Terminal
npm install
pip install -r requirements.txt
```

### 5. Setup Database Schema
```bash
npm run db:push
```

### 6. Start the App
```bash
npm run dev
```

### 7. Open Browser
```
http://localhost:5000

Login:
Email: admin@ledgerlm.com
Password: admin123
```

---

## Daily Usage

```bash
# 1. Open VS Code
# 2. Open project folder
# 3. Open Terminal (Ctrl + `)
npm run dev

# 4. Open browser: http://localhost:5000
```

---

## Common Fixes

**"node not recognized"** → Restart computer after Node.js install

**"python not recognized"** → Reinstall Python, CHECK "Add to PATH"

**"psql not recognized"** → Add `C:\Program Files\PostgreSQL\17\bin` to PATH

**Database error** → Check PostgreSQL service is running (services.msc)

**Module not found** → Delete `node_modules` and run `npm install` again

---

## Get OpenAI API Key

1. Go to: https://platform.openai.com/api-keys
2. Sign up / Login
3. Click "Create new secret key"
4. Copy key → Paste in `.env` file

---

## File Structure

```
LedgerLM/
├── .env              ← YOU CREATE THIS (environment variables)
├── client/           ← Frontend (React)
├── server/           ← Backend (Express)
├── python_backend/   ← AI & RAG (FastAPI)
├── shared/           ← Database schema
└── package.json      ← Dependencies
```

---

**See WINDOWS_SETUP_GUIDE.md for detailed explanations**
