# 🚀 LedgerLM Deployment for Bosch - Complete Beginner's Guide

**For someone with ZERO experience in Azure, Git, or technical deployment**

This guide assumes you know:
- ✅ How to use a web browser
- ✅ How to install software on Windows
- ✅ How to download files
- ❌ Nothing about Azure, Git, Docker, or command line!

**Estimated Time:** 4-6 hours (first time)

---

## 📋 **Before You Start - What You'll Need**

### From Bosch IT Department

Call or email your Bosch IT support and request:

**Email Template:**
```
Subject: Azure Account Access for LedgerLM Deployment

Hi IT Team,

I need to deploy the LedgerLM application on Azure. Please provide:

1. Azure Portal access (username and password)
2. Permission to create Virtual Machines
3. Permission to create databases
4. A domain name: ledgerlm.bosch.com (or similar)
5. Budget approval for ~$250/month Azure costs

Project: LedgerLM (AI Financial Analysis Platform)
Department: Finance
Requester: [Your Name]

Thank you!
```

Wait for IT to give you:
- ✅ Azure login credentials
- ✅ Confirmation you can create VMs
- ✅ Domain name assigned

### API Keys You'll Need

**Get these before starting:**

1. **OpenAI API Key**
   - Website: https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Copy the key (looks like: sk-proj-abc123...)
   - Cost: ~$10-50/month depending on usage

2. **Anaplan Credentials**
   - Ask your Anaplan administrator for:
     - Username
     - Password
     - Workspace ID
     - Model ID
     - Process ID

3. **Email (SMTP) Details**
   - Ask Bosch IT for email server details:
     - SMTP Server: (e.g., smtp.office365.com)
     - Port: (usually 587 or 465)
     - Username: (e.g., ledgerlm@bosch.com)
     - Password: (email account password)

4. **Google Search API** (Optional)
   - Only if you want web search feature
   - Website: https://console.cloud.google.com
   - Not required for basic deployment

**Write all these down!** You'll need them later.

---

## 🖥️ **Part 1: Prepare Your Windows Computer**

### Step 1: Download and Install Required Software

#### 1.1 Install PuTTY (to connect to Azure server)

**What is PuTTY?** It lets you connect to the Azure server remotely.

1. **Go to:** https://www.putty.org/
2. **Click:** "Download PuTTY"
3. **Choose:** "64-bit x86" installer (putty-64bit-installer.msi)
4. **Download** the file
5. **Double-click** the downloaded file
6. **Click:** "Next" → "Next" → "Install" → "Finish"

✅ **Test:** Open Windows Start Menu → Type "PuTTY" → You should see it

#### 1.2 Install WinSCP (to transfer files to server)

**What is WinSCP?** It lets you drag-and-drop files to the Azure server.

1. **Go to:** https://winscp.net/eng/download.php
2. **Click:** "Download WinSCP"
3. **Choose:** "Installation package"
4. **Download** the file
5. **Double-click** the downloaded file
6. **Click:** "Accept" → "Next" → "Install" → "Finish"

✅ **Test:** Open Windows Start Menu → Type "WinSCP" → You should see it

#### 1.3 Install Git for Windows (to download the code)

**What is Git?** It downloads the LedgerLM code to your computer.

1. **Go to:** https://git-scm.com/download/win
2. **Download** starts automatically (Git-2.x.x-64-bit.exe)
3. **Double-click** the downloaded file
4. **Click:** "Next" for all questions (default settings are fine)
5. **Click:** "Install" → "Finish"

✅ **Test:** 
- Open Windows Start Menu
- Type "Command Prompt"
- Click "Command Prompt"
- Type: `git --version`
- Press Enter
- You should see: "git version 2.x.x"

### Step 2: Download LedgerLM Code to Your Computer

#### 2.1 Create a Folder for the Project

1. **Open:** File Explorer (Windows key + E)
2. **Go to:** This PC → Documents
3. **Right-click** in empty space
4. **Click:** New → Folder
5. **Name it:** `LedgerLM`
6. **Press Enter**

