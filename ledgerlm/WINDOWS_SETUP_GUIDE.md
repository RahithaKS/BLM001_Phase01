# Complete Setup Guide: Running LedgerLM on Windows

This guide will help you run the LedgerLM application on your Windows laptop from scratch. No technical knowledge needed - just follow each step carefully.

---

## What You'll Need

- A Windows laptop (Windows 10 or 11)
- Internet connection
- About 1-2 hours for first-time setup
- Administrator access to install software

---

## Part 1: Installing Required Software

### Step 1.1: Install Node.js

Node.js is needed to run the application's frontend and backend.

1. **Open your web browser** (Chrome, Edge, etc.)

2. **Go to**: https://nodejs.org/

3. **Download**:
   - You'll see two big green buttons
   - Click the one that says **"LTS"** (Long Term Support)
   - Example: "20.11.1 LTS"

4. **Run the installer**:
   - Find the downloaded file in your Downloads folder
   - Double-click `node-v20.x.x-x64.msi`
   - Click **"Next"** through all screens
   - **IMPORTANT**: Keep all checkboxes checked (especially "Add to PATH")
   - Click **"Install"**
   - Wait 2-3 minutes
   - Click **"Finish"**

5. **Verify it worked**:
   - Press `Windows key` on your keyboard
   - Type: `cmd`
   - Press `Enter` (this opens Command Prompt)
   - Type: `node --version`
   - Press `Enter`
   - You should see something like: `v20.11.1`
   - Type: `npm --version`
   - Press `Enter`
   - You should see something like: `10.2.4`
   - If you see version numbers, SUCCESS! ✅
   - Type: `exit` and press Enter to close

---

### Step 1.2: Install Python

Python is needed for document processing and AI features.

1. **Go to**: https://www.python.org/downloads/

2. **Download**:
   - Click the big yellow button: **"Download Python 3.11.x"**
   - (Version 3.10 or 3.11 both work)

3. **Run the installer**:
   - Find the downloaded file in Downloads
   - Double-click `python-3.11.x-amd64.exe`
   - **CRITICAL**: At the bottom, CHECK the box that says:
     ✅ **"Add Python to PATH"** ← This is VERY important!
   - Click **"Install Now"**
   - Wait 3-5 minutes
   - Click **"Close"**

4. **Verify it worked**:
   - Press `Windows key`
   - Type: `cmd`
   - Press `Enter`
   - Type: `python --version`
   - Press `Enter`
   - You should see: `Python 3.11.x`
   - Type: `pip --version`
   - Press `Enter`
   - You should see: `pip 23.x.x`
   - If you see version numbers, SUCCESS! ✅
   - Type: `exit` to close

---

### Step 1.3: Install PostgreSQL Database

PostgreSQL is the database that stores all your data.

1. **Go to**: https://www.postgresql.org/download/windows/

2. **Click**: "Download the installer"

3. **Download**:
   - Click on **PostgreSQL 16.x** (or 15.x)
   - Choose **Windows x86-64**
   - Download will start (about 300MB)

4. **Run the installer**:
   - Double-click the downloaded file
   - Click **"Next"**
   
5. **Installation Directory**:
   - Keep the default: `C:\Program Files\PostgreSQL\16`
   - Click **"Next"**

6. **Select Components**:
   - Keep all checkboxes checked
   - Make sure **"pgAdmin 4"** is checked
   - Click **"Next"**

7. **Data Directory**:
   - Keep the default
   - Click **"Next"**

8. **Password** (VERY IMPORTANT):
   - You'll be asked to set a password for the "postgres" user
   - Choose a simple password you'll remember (example: `admin123`)
   - **WRITE IT DOWN** - you'll need this later!
   - Type it twice to confirm
   - Click **"Next"**

9. **Port**:
   - Keep default: `5432`
   - Click **"Next"**

10. **Locale**:
    - Keep default: `[Default locale]`
    - Click **"Next"**