#### 2.2 Download the Code

**Option A: If you have the code on GitHub/GitLab**

1. **Open:** Command Prompt (Windows Start → Type "cmd")
2. **Type:** `cd Documents\LedgerLM`
3. **Press Enter**
4. **Type:** `git clone https://your-repository-url.git .`
   - Replace `https://your-repository-url.git` with your actual repository URL
5. **Press Enter**
6. Wait for download to complete

**Option B: If you have the code as a ZIP file**

1. **Copy** the ZIP file to `Documents\LedgerLM`
2. **Right-click** the ZIP file
3. **Click:** "Extract All"
4. **Click:** "Extract"

✅ **Check:** Open `Documents\LedgerLM` - you should see folders like:
- client
- server
- python_backend
- package.json
- etc.

### Step 3: Prepare Configuration File

1. **Open:** File Explorer → Documents → LedgerLM
2. **Find:** `.env.production.example`
   - If you can't see it, click "View" tab → Check "Hidden items"
3. **Right-click** `.env.production.example`
4. **Click:** "Open with" → "Notepad"
5. **Fill in your values** (from the API keys you collected):

```env
# Database
POSTGRES_PASSWORD=CreateAStrongPassword123!

# OpenAI
OPENAI_API_KEY=sk-proj-YOUR-KEY-HERE

# Email
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=ledgerlm@bosch.com
SMTP_PASSWORD=YourEmailPassword
SMTP_FROM=ledgerlm@bosch.com

# Session
SESSION_SECRET=MakeUpA32CharacterRandomString

# Anaplan
ANAPLAN_WORKSPACE_ID=YourWorkspaceID
ANAPLAN_MODEL_ID=YourModelID
ANAPLAN_PROCESS_ID=YourProcessID
ANAPLAN_USERNAME=YourAnaplanUsername
ANAPLAN_PASSWORD=YourAnaplanPassword
```

6. **Click:** File → Save As
7. **File name:** `.env.production` (exactly like this)
8. **Save as type:** All Files
9. **Click:** Save
10. **Close** Notepad

✅ **Check:** You should now have TWO files:
- `.env.production.example` (original)
- `.env.production` (your filled-in version)

---

## ☁️ **Part 2: Create Azure Virtual Machine**

### Step 1: Login to Azure Portal

1. **Open your web browser** (Chrome, Edge, Firefox)
2. **Go to:** https://portal.azure.com
3. **Enter** your Bosch email (given by IT)
4. **Click:** "Next"
5. **Enter** your password
6. **Click:** "Sign in"

**What you should see:**
- Azure Portal home page with blue header
- Search bar at top
- Icons for various services

**If you see an error:**
- Contact Bosch IT - your account may not be activated yet

### Step 2: Create a Virtual Machine

#### 2.1 Start Creating VM

1. **In the search bar at top**, type: `Virtual machines`
2. **Click:** "Virtual machines" (with computer icon)
3. **Click:** Blue "+ Create" button (top left)
4. **Click:** "Azure virtual machine"

#### 2.2 Fill in "Basics" Tab

**You'll see a form. Fill it in exactly like this:**

**Project details:**
- **Subscription:** Select your Bosch subscription (probably only one option)
- **Resource group:** 
  - Click "Create new"
  - Name: `ledgerlm-resources`
  - Click "OK"

**Instance details:**
- **Virtual machine name:** `ledgerlm-vm`
- **Region:** Choose closest to your location:
  - Europe: `(Europe) West Europe` or `North Europe`
  - US: `(US) East US` or `West US`
- **Availability options:** No infrastructure redundancy required
- **Security type:** Standard
- **Image:** Click dropdown → Search for "Ubuntu" → Select **"Ubuntu Server 22.04 LTS - x64 Gen2"**
- **Size:** 
  - Click "See all sizes"
  - Search for: `D4s_v3`
  - Select: **Standard_D4s_v3** (4 vCPUs, 16GB RAM)
  - Click "Select"

**Administrator account:**
- **Authentication type:** Click "SSH public key" (keep it selected)
- **Username:** `azureuser` (default is fine)
- **SSH public key source:** "Generate new key pair"
- **Key pair name:** `ledgerlm-ssh-key`

**Inbound port rules:**
- **Public inbound ports:** Select "Allow selected ports"
- **Select inbound ports:** Check these boxes:
  - ✅ HTTP (80)
  - ✅ HTTPS (443)
  - ✅ SSH (22)

**Picture of what you should see:**
```
┌─────────────────────────────────────┐
│ Create a virtual machine            │
├─────────────────────────────────────┤
│ Basics | Disks | Networking | ...   │
├─────────────────────────────────────┤
│ Virtual machine name: ledgerlm-vm   │
│ Region: (Europe) West Europe        │
│ Image: Ubuntu Server 22.04 LTS      │
│ Size: Standard_D4s_v3               │
│ Username: azureuser                 │
│ [Generate new key pair] button      │
└─────────────────────────────────────┘
```

5. **Click:** "Next: Disks >" button at bottom

#### 2.3 Configure Disks

**You'll see disk options:**

- **OS disk size:** Default (30GB) - leave as is
- **OS disk type:** **Standard SSD** (dropdown)
- **Encryption type:** (Default) - leave as is
- **Delete with VM:** ✅ Check this box

6. **Click:** "Next: Networking >" at bottom

#### 2.4 Configure Networking

**Public IP:**
- **Public IP:** (new) ledgerlm-vm-ip - leave as is

**NIC network security group:**
- Keep "Basic" selected