11. **Ready to Install**:
    - Click **"Next"**
    - Installation takes 5-10 minutes
    - Click **"Finish"**
    - Uncheck "Launch Stack Builder" if it appears

12. **Verify it worked**:
    - Press `Windows key`
    - Type: `cmd`
    - Press `Enter`
    - Type: `psql --version`
    - Press `Enter`
    - You should see: `psql (PostgreSQL) 16.x`
    - If it says "command not found", we need to add to PATH (see troubleshooting below)

**Troubleshooting - If psql command not found**:
1. Press `Windows key`
2. Type: `environment variables`
3. Click **"Edit the system environment variables"**
4. Click **"Environment Variables"** button
5. Under "System variables", find **"Path"**, click **"Edit"**
6. Click **"New"**
7. Add: `C:\Program Files\PostgreSQL\16\bin`
8. Click **"OK"** on all windows
9. Close and reopen Command Prompt
10. Try `psql --version` again

---

### Step 1.4: Install pgvector Extension

pgvector enables AI document search using vector similarity.

1. **Download pgvector**:
   - Go to: https://github.com/pgvector/pgvector/releases
   - Look for the latest release (example: v0.5.1)
   - Scroll down to "Assets"
   - Download: **`pgvector-v0.5.1-windows-x64.zip`**

2. **Extract the files**:
   - Go to your Downloads folder
   - Right-click the zip file
   - Choose **"Extract All"**
   - Click **"Extract"**

3. **Copy files to PostgreSQL**:
   - Open the extracted folder
   - You'll see several files (`.dll`, `.sql`, etc.)
   
   **Copy DLL files**:
   - Find files ending in `.dll`
   - Copy them
   - Navigate to: `C:\Program Files\PostgreSQL\16\lib`
   - Paste the files there
   - If asked for administrator permission, click **"Continue"**
   
   **Copy SQL/Control files**:
   - Find files ending in `.sql` and `.control`
   - Copy them
   - Navigate to: `C:\Program Files\PostgreSQL\16\share\extension`
   - Paste the files there
   - If asked for administrator permission, click **"Continue"**

4. **Restart PostgreSQL**:
   - Press `Windows key`
   - Type: `services`
   - Open **"Services"** app
   - Scroll down and find **"postgresql-x64-16"**
   - Right-click it
   - Choose **"Restart"**
   - Wait for it to say "Running"

---

### Step 1.5: Install VS Code

VS Code is where you'll open and edit the application code.

1. **Go to**: https://code.visualstudio.com/

2. **Download**:
   - Click the big blue button: **"Download for Windows"**

3. **Run the installer**:
   - Double-click the downloaded file
   - Accept the agreement
   - Click **"Next"**
   - Keep default location
   - Click **"Next"**
   - **IMPORTANT**: Check these boxes:
     ✅ Add "Open with Code" action to Windows Explorer file context menu
     ✅ Add "Open with Code" action to Windows Explorer directory context menu
     ✅ Add to PATH
   - Click **"Next"**
   - Click **"Install"**
   - Click **"Finish"**

---

### Step 1.6: Install Tesseract OCR

Tesseract enables reading text from images and scanned documents.

1. **Go to**: https://github.com/UB-Mannheim/tesseract/wiki

2. **Download**:
   - Click the link for latest Windows installer
   - Example: `tesseract-ocr-w64-setup-5.3.1.exe`

3. **Run the installer**:
   - Double-click the file
   - Keep default location: `C:\Program Files\Tesseract-OCR`
   - Click **"Next"** through all screens
   - Click **"Install"**
   - Click **"Finish"**

4. **Add to PATH**:
   - Press `Windows key`
   - Type: `environment variables`
   - Click **"Edit the system environment variables"**
   - Click **"Environment Variables"**
   - Under "System variables", find **"Path"**, click **"Edit"**
   - Click **"New"**
   - Add: `C:\Program Files\Tesseract-OCR`
   - Click **"OK"** on all windows

---

## Part 2: Setting Up the Database

### Step 2.1: Create the Database