**Public inbound ports:**
- Should show: HTTP (80), HTTPS (443), SSH (22)
- (You set this earlier, just verify it's correct)

7. **Click:** "Review + create" button at bottom

#### 2.5 Review and Create

**You'll see a summary page:**

1. **Read** the summary (verify name, size, region)
2. **Look for** "Validation passed" green checkmark at top
3. **Click:** Blue "Create" button at bottom

**A popup will appear: "Generate new key pair"**

4. **Click:** "Download private key and create resource"
5. **Save the file** (ledgerlm-ssh-key.pem) to `Documents\LedgerLM`
   - **IMPORTANT:** Don't lose this file! You need it to connect to the server

**What happens next:**
- You'll see "Deployment is in progress"
- Wait 2-5 minutes
- **When you see:** "Your deployment is complete" → Success!

6. **Click:** "Go to resource" button

### Step 3: Get Your VM's IP Address

**You should now see your VM's overview page.**

1. **Look for** "Public IP address" on the right side
2. **Copy** the IP address (looks like: 20.123.45.67)
3. **Write it down** - you'll need this!

Example:
```
Public IP address: 20.123.45.67
```

---

## 🔌 **Part 3: Connect to Your Azure Server**

### Step 1: Convert SSH Key for PuTTY

**Why?** Azure gives you a .pem file, but PuTTY needs a .ppk file.

#### 1.1 Open PuTTYgen

1. **Open:** Windows Start Menu
2. **Type:** `PuTTYgen`
3. **Click:** "PuTTYgen"

#### 1.2 Convert the Key

1. **Click:** "Load" button
2. **Change** "File type" dropdown to "All Files (*.*)"
3. **Navigate to:** Documents → LedgerLM
4. **Select:** `ledgerlm-ssh-key.pem`
5. **Click:** "Open"
6. **You'll see:** "Successfully imported foreign key"
7. **Click:** "OK"
8. **Click:** "Save private key" button
9. **Click:** "Yes" (to save without passphrase)
10. **Save as:** `ledgerlm-ssh-key.ppk` (in same folder)
11. **Click:** "Save"
12. **Close** PuTTYgen

✅ **Check:** You should now have:
- ledgerlm-ssh-key.pem (original)
- ledgerlm-ssh-key.ppk (converted)

### Step 2: Connect with PuTTY

#### 2.1 Configure PuTTY

1. **Open:** PuTTY (Windows Start → Type "PuTTY")

**You'll see PuTTY Configuration window:**

2. **In "Host Name" box**, type: `azureuser@20.123.45.67`
   - Replace `20.123.45.67` with YOUR IP address from Step 3 above

3. **Port:** Keep as `22`
4. **Connection type:** Keep "SSH" selected

5. **In left sidebar**, click: **Connection** → **SSH** → **Auth** → **Credentials**

6. **Click:** "Browse" button next to "Private key file"
7. **Navigate to:** Documents → LedgerLM
8. **Select:** `ledgerlm-ssh-key.ppk`
9. **Click:** "Open"

10. **In left sidebar**, click: **Session** (back to top)

11. **In "Saved Sessions" box**, type: `LedgerLM-Bosch`
12. **Click:** "Save" button (to save these settings)

#### 2.2 Connect to Server

13. **Click:** "Open" button at bottom

**What happens next:**

- A black terminal window opens
- **First time only:** "PuTTY Security Alert" appears
  - **Click:** "Accept"
  
- You should see:
```
Welcome to Ubuntu 22.04.3 LTS
...
azureuser@ledgerlm-vm:~$
```

✅ **Success!** You're now connected to your Azure server!

**If you see errors:**
- "Connection refused" → Wait 5 minutes, try again (VM may still be starting)
- "Access denied" → Check you used the right .ppk file
- "Network error" → Check the IP address is correct

---

## 📦 **Part 4: Install PostgreSQL Database**

**You're now in the server terminal. We'll copy-paste commands.**

### Step 1: Update System

**In the PuTTY window**, type (or copy-paste) each command and press Enter:

```bash
sudo apt update && sudo apt upgrade -y
```

**What you'll see:**
- Lots of text scrolling
- Takes 2-5 minutes
- When done, you'll see `azureuser@ledgerlm-vm:~$` again

### Step 2: Install PostgreSQL

```bash
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
```

Press Enter, then:

```bash
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
```

Press Enter, then:

```bash
sudo apt update
```

Press Enter, then:

```bash
sudo apt install -y postgresql-16 postgresql-16-pgvector
```

Press Enter. When asked "Do you want to continue? [Y/n]", type `Y` and press Enter.

**This takes 3-5 minutes.**

✅ **Check it worked:**

```bash
sudo systemctl status postgresql
```

You should see:
```
● postgresql.service - PostgreSQL RDBMS
   Active: active (running)
```

Press `q` to exit.

### Step 3: Create Database

```bash
sudo -u postgres psql
```

**Your prompt will change to:** `postgres=#`

**Now type these commands one by one:**

```sql
CREATE DATABASE ledgerlm;
```

Press Enter. You should see: `CREATE DATABASE`

```sql
CREATE USER ledgerlm_app WITH PASSWORD 'YourStrongPassword123!';
```

**IMPORTANT:** Replace `YourStrongPassword123!` with the password you put in `.env.production` file!

Press Enter. You should see: `CREATE ROLE`

```sql
GRANT ALL PRIVILEGES ON DATABASE ledgerlm TO ledgerlm_app;
```

Press Enter. You should see: `GRANT`

```sql
\c ledgerlm
```

Press Enter. You should see: `You are now connected to database "ledgerlm"`

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Press Enter. You should see: `CREATE EXTENSION`

```sql
GRANT ALL ON SCHEMA public TO ledgerlm_app;
```

Press Enter. You should see: `GRANT`

```sql
\q
```

Press Enter. **You're back to:** `azureuser@ledgerlm-vm:~$`

✅ **Success!** Database is created!

---

## 🚀 **Part 5: Install Node.js and Python**

### Step 1: Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
```

Press Enter, wait for it to finish, then:

```bash
sudo apt install -y nodejs
```

Press Enter. Wait 2-3 minutes.

✅ **Check:**

```bash
node --version
```

Should show: `v20.x.x`

```bash
npm --version
```

Should show: `10.x.x`

### Step 2: Install Python and Tools

```bash
sudo apt install -y python3 python3-pip python3-venv python3-dev build-essential tesseract-ocr poppler-utils
```

Press Enter. When asked "Do you want to continue?", type `Y` and press Enter.

Wait 3-5 minutes.

✅ **Check:**

```bash
python3 --version
```

Should show: `Python 3.10.x` or `3.11.x` or `3.12.x`

### Step 3: Install Nginx (Web Server)

```bash
sudo apt install -y nginx
```

Press Enter.

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

Press Enter after each command.

✅ **Check if Nginx works:**

Open your web browser and go to: `http://YOUR-VM-IP`

Replace YOUR-VM-IP with your IP (e.g., http://20.123.45.67)

**You should see:** "Welcome to nginx!" page

If you see this, Nginx is working! ✅

---

## 📤 **Part 6: Upload LedgerLM Code to Server**

### Step 1: Use WinSCP to Transfer Files

#### 1.1 Open WinSCP

1. **Open:** Windows Start → Type "WinSCP"
2. **Click:** WinSCP

#### 1.2 Connect to Server

**You'll see "Login" window:**

1. **File protocol:** Keep "SFTP"
2. **Host name:** YOUR-VM-IP (e.g., 20.123.45.67)
3. **Port number:** 22
4. **User name:** azureuser
5. **Password:** Leave empty
6. **Click:** "Advanced" button

**Advanced Site Settings opens:**

7. **In left sidebar**, click: **SSH** → **Authentication**
8. **Click:** "..." button next to "Private key file"
9. **Navigate to:** Documents → LedgerLM
10. **Select:** `ledgerlm-ssh-key.ppk`
11. **Click:** "Open"
12. **Click:** "OK" button

**Back to Login window:**

13. **Click:** "Save" button
14. **Session name:** `LedgerLM Bosch`
15. **Click:** "OK"
16. **Click:** "Login" button

**What you'll see:**
- Left side: Your Windows computer
- Right side: Azure server

✅ **Success!** You can now drag files between left and right!

#### 1.3 Upload Code

**On the LEFT (your computer):**

1. **Navigate to:** Documents → LedgerLM

**On the RIGHT (server):**

1. **You should see** home folder (`/home/azureuser`)

**Now drag these folders from left to right:**

- ✅ Drag `client` folder → Drop on right side
- ✅ Drag `server` folder → Drop on right side
- ✅ Drag `python_backend` folder → Drop on right side
- ✅ Drag `shared` folder → Drop on right side
- ✅ Drag `package.json` → Drop on right side
- ✅ Drag `package-lock.json` → Drop on right side
- ✅ Drag `tsconfig.json` → Drop on right side
- ✅ Drag `vite.config.ts` → Drop on right side
- ✅ Drag `.env.production` → Drop on right side

**This takes 2-5 minutes depending on your internet speed.**

**Progress bars will show upload status.**

✅ **Check:** On the right side, you should now see all these folders and files!

---

## ⚙️ **Part 7: Install Application Dependencies**

**Go back to PuTTY window** (the black terminal)

### Step 1: Create Database Connection String

```bash
nano .env.production
```

Press Enter. **You'll see a text editor.**

**Find this line:**
```
DATABASE_URL=
```

**Change it to:**
```
DATABASE_URL=postgresql://ledgerlm_app:YourStrongPassword123!@localhost:5432/ledgerlm
```

**IMPORTANT:** Replace `YourStrongPassword123!` with the database password you used earlier!

**Save the file:**
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

### Step 2: Install Node.js Dependencies

```bash
npm install
```

Press Enter. **This takes 5-10 minutes!**

You'll see lots of text. This is normal. Wait for it to finish.

When done, you'll see `azureuser@ledgerlm-vm:~$` again.

### Step 3: Install Python Dependencies

```bash
cd python_backend
```

Press Enter.

```bash
python3 -m venv venv
```

Press Enter.

```bash
source venv/bin/activate
```

Press Enter. **Your prompt will change to:** `(venv) azureuser@ledgerlm-vm:~/python_backend$`

```bash
pip install -r requirements.txt
```

Press Enter. **This takes 5-10 minutes!**

When done:

```bash
cd ..
```

Press Enter. **You're back in the main folder.**

---

## 🏃 **Part 8: Run the Application**

### Step 1: Build Frontend

```bash
npm run build
```

Press Enter. **This takes 2-3 minutes.**

You'll see:
```
✓ built in X seconds
```

### Step 2: Set Up PM2 (Process Manager)

**What is PM2?** It keeps your application running, even if you close PuTTY.

```bash
sudo npm install -g pm2
```

Press Enter. Wait 1-2 minutes.

### Step 3: Create PM2 Configuration

```bash
nano ecosystem.config.js
```

Press Enter. **Text editor opens.**

**Copy and paste this EXACTLY:**

```javascript
module.exports = {
  apps: [
    {
      name: 'ledgerlm-backend',
      script: 'server/index.ts',
      interpreter: 'node',
      interpreter_args: '--loader tsx',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'ledgerlm-python',
      script: 'python_backend/venv/bin/uvicorn',
      args: 'api.main:app --host 0.0.0.0 --port 8000',
      cwd: './python_backend',
      error_file: './logs/python-error.log',
      out_file: './logs/python-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
```

**Save:**
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

### Step 4: Create Log Directory

```bash
mkdir logs
```

Press Enter.

### Step 5: Start the Application

```bash
pm2 start ecosystem.config.js
```

Press Enter.

**You should see:**

```
┌─────┬────────────────────┬─────────┬─────────┬─────────┐
│ id  │ name               │ status  │ restart │ uptime  │
├─────┼────────────────────┼─────────┼─────────┼─────────┤
│ 0   │ ledgerlm-backend   │ online  │ 0       │ 0s      │
│ 1   │ ledgerlm-python    │ online  │ 0       │ 0s      │
└─────┴────────────────────┴─────────┴─────────┴─────────┘
```

✅ **Both should show "online"!**

**Save PM2 configuration:**

```bash
pm2 save
```

```bash
pm2 startup
```

**You'll see a command starting with `sudo env...`**

**Copy that entire command** and paste it, then press Enter.

---

## 🌐 **Part 9: Configure Nginx (Make it accessible from browser)**

### Step 1: Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/ledgerlm
```

Press Enter. **Text editor opens.**

**Copy and paste this:**

```nginx
server {
    listen 80;
    server_name YOUR_VM_IP;

    client_max_body_size 200M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/python/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**IMPORTANT:** Replace `YOUR_VM_IP` with your actual IP address!

**Save:**
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

### Step 2: Enable the Configuration

```bash
sudo ln -s /etc/nginx/sites-available/ledgerlm /etc/nginx/sites-enabled/
```

Press Enter.

```bash
sudo rm /etc/nginx/sites-enabled/default
```

Press Enter.

```bash
sudo nginx -t
```

Press Enter. **You should see:** `syntax is ok` and `test is successful`

```bash
sudo systemctl restart nginx
```

Press Enter.

---

## 🎉 **Part 10: Test Your Application!**

### Step 1: Open in Browser

1. **Open your web browser**
2. **Go to:** `http://YOUR-VM-IP`
   - Replace YOUR-VM-IP with your IP (e.g., http://20.123.45.67)

**You should see:** LedgerLM login page!

✅ **SUCCESS!** Your application is running!

### Step 2: Create First User

The application should show a sign-in page.

**To create the first admin user:**

**In PuTTY, run:**

```bash
cd ~
node server/seed.ts
```

**This creates a default admin user:**
- Username: `admin@nemko.com`
- Password: (check your seed.ts file)

**Or create your own user in database:**

```bash
sudo -u postgres psql ledgerlm
```

```sql
INSERT INTO users (id, username, password, display_name, role)
VALUES (
  gen_random_uuid()::text,
  'admin@bosch.com',
  '$2a$10$...',  -- You'll need to hash the password
  'Bosch Admin',
  'admin'
);
```

Type `\q` to exit.

---

## 🔒 **Part 11: Set Up HTTPS (SSL Certificate)**

**For production, you MUST use HTTPS!**

### Option A: Use Let's Encrypt (Free SSL)

**Only works if you have a domain name (e.g., ledgerlm.bosch.com)**

```bash
sudo apt install certbot python3-certbot-nginx -y
```

```bash
sudo certbot --nginx -d ledgerlm.bosch.com
```

**Follow the prompts:**
- Enter email: (your email)
- Agree to terms: `Y`
- Share email: `N`
- Redirect HTTP to HTTPS: `2` (Yes)

**Auto-renewal:**

```bash
sudo certbot renew --dry-run
```

### Option B: Use Bosch SSL Certificate

Ask Bosch IT for:
- Certificate file (.crt)
- Private key file (.key)

**Copy them to server using WinSCP:**

1. Drag certificate files to `/home/azureuser/`
2. In PuTTY:

```bash
sudo mkdir -p /etc/ssl/bosch
sudo mv ~/bosch.crt /etc/ssl/bosch/
sudo mv ~/bosch.key /etc/ssl/bosch/
sudo chmod 600 /etc/ssl/bosch/bosch.key
```

**Update Nginx:**

```bash
sudo nano /etc/nginx/sites-available/ledgerlm
```

**Replace everything with:**

```nginx
server {
    listen 80;
    server_name ledgerlm.bosch.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name ledgerlm.bosch.com;

    ssl_certificate /etc/ssl/bosch/bosch.crt;
    ssl_certificate_key /etc/ssl/bosch/bosch.key;

    client_max_body_size 200M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /api/python/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Save and restart:**

```bash
sudo nginx -t
sudo systemctl restart nginx
```

**Now access:** `https://ledgerlm.bosch.com`

---

## 🔧 **Common Problems and Solutions**

### Problem 1: Can't connect with PuTTY

**Error:** "Connection refused" or "Network error"

**Solutions:**
1. **Wait 5 minutes** - VM might still be starting
2. **Check IP address** - Make sure you copied the right IP from Azure Portal
3. **Check firewall** - Go to Azure Portal → Your VM → Networking → Make sure port 22 is allowed
4. **Try again** - Sometimes it just needs a retry

### Problem 2: Website shows "502 Bad Gateway"

**This means Nginx is working but the app isn't running.**

**Check if app is running:**

```bash
pm2 status
```

**You should see:**
```
│ ledgerlm-backend   │ online  │
│ ledgerlm-python    │ online  │
```

**If you see "stopped" or "errored":**

```bash
pm2 logs
```

**This shows you the error. Common fixes:**

1. **Database connection failed:**
   - Check `.env.production` has correct password
   - Check database is running: `sudo systemctl status postgresql`

2. **Port already in use:**
   ```bash
   pm2 delete all
   pm2 start ecosystem.config.js
   ```

3. **Missing dependencies:**
   ```bash
   npm install
   cd python_backend
   source venv/bin/activate
   pip install -r requirements.txt
   cd ..
   pm2 restart all
   ```

### Problem 3: Can't upload files with WinSCP

**Solutions:**
1. **Check connection** - Make sure PuTTY connects first
2. **Check permissions** - You might need to create the folder first in PuTTY:
   ```bash
   mkdir ~/my-folder
   ```
3. **Try smaller files** - Upload one file at a time

### Problem 4: PM2 says "online" but site doesn't load

**Check the logs:**

```bash
pm2 logs ledgerlm-backend --lines 50
```

**Press Ctrl+C to stop viewing logs**

**Common issues:**
- **Port 5000 in use:** Change to different port in `ecosystem.config.js`
- **Database connection:** Check `.env.production` DATABASE_URL
- **Missing environment variables:** Make sure `.env.production` has all values filled

### Problem 5: Database errors

**Reset database:**

```bash
sudo -u postgres psql
DROP DATABASE ledgerlm;
CREATE DATABASE ledgerlm;
GRANT ALL PRIVILEGES ON DATABASE ledgerlm TO ledgerlm_app;
\c ledgerlm
CREATE EXTENSION vector;
GRANT ALL ON SCHEMA public TO ledgerlm_app;
\q
```

Then restart app:

```bash
pm2 restart all
```

---

## 📊 **Checking if Everything is Working**

### Quick Health Check Commands

**In PuTTY, run these:**

```bash
# Check if services are running
pm2 status

# Check database
sudo systemctl status postgresql

# Check Nginx
sudo systemctl status nginx

# Check disk space
df -h

# Check memory
free -h

# View application logs
pm2 logs --lines 20
```

**In your browser:**

1. **Go to:** `http://YOUR-IP/api/health`
2. **You should see:** `{"status":"healthy"}`

---

## 🔄 **How to Update the Application Later**

### When you make code changes:

1. **On your Windows computer:**
   - Make your code changes
   - Save the files

2. **Upload changed files with WinSCP:**
   - Open WinSCP
   - Connect to server
   - Drag the changed files from left to right
   - Confirm overwrite

3. **In PuTTY:**
   ```bash
   npm run build
   pm2 restart all
   ```

**That's it!** Changes are live in 1-2 minutes.

---

## 💾 **Backup Your Database**

**Run this once a week:**

```bash
cd ~
mkdir -p backups
sudo -u postgres pg_dump ledgerlm > backups/ledgerlm-$(date +%Y%m%d).sql
```

**To restore a backup:**

```bash
sudo -u postgres psql ledgerlm < backups/ledgerlm-YYYYMMDD.sql
```

**Automate weekly backups:**

```bash
crontab -e
```

**Choose editor 1 (nano)**

**Add this line at the bottom:**

```
0 2 * * 0 sudo -u postgres pg_dump ledgerlm > /home/azureuser/backups/ledgerlm-$(date +\%Y\%m\%d).sql
```

**Save:** Ctrl+X, Y, Enter

---

## 📞 **Who to Contact for Help**

### Bosch IT Support
**For:**
- Azure access issues
- VM not starting
- Network/firewall problems
- SSL certificates
- Domain name setup

**Contact:** Your local IT helpdesk

### LedgerLM Technical Issues
**For:**
- Application errors
- Database problems
- Feature questions

**Check logs first:**
```bash
pm2 logs
```

**Then contact your development team with:**
- Error message
- What you were trying to do
- Screenshot of the error

---

## ✅ **Final Checklist**

Before you tell users the application is ready:

- [ ] Can access `http://YOUR-IP` in browser
- [ ] Login page appears
- [ ] Can create a user account
- [ ] Can login with that account
- [ ] Can upload a document
- [ ] Can ask a question and get AI response
- [ ] HTTPS is working (https://ledgerlm.bosch.com)
- [ ] Backups are configured
- [ ] PM2 shows both apps "online"
- [ ] Told Bosch IT the application is live
- [ ] Given admin credentials to appropriate people
- [ ] Documented the admin password securely

---

## 🎉 **Congratulations!**

You've successfully deployed LedgerLM to Azure!

**Your application is now:**
- ✅ Running on Bosch Azure
- ✅ Accessible via web browser
- ✅ Connected to PostgreSQL database
- ✅ Using OpenAI for AI features
- ✅ Secured with HTTPS (if configured)
- ✅ Automatically starting on reboot

**What users need to know:**
- **URL:** https://ledgerlm.bosch.com (or http://YOUR-IP)
- **How to login:** Create account or use admin credentials
- **Support:** Contact you or your IT team

**Remember:**
- Check `pm2 logs` if something breaks
- Restart with `pm2 restart all`
- Update by uploading new files + running `npm run build`
- Back up database weekly

---

## 📚 **Quick Command Reference**

**Copy these for future use:**

```bash
# Check if app is running
pm2 status

# View logs
pm2 logs

# Restart app
pm2 restart all

# Stop app
pm2 stop all

# Check database
sudo systemctl status postgresql

# Check Nginx
sudo nginx -t
sudo systemctl restart nginx

# Connect to database
sudo -u postgres psql ledgerlm

# Backup database
sudo -u postgres pg_dump ledgerlm > backup.sql

# View disk space
df -h

# View memory usage
free -h
```

---

**End of Guide** 🎊

*Last updated: November 2025*
*Version: 1.0 - Complete Beginner Edition*