1. **Open Command Prompt as Administrator**:
   - Press `Windows key`
   - Type: `cmd`
   - **Right-click** on "Command Prompt"
   - Choose **"Run as administrator"**
   - Click **"Yes"** if asked

2. **Connect to PostgreSQL**:
   - Type: `psql -U postgres`
   - Press `Enter`
   - It will ask for password
   - Type the password you set earlier (example: `admin123`)
   - Press `Enter`
   - You should see: `postgres=#`

3. **Create the database**:
   - Type exactly: `CREATE DATABASE ledgerlm;`
   - Press `Enter`
   - You should see: `CREATE DATABASE`

4. **Connect to the new database**:
   - Type: `\c ledgerlm`
   - Press `Enter`
   - You should see: `You are now connected to database "ledgerlm"`

5. **Enable pgvector extension**:
   - Type: `CREATE EXTENSION IF NOT EXISTS vector;`
   - Press `Enter`
   - You should see: `CREATE EXTENSION`

6. **Verify it worked**:
   - Type: `\dx`
   - Press `Enter`
   - You should see "vector" in the list

7. **Exit**:
   - Type: `\q`
   - Press `Enter`
   - Type: `exit`
   - Press `Enter`

**Your database is ready!** ✅

---

## Part 3: Setting Up the Application

### Step 3.1: Get Your Copy of the Code

If you downloaded the code as a ZIP file:
1. Extract it to a location like: `C:\Users\YourName\Desktop\LedgerLM`

If you're using Git:
1. Open Command Prompt
2. Navigate to where you want the code: `cd Desktop`
3. Clone: `git clone <repository-url>`

### Step 3.2: Open in VS Code

1. **Open VS Code**
2. Click **"File"** → **"Open Folder"**
3. Navigate to your LedgerLM folder
4. Click **"Select Folder"**
5. If asked "Do you trust the authors", click **"Yes, I trust"**

You should now see all the files in the left sidebar.

---

### Step 3.3: Fix package.json for Windows

Windows doesn't understand Unix-style environment variables, so we need to fix the scripts.

1. **In VS Code**, find `package.json` in the left sidebar
2. **Click** to open it
3. **Find** these lines (around line 7-8):
   ```json
   "dev": "NODE_ENV=development tsx server/index.ts",
   "start": "NODE_ENV=production node dist/index.js",
   ```

4. **Change them to**:
   ```json
   "dev": "cross-env NODE_ENV=development tsx server/index.ts",
   "start": "cross-env NODE_ENV=production node dist/index.js",
   ```
   
   Just add `cross-env ` before `NODE_ENV` on both lines.

5. **Save the file**: Press `Ctrl+S`

---

### Step 3.4: Create Environment Variables

The app needs to know how to connect to your database and AI services.

#### Step 3.4a: Get Your OpenAI API Key

1. **Go to**: https://platform.openai.com/
2. **Sign in** or create an account
3. **Click** your profile icon (top right)
4. **Click** "API keys"
5. **Click** "Create new secret key"
6. **Give it a name**: "LedgerLM"
7. **Click** "Create"
8. **COPY the key** (starts with `sk-...`)
9. **Save it somewhere** - you can't see it again!

#### Step 3.4b: Create Main .env File

1. **In VS Code**, right-click in the file explorer (left side)
2. **Choose** "New File"
3. **Name it exactly**: `.env` (yes, with the dot at the start)
4. **Copy and paste this** into the file:

```env
# Database Connection
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/ledgerlm

# OpenAI API Key (Required for AI features)
OPENAI_API_KEY=sk-your-actual-api-key-here

# Google Search (Optional - for web search feature)
GOOGLE_API_KEY=
GOOGLE_CSE_ID=

# Server Port
PORT=5000
```

5. **Edit the values**:
   - Replace `YOUR_PASSWORD` with your PostgreSQL password (example: `admin123`)
   - Replace `sk-your-actual-api-key-here` with your real OpenAI API key
   - Leave Google keys empty if you don't have them (optional feature)

6. **Save the file**: Press `Ctrl+S`

**Example of what it should look like**:
```env
DATABASE_URL=postgresql://postgres:admin123@localhost:5432/ledgerlm
OPENAI_API_KEY=sk-proj-abc123xyz456...
GOOGLE_API_KEY=
GOOGLE_CSE_ID=
PORT=5000
```

#### Step 3.4c: Create Python .env File

1. **In VS Code**, navigate to the `python_backend` folder
2. **Right-click** inside that folder
3. **Choose** "New File"
4. **Name it**: `.env`
5. **Copy and paste**:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/ledgerlm
OPENAI_API_KEY=sk-your-actual-api-key-here
GOOGLE_API_KEY=
GOOGLE_CSE_ID=
```

6. **Use the SAME values** as the main .env file
7. **Save**: Press `Ctrl+S`

---

### Step 3.5: Install Node.js Packages

1. **In VS Code**, open a terminal:
   - Click **"Terminal"** menu at top
   - Click **"New Terminal"**
   - You'll see a terminal at the bottom

2. **Make sure you're in the project folder**:
   - The terminal should show your project path
   - Example: `C:\Users\YourName\Desktop\LedgerLM>`

3. **Install packages**:
   - Type: `npm install`
   - Press `Enter`
   - Wait 3-5 minutes
   - You'll see lots of text scrolling
   - When it finishes, you should see something like: `added 500 packages`

**If you see any WARNINGS** - that's okay, ignore them.
**If you see ERRORS** - that's a problem, let me know.

---

### Step 3.6: Install Python Packages

1. **In the same terminal**, type:
   ```
   cd python_backend
   ```
   Press `Enter`

2. **Install Python packages**:
   - Type: `pip install -r requirements.txt`
   - Press `Enter`
   - Wait 5-10 minutes
   - Lots of text will scroll

3. **Go back to main folder**:
   - Type: `cd ..`
   - Press `Enter`

---

### Step 3.7: Setup Database Tables

The app needs to create all the tables in your database.

1. **In the terminal**, type:
   ```
   npm run db:push
   ```
   Press `Enter`

2. **Wait** 10-30 seconds

3. **You should see**: `✓ Success!` or similar message

This creates all the tables for users, documents, chats, etc.

---

## Part 4: Running the Application

You need to run TWO programs at the same time:
1. Node.js server (frontend + backend)
2. Python server (document processing + AI)

### Step 4.1: Start Node.js Server

1. **In VS Code terminal**, type:
   ```
   npm run dev
   ```
   Press `Enter`

2. **Wait** 20-30 seconds

3. **Look for**:
   ```
   serving on port 5000
   ```

**Leave this terminal running!** Don't close it.

---

### Step 4.2: Start Python Server

1. **In VS Code**, open a NEW terminal:
   - Click the **"+"** button at the top right of the terminal
   - OR: Click **"Terminal"** → **"New Terminal"**

2. **Navigate to Python folder**:
   - Type: `cd python_backend`
   - Press `Enter`

3. **Start Python server**:
   - Type: `python -m uvicorn main:app --reload --port 8001`
   - Press `Enter`

4. **Wait** 10-20 seconds

5. **Look for**:
   ```
   Uvicorn running on http://0.0.0.0:8001
   Application startup complete
   ```

**Leave this terminal running too!**

---

### Step 4.3: Open the Application

1. **Open your web browser**
2. **Go to**: `http://localhost:5000`
3. **You should see** the LedgerLM login screen!

🎉 **SUCCESS! The app is running!**

---

## Part 5: First Time Use

### Step 5.1: Create Your Account

1. On the login screen, enter:
   - Email: `admin@ledgerlm.com` (or any email you want)
   - Password: `admin123` (or any password)
   - Display Name: `Your Name`

2. Click **"Sign In"**

3. You'll see the dashboard!

### Step 5.2: Upload a Document

1. Click on **"Vault"** in the sidebar
2. Click **"Upload Document"**
3. Choose a PDF or Excel file
4. Wait for it to upload
5. You'll see "Processing..." then "Ready: X chunks"

### Step 5.3: Chat with Your Document

1. Go back to **"Home"**
2. Click **"Start New Chat"**
3. Attach your document (paperclip icon)
4. Ask a question: "Summarize this document"
5. Watch the AI analyze it!

---

## Part 6: Stopping the Application

When you're done:

1. **In each terminal**, press: `Ctrl+C`
2. This stops the servers
3. **Close VS Code**

---

## Part 7: Starting Again Later

Next time you want to use the app:

1. **Open VS Code**
2. **Open your LedgerLM folder**
3. **Open terminal** (Terminal → New Terminal)
4. **Terminal 1**: Type `npm run dev` and press Enter
5. **Terminal 2**: Click "+", type `cd python_backend`, press Enter, then type `python -m uvicorn main:app --reload --port 8001` and press Enter
6. **Open browser**: Go to `http://localhost:5000`

---

## Troubleshooting Common Issues

### Issue: "npm is not recognized"
**Solution**:
1. Close VS Code completely
2. Reopen it
3. Try again

If still doesn't work:
1. Reinstall Node.js
2. Make sure you checked "Add to PATH"

---

### Issue: "python is not recognized"
**Solution**:
1. Close VS Code
2. Reopen it
3. Try again

If still doesn't work:
1. Reinstall Python
2. CHECK the box "Add Python to PATH"

---

### Issue: "psql: command not found"
**Solution**:
1. Add PostgreSQL to PATH (see Step 1.3 troubleshooting)
2. Restart Command Prompt

---

### Issue: "Could not connect to database"
**Solution**:
1. Make sure PostgreSQL is running:
   - Press Windows key
   - Type: `services`
   - Find "postgresql-x64-16"
   - Make sure it says "Running"
   - If not, right-click → Start

2. Check your .env file:
   - Make sure DATABASE_URL has correct password
   - Make sure it says `localhost:5432`

---

### Issue: "Port 5000 already in use"
**Solution**:
1. Change PORT in .env file to 5001 or 3000
2. Restart the server
3. Open browser to the new port

---

### Issue: Python server won't start
**Solution**:
1. Make sure you're in python_backend folder: `cd python_backend`
2. Make sure Python packages are installed: `pip install -r requirements.txt`
3. Check that .env file exists in python_backend folder

---

### Issue: "No documents found" when asking questions
**Solution**:
1. Make sure document shows "Ready: X chunks" (not "Processing")
2. Wait 30 seconds after upload before asking questions
3. Make sure both servers are running (Node.js AND Python)

---

## Quick Reference Commands

**Start the app**:
```bash
# Terminal 1
npm run dev

# Terminal 2
cd python_backend
python -m uvicorn main:app --reload --port 8001
```

**Stop the app**:
- Press `Ctrl+C` in both terminals

**Check if database is running**:
```bash
psql -U postgres -d ledgerlm
\q
```

**Reinstall packages if something breaks**:
```bash
npm install
cd python_backend
pip install -r requirements.txt
cd ..
```

---

## Getting Help

If you get stuck:
1. Take a screenshot of the error
2. Note which step you're on
3. Check the troubleshooting section above
4. Ask for help with the specific error message

---

## Summary Checklist

Before running the app, make sure:
- ✅ Node.js installed and `node --version` works
- ✅ Python installed and `python --version` works
- ✅ PostgreSQL installed and running
- ✅ pgvector extension installed
- ✅ Database "ledgerlm" created with vector extension
- ✅ VS Code installed
- ✅ package.json has `cross-env` in scripts
- ✅ .env file created in root folder with DATABASE_URL
- ✅ .env file created in python_backend folder
- ✅ `npm install` completed successfully
- ✅ `pip install -r requirements.txt` completed
- ✅ `npm run db:push` completed successfully
- ✅ OpenAI API key added to .env files

If all these are checked, you're ready to run `npm run dev`!

---

**You're all set! Enjoy using LedgerLM!** 🚀
