# 🚀 Complete LedgerLM Deployment Guide
## Matasma Laptop → GitHub → Docker → Bosch Azure

**This guide includes GitHub for version control (backup your code!)**

Every step shows:
- 🖥️ **MATASMA LAPTOP** = Your work laptop
- 🐙 **GITHUB** = Code backup (only YOU can access)
- ☁️ **BOSCH AZURE** = Client's cloud (no source code here!)

---

## 📊 **The Complete Workflow**

```
YOUR MATASMA LAPTOP
        │
        ├──► GitHub Private Repo (YOUR account, Matasma owns it)
        │         └── Version control, backup, history
        │         └── Bosch has NO access ❌
        │
        ├──► Docker Build (compile source → image)
        │         └── Source code compiled inside
        │         └── TypeScript → JavaScript (minified)
        │
        └──► Push to Bosch ACR
                  └── Only compiled image
                  └── NO source code ❌
                            │
                            ▼
                  BOSCH AZURE VM
                  └── Pulls image from ACR
                  └── Runs containers
                  └── NO source code ever! ✅
```

---

## 📋 **What You Need**

### From GitHub (Your Account):
- ✅ GitHub account (create free at github.com)
- ✅ Private repository (free, unlimited)

### From Bosch IT (Already Provided!):
| Resource Name | Type | Purpose |
|---------------|------|---------|
| **boschledgerlm** | Container Registry | Store Docker images |
| **ledger-llm-VM** | Virtual Machine | Main application server |
| **ledger-llm-smtp-02** | Virtual Machine | **Dedicated SMTP email server** |
| **ledger-llm-VM-ip** | Public IP | Access to main VM |
| **ledger-llm-smtp-02-ip** | Public IP | SMTP server address |

### Your API Keys:
- ✅ Anaplan credentials (already configured)
- ✅ Email via Bosch SMTP server (**ledger-llm-smtp-02**)

---

# 🖥️ **PART 0: SETUP GITHUB (Version Control)**

**This keeps your code safe and tracks all changes!**

---

## Step 0.1: Create GitHub Account (Skip if you have one)

⏱️ **Time:** 5 minutes  
🖥️ **Where:** Your Matasma laptop, web browser

1. **Open** web browser

2. **Go to:** https://github.com

3. **You'll see:** GitHub homepage with "Sign up" button

4. **Click:** Green **"Sign up"** button (top right)

5. **Fill in:**
   - **Email:** your-name@matasma.com (your work email)
   - **Password:** Create a strong password
   - **Username:** matasma-yourname (or similar)

6. **Click:** "Continue"

7. **Verify** your email (check inbox for code)

8. **Complete** the setup wizard

✅ **GitHub account created!**

---

## Step 0.2: Install Git on Your Laptop

⏱️ **Time:** 5 minutes  
🖥️ **Where:** Your Matasma laptop

1. **Go to:** https://git-scm.com/download/win

2. **Click:** "Click here to download" (auto-download starts)

3. **Double-click** the downloaded file: `Git-2.x.x-64-bit.exe`

4. **Installation wizard:**
   - **Click:** "Next" (keep defaults)
   - **Click:** "Next" (keep defaults)
   - **Click:** "Next" (keep defaults)
   - Keep clicking "Next" for all screens (about 10 times)
   - **Click:** "Install"
   - **Click:** "Finish"

5. **Verify installation:**
   - **Open** Command Prompt (Start → cmd)
   - **Type:** `git --version`
   - **Press Enter**
   - **Should show:** `git version 2.x.x`

✅ **Git installed!**

---

## Step 0.3: Configure Git with Your Name

⏱️ **Time:** 1 minute  
🖥️ **Where:** Your Matasma laptop, Command Prompt

1. **Open** Command Prompt

2. **Type these commands** (replace with YOUR info):

```cmd
git config --global user.name "Your Name"
```
**Press Enter**

```cmd
git config --global user.email "your-name@matasma.com"
```
**Press Enter**

✅ **Git configured!**

---

## Step 0.4: Create Private Repository on GitHub

⏱️ **Time:** 3 minutes  
🖥️ **Where:** Web browser (github.com)

1. **Go to:** https://github.com

2. **Login** with your account

3. **At top-right**, **click:** **"+"** icon (plus sign)

4. **Click:** "New repository"

5. **Fill in the form:**

   **Repository name:**
   ```
   ledgerlm-private
   ```
   
   **Description:**
   ```
   LedgerLM - AI Financial Analysis Platform (Private)
   ```

6. **IMPORTANT:** Select **"Private"** (radio button)
   - ⚪ Public ← DO NOT SELECT THIS
   - 🔘 **Private** ← SELECT THIS ONE

7. **Leave unchecked:**
   - ⬜ Add a README file
   - ⬜ Add .gitignore
   - ⬜ Choose a license

8. **Click:** Green **"Create repository"** button

**You'll see:** Empty repository page with instructions

9. **Copy the repository URL:**
   - Find: `https://github.com/YOUR-USERNAME/ledgerlm-private.git`
   - **Copy it** (you'll need it next)

✅ **Private repository created!** (Only YOU can see it)

---

## Step 0.5: Upload Your Code to GitHub

⏱️ **Time:** 10 minutes  
🖥️ **Where:** Your Matasma laptop, Command Prompt

**This uploads your code to GitHub for backup.**

1. **Open** Command Prompt

2. **Navigate to your project folder:**
   ```cmd
   cd C:\Users\YourName\Projects\LedgerLM
   ```
   - **Replace** with YOUR actual path!
   - **Press Enter**

3. **Initialize Git in your project:**
   ```cmd
   git init
   ```
   - **Press Enter**
   - **Should say:** `Initialized empty Git repository...`

4. **Create .gitignore file** (to exclude sensitive files):
   ```cmd
   notepad .gitignore
   ```
   - **Press Enter**
   - **Notepad opens**

5. **Paste this into Notepad:**
   ```
   # Dependencies
   node_modules/
   
   # Environment files (NEVER commit these!)
   .env
   .env.local
   .env.production
   .env.*.local
   
   # Build output
   dist/
   build/
   
   # Logs
   *.log
   npm-debug.log*
   
   # IDE
   .vscode/
   .idea/
   
   # OS
   .DS_Store
   Thumbs.db
   
   # Uploads
   uploads/
   
   # Python
   __pycache__/
   *.pyc
   venv/
   ```

6. **Save and close Notepad** (File → Save, then close)

7. **Add all files to Git:**
   ```cmd
   git add .
   ```
   - **Press Enter**
   - (May take 30 seconds)

8. **Create first commit:**
   ```cmd
   git commit -m "Initial commit - LedgerLM v1.0.0"
   ```
   - **Press Enter**
   - Shows list of files added

9. **Rename branch to main:**
   ```cmd
   git branch -M main
   ```
   - **Press Enter**

10. **Connect to GitHub:**
    ```cmd
    git remote add origin https://github.com/YOUR-USERNAME/ledgerlm-private.git
    ```
    - **Replace** YOUR-USERNAME with your actual GitHub username!
    - **Press Enter**

11. **Push code to GitHub:**
    ```cmd
    git push -u origin main
    ```
    - **Press Enter**

12. **First time only - Login popup appears:**
    - **Click:** "Sign in with your browser"
    - **Browser opens** → Login to GitHub
    - **Click:** "Authorize Git Credential Manager"
    - **Close browser**

13. **Back in Command Prompt:**
    - Upload progress shows
    - **Should say:** `Branch 'main' set up to track remote branch 'main'`

✅ **Code uploaded to GitHub!**

---

## Step 0.6: Verify Code is on GitHub

⏱️ **Time:** 1 minute  
🖥️ **Where:** Web browser

1. **Go to:** https://github.com/YOUR-USERNAME/ledgerlm-private

2. **You should see:**
   - All your folders (client, server, python_backend, etc.)
   - Files like package.json, Dockerfile
   - **NO .env files** (they were excluded!)

3. **Check it says "Private"** next to repository name

✅ **Your code is safely backed up on GitHub!**

**IMPORTANT:** 
- ✅ Only YOU can see this repository
- ❌ Bosch has NO access
- ❌ Public cannot see it

---

# 🖥️ **PART 1: SETUP MATASMA LAPTOP**

**Now let's set up Docker and build the image.**

---

## Step 1.1: Install Docker Desktop

⏱️ **Time:** 10 minutes  
🖥️ **Where:** Your Matasma laptop

1. **Open** web browser

2. **Go to:** https://www.docker.com/products/docker-desktop/

3. **You'll see:** Blue website with "Docker Desktop" in big letters

4. **Click:** Big blue **"Download for Windows"** button
   - It's in the middle of the screen

5. **File downloads:** `Docker Desktop Installer.exe`

6. **Wait** for download (2-5 minutes, ~500MB)

7. **Find** the downloaded file (Downloads folder)

8. **Double-click:** `Docker Desktop Installer.exe`

9. **Windows asks:** "Do you want to allow this app?"
   - **Click:** "Yes"

10. **Docker installer window opens:**
    - You'll see a whale logo

11. **Check the box:** "Use WSL 2 instead of Hyper-V" (if shown)

12. **Click:** Blue "OK" button

13. **Wait** for installation (5-10 minutes)
    - Progress bar shows
    - Downloads additional components

14. **Click:** "Close and restart"

15. **Computer restarts**

**After Restart:**

16. **Docker Desktop opens automatically**
    - Blue window with whale logo

17. **Accept** the terms of service

18. **Skip** tutorial (click "Skip tutorial")

19. **You should see:** Docker Desktop dashboard

**Verify Docker Works:**

20. **Open** Command Prompt (Start → cmd)

21. **Type:** `docker --version`

22. **Press Enter**

23. **Should show:** `Docker version 24.x.x`

✅ **Docker installed!**

---

## Step 1.2: Install Azure CLI

⏱️ **Time:** 5 minutes  
🖥️ **Where:** Your Matasma laptop

1. **Open** web browser

2. **Go to:** https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows

3. **Scroll down** to "Install or update" section

4. **Click:** Blue link **"Download the MSI installer"**

5. **File downloads:** `azure-cli-2.x.x.msi`

6. **Double-click** the downloaded file

7. **Click:** "Next"

8. **Check:** "I accept the terms..."

9. **Click:** "Next"

10. **Click:** "Install"

11. **Wait** 2-3 minutes

12. **Click:** "Finish"

**Verify Azure CLI Works:**

13. **Close** Command Prompt (if open)

14. **Open NEW** Command Prompt (Start → cmd)

15. **Type:** `az --version`

16. **Press Enter**

17. **Should show:** Version info (lots of text)

✅ **Azure CLI installed!**

---

## Step 1.3: Prepare Configuration File

⏱️ **Time:** 5 minutes  
🖥️ **Where:** Your Matasma laptop

1. **Open** File Explorer (Windows key + E)

2. **Navigate to** your LedgerLM folder

3. **Find file:** `.env.production.example`
   - **Can't see it?**
     - Click "View" menu at top
     - Check "Hidden items" box

4. **Right-click** → "Copy"

5. **Right-click** in empty space → "Paste"

6. **Rename the copy to:** `.env.production`

7. **Right-click** `.env.production` → "Open with" → "Notepad"

8. **Fill in YOUR values:**

```env
# Database
POSTGRES_PASSWORD=YourStrongDbPassword123!

# AI - Leave empty if using self-hosted LLM
OPENAI_API_KEY=

# Email (Use Bosch SMTP VM: ledger-llm-smtp-02)
# Get the IP from ledger-llm-smtp-02-ip in Azure Portal
SMTP_HOST=<ledger-llm-smtp-02-ip address>
SMTP_PORT=25
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=ledgerlm@bosch.com

# Security
SESSION_SECRET=MakeUpRandom32CharacterStringHere

# Anaplan
ANAPLAN_WORKSPACE_ID=your-workspace-id
ANAPLAN_MODEL_ID=your-model-id
ANAPLAN_PROCESS_ID=your-process-id
ANAPLAN_USERNAME=your-username
ANAPLAN_PASSWORD=your-password
```

9. **Replace ALL values** with your actual information

10. **Save** (File → Save)

11. **Close** Notepad

✅ **Configuration ready!**

---

## Step 1.4: Build Docker Image

⏱️ **Time:** 15-20 minutes  
🖥️ **Where:** Your Matasma laptop, Command Prompt

**This compiles your code into a sealed package.**

1. **Make sure Docker Desktop is running**
   - Look for whale icon in system tray (bottom right)
   - If not running, open Docker Desktop from Start menu

2. **Open** Command Prompt

3. **Navigate to project:**
   ```cmd
   cd C:\Users\YourName\Projects\LedgerLM
   ```
   - Replace with YOUR path!

4. **Build the Docker image:**
   ```cmd
   docker build -t ledgerlm-app:v1.0.0 .
   ```
   - **Don't forget the dot (.) at the end!**
   - **Press Enter**

**What you'll see:**
```
Sending build context to Docker daemon...
Step 1/25 : FROM node:20-alpine
...
Step 10/25 : RUN npm ci
...
Step 20/25 : RUN npm run build
...
Successfully built abc123def
Successfully tagged ledgerlm-app:v1.0.0
```

- **Takes 15-20 minutes** - Be patient!
- **DON'T close the window!**

5. **Also tag as 'latest':**
   ```cmd
   docker tag ledgerlm-app:v1.0.0 ledgerlm-app:latest
   ```
   - **Press Enter**

✅ **Docker image built!**

---

## Step 1.5: Login to Bosch Azure Container Registry

⏱️ **Time:** 2 minutes  
🖥️ **Where:** Your Matasma laptop, Command Prompt

**Use the ACR credentials Bosch IT gave you.**

1. **In Command Prompt, type:**
   ```cmd
   az acr login --name boschledgerlm
   ```
   - **Replace** `boschledgerlm` with the ACR name Bosch gave you
   - **Press Enter**

2. **Browser may open:**
   - Login with Azure credentials Bosch provided
   - Close browser when done

3. **Command Prompt should show:**
   ```
   Login Succeeded
   ```

✅ **Connected to Bosch ACR!**

---

## Step 1.6: Tag Image for Bosch ACR

⏱️ **Time:** 10 seconds  
🖥️ **Where:** Your Matasma laptop, Command Prompt

1. **Type:**
   ```cmd
   docker tag ledgerlm-app:v1.0.0 boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
   ```
   - Replace `boschledgerlm` with YOUR ACR name

2. **Press Enter**

3. **Type:**
   ```cmd
   docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

4. **Press Enter**

✅ **Image tagged!**

---

## Step 1.7: Push Image to Bosch Azure

⏱️ **Time:** 10-20 minutes  
🖥️ **Where:** Your Matasma laptop, Command Prompt

**This uploads the compiled image (NO source code!).**

1. **Type:**
   ```cmd
   docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
   ```

2. **Press Enter**

**You'll see upload progress:**
```
The push refers to repository [boschledgerlm.azurecr.io/ledgerlm-app]
abc123: Pushing [=====>          ] 150MB/500MB
...
```

3. **Wait 10-20 minutes** (depends on internet speed)

4. **When done, push 'latest' tag too:**
   ```cmd
   docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

5. **Press Enter**

6. **Wait** another 2-3 minutes (faster, shares layers)

**Success message:**
```
latest: digest: sha256:abc123... size: 5678
```

✅ **Image pushed to Bosch Azure!**

**Your source code is still ONLY on your Matasma laptop and GitHub!**
**Bosch only has the compiled Docker image!**

---

## Step 1.8: Save Your Changes to GitHub

⏱️ **Time:** 2 minutes  
🖥️ **Where:** Your Matasma laptop, Command Prompt

**Commit your changes to keep GitHub updated.**

1. **In Command Prompt:**
   ```cmd
   cd C:\Users\YourName\Projects\LedgerLM
   ```

2. **Check what changed:**
   ```cmd
   git status
   ```

3. **Add changes:**
   ```cmd
   git add .
   ```

4. **Commit with message:**
   ```cmd
   git commit -m "Release v1.0.0 - Ready for Bosch deployment"
   ```

5. **Push to GitHub:**
   ```cmd
   git push
   ```

6. **Create a version tag:**
   ```cmd
   git tag v1.0.0
   git push --tags
   ```

✅ **Changes saved to GitHub!**

---

# ☁️ **PART 2: BOSCH AZURE SETUP**

**Now set up the Azure environment where the app will run.**

---

## Step 2.1: Login to Azure Portal

⏱️ **Time:** 2 minutes  
☁️ **Where:** Web browser

1. **Open** browser

2. **Go to:** https://portal.azure.com

3. **Login** with credentials Bosch IT gave you

4. **You'll see:** Azure Portal dashboard

✅ **Logged in!**

---

## Step 2.2: Verify Your Image is in ACR

⏱️ **Time:** 2 minutes  
☁️ **Where:** Azure Portal

1. **In search bar at top**, type: `container registries`

2. **Click:** "Container registries" (container icon)

3. **Click:** Your ACR name (e.g., boschledgerlm)

4. **On left sidebar**, click: "Repositories"

5. **You should see:** `ledgerlm-app`

6. **Click** on it

7. **Verify tags:**
   - v1.0.0
   - latest

✅ **Image confirmed in Bosch Azure!**

---

## Step 2.3: Create Virtual Machine

⏱️ **Time:** 15 minutes  
☁️ **Where:** Azure Portal

1. **In search bar**, type: `virtual machines`

2. **Click:** "Virtual machines"

3. **Click:** Blue **"+ Create"** button

4. **Click:** "Azure virtual machine"

**Fill in the form:**

**Basics tab:**

5. **Subscription:** Select Bosch's subscription

6. **Resource group:**
   - Click "Create new"
   - Type: `ledgerlm-rg`
   - Click "OK"

7. **Virtual machine name:** `ledgerlm-vm`

8. **Region:** Select appropriate region (e.g., West Europe)

9. **Image:**
   - Click dropdown
   - Click "See all images"
   - Search: `ubuntu 22.04`
   - Select: "Ubuntu Server 22.04 LTS - x64 Gen2"
   - Click "Select"

10. **Size:**
    - Click "See all sizes"
    - Search: `D4s_v3`
    - Select: "Standard_D4s_v3" (4 vCPU, 16 GB)
    - Click "Select"
    - **For GPU:** Search `NC4as_T4_v3` instead

11. **Authentication type:** SSH public key

12. **Username:** `azureuser`

13. **SSH public key source:** Generate new key pair

14. **Key pair name:** `ledgerlm-ssh-key`

15. **Public inbound ports:** Allow selected ports

16. **Select ports:**
    - ✅ HTTP (80)
    - ✅ HTTPS (443)
    - ✅ SSH (22)

**Continue:**

17. **Click:** "Next: Disks"

18. **OS disk type:** Standard SSD

19. **Click:** "Review + create"

20. **Click:** "Create"

**IMPORTANT:**

21. **Popup: "Generate new key pair"**
    - **Click:** "Download private key and create resource"
    - **Save the .pem file** somewhere safe!

22. **Wait** 3-5 minutes for deployment

23. **Click:** "Go to resource"

24. **Find and copy:** "Public IP address" (e.g., 20.123.45.67)

25. **Write it down:** ________________

✅ **VM created!**

---

# 🔌 **PART 3: CONNECT AND DEPLOY**

---

## Step 3.1: Install PuTTY

⏱️ **Time:** 3 minutes  
🖥️ **Where:** Your Matasma laptop

1. **Go to:** https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html

2. **Under "Package files"**, find **"64-bit x86:"**

3. **Click:** `putty-64bit-0.xx-installer.msi`

4. **Double-click** downloaded file

5. **Click:** Next → Next → Install → Finish

✅ **PuTTY installed!**

---

## Step 3.2: Convert SSH Key

⏱️ **Time:** 2 minutes  
🖥️ **Where:** Your Matasma laptop

1. **Open** Windows Start

2. **Type:** `PuTTYgen`

3. **Click:** "PuTTYgen"

4. **Click:** "Load"

5. **Change dropdown** to "All Files (*.*)"

6. **Find and select** your `.pem` file

7. **Click:** "Open"

8. **Click:** "OK" on success message

9. **Click:** "Save private key"

10. **Click:** "Yes" (save without passphrase)

11. **Save as:** `ledgerlm-ssh-key.ppk`

✅ **Key converted!**

---

## Step 3.3: Connect to VM

⏱️ **Time:** 2 minutes  
🖥️ **Where:** Your Matasma laptop

1. **Open** PuTTY

2. **Host Name:** `azureuser@YOUR-VM-IP`
   - Replace YOUR-VM-IP with actual IP

3. **Left sidebar:** Connection → SSH → Auth → Credentials

4. **Private key file:** Browse → Select your `.ppk` file

5. **Left sidebar:** Click "Session"

6. **Saved Sessions:** Type `LedgerLM-Bosch`

7. **Click:** "Save"

8. **Click:** "Open"

9. **First time:** Click "Accept" on security alert

**You should see:**
```
Welcome to Ubuntu 22.04
azureuser@ledgerlm-vm:~$
```

✅ **Connected to VM!**

---

## Step 3.4: Install Docker on VM

⏱️ **Time:** 10 minutes  
☁️ **Where:** PuTTY terminal (VM)

**Copy and paste each command (right-click to paste in PuTTY):**

1. **Update system:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
   ```

3. **Add user to docker group:**
   ```bash
   sudo usermod -aG docker $USER
   ```

4. **Install Docker Compose:**
   ```bash
   sudo apt install -y docker-compose
   ```

5. **Install Azure CLI:**
   ```bash
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   ```

6. **Exit and reconnect:**
   ```bash
   exit
   ```

7. **Reconnect with PuTTY** (repeat Step 3.3)

8. **Verify Docker:**
   ```bash
   docker --version
   ```

✅ **Docker installed on VM!**

---

## Step 3.5: Get Bosch SMTP Server IP

⏱️ **Time:** 2 minutes  
☁️ **Where:** Azure Portal

**Bosch has provided a dedicated SMTP server: `ledger-llm-smtp-02`**

1. **In Azure Portal**, go to your resource group

2. **Find:** `ledger-llm-smtp-02-ip` (Public IP address)

3. **Click** on it

4. **Copy** the IP address shown (e.g., `20.xxx.xxx.xxx`)

5. **This is your SMTP_HOST** for email configuration

**Note:** Ask Bosch IT for:
- SMTP port (usually 25 or 587)
- Authentication credentials (if required)
- From email address to use

✅ **SMTP IP address copied!**

---

## Step 3.6: Install PostgreSQL on VM (ledger-llm-VM)

⏱️ **Time:** 8 minutes  
☁️ **Where:** PuTTY terminal (VM)

1. **Add PostgreSQL repo:**
   ```bash
   sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
   ```

2. **Add key:**
   ```bash
   wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
   ```

3. **Update and install:**
   ```bash
   sudo apt update && sudo apt install -y postgresql-16 postgresql-16-pgvector
   ```

4. **Start PostgreSQL:**
   ```bash
   sudo systemctl start postgresql && sudo systemctl enable postgresql
   ```

5. **Create database:**
   ```bash
   sudo -u postgres psql
   ```

6. **In PostgreSQL prompt:**
   ```sql
   CREATE DATABASE ledgerlm;
   CREATE USER ledgerlm_app WITH PASSWORD 'YourStrongPassword123!';
   GRANT ALL PRIVILEGES ON DATABASE ledgerlm TO ledgerlm_app;
   \c ledgerlm
   CREATE EXTENSION vector;
   GRANT ALL ON SCHEMA public TO ledgerlm_app;
   \q
   ```

✅ **Database created!**

---

## Step 3.6: Login to ACR from VM

⏱️ **Time:** 3 minutes  
☁️ **Where:** PuTTY terminal (VM)

1. **Login to Azure:**
   ```bash
   az login
   ```

2. **Follow the URL shown** - open in browser, enter code

3. **After login, run:**
   ```bash
   az acr login --name boschledgerlm
   ```

✅ **VM can access ACR!**

---

## Step 3.7: Create Configuration Files on VM

⏱️ **Time:** 5 minutes  
☁️ **Where:** PuTTY terminal (VM)

1. **Create directory:**
   ```bash
   mkdir ~/ledgerlm && cd ~/ledgerlm
   ```

2. **Create docker-compose.yml:**
   ```bash
   nano docker-compose.yml
   ```

3. **Paste this** (right-click):
   ```yaml
   version: '3.8'
   services:
     app:
       image: boschledgerlm.azurecr.io/ledgerlm-app:latest
       container_name: ledgerlm-app
       restart: always
       ports:
         - "80:5000"
       env_file:
         - .env
       network_mode: host
       volumes:
         - app_uploads:/app/uploads
   volumes:
     app_uploads:
   ```

4. **Save:** Ctrl+X, Y, Enter

5. **Create .env file:**
   ```bash
   nano .env
   ```

6. **Paste your configuration** (get values from Bosch IT):
   ```env
   DATABASE_URL=postgresql://ledgerlm_app:YourPassword@localhost:5432/ledgerlm
   NODE_ENV=production
   PORT=5000
   
   # AI (leave empty for self-hosted LLM)
   OPENAI_API_KEY=
   
   # Email - Use Bosch SMTP VM (ledger-llm-smtp-02)
   # Get the IP from: Azure Portal > ledger-llm-smtp-02-ip
   SMTP_HOST=<get-ip-from-ledger-llm-smtp-02-ip>
   SMTP_PORT=25
   SMTP_USER=
   SMTP_PASSWORD=
   SMTP_FROM=ledgerlm@bosch.com
   
   # Security
   SESSION_SECRET=<generate-random-32-character-string>
   
   # Anaplan - Get credentials from Bosch IT
   ANAPLAN_WORKSPACE_ID=<get-from-bosch>
   ANAPLAN_MODEL_ID=<get-from-bosch>
   ANAPLAN_PROCESS_ID=<get-from-bosch>
   ANAPLAN_USERNAME=<get-from-bosch>
   ANAPLAN_PASSWORD=<get-from-bosch>
   ```

7. **Save:** Ctrl+X, Y, Enter

✅ **Configuration created!**

---

## Step 3.8: Pull and Start Application

⏱️ **Time:** 10 minutes  
☁️ **Where:** PuTTY terminal (VM)

1. **Pull image:**
   ```bash
   docker-compose pull
   ```

2. **Start application:**
   ```bash
   docker-compose up -d
   ```

3. **Check status:**
   ```bash
   docker-compose ps
   ```

**Should show:**
```
ledgerlm-app   Up   0.0.0.0:80->5000/tcp
```

✅ **Application running!**

---

## Step 3.9: Test Application

⏱️ **Time:** 1 minute  
🖥️ **Where:** Your web browser

1. **Open browser**

2. **Go to:** `http://YOUR-VM-IP`

3. **You should see:** LedgerLM login page! 🎉

✅ **SUCCESS!**

---

# 🔄 **PART 4: HOW TO UPDATE**

**When you make code changes:**

## On Matasma Laptop:

```cmd
cd C:\Users\YourName\Projects\LedgerLM

# Save changes to GitHub
git add .
git commit -m "Description of changes"
git push

# Build new version
docker build -t ledgerlm-app:v1.0.1 .

# Tag for ACR
docker tag ledgerlm-app:v1.0.1 boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1
docker tag ledgerlm-app:v1.0.1 boschledgerlm.azurecr.io/ledgerlm-app:latest

# Push to ACR
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1
docker push boschledgerlm.azurecr.io/ledgerlm-app:latest

# Tag in GitHub
git tag v1.0.1
git push --tags
```

## On Bosch VM (via PuTTY):

```bash
cd ~/ledgerlm
docker-compose pull
docker-compose up -d
```

✅ **Update complete in 5 minutes!**

---

# ✅ **FINAL CHECKLIST**

## GitHub:
- [ ] GitHub account created
- [ ] Private repository created
- [ ] Code pushed to GitHub
- [ ] Release tagged (v1.0.0)

## Matasma Laptop:
- [ ] Git installed
- [ ] Docker Desktop installed
- [ ] Azure CLI installed
- [ ] Docker image built
- [ ] Image pushed to Bosch ACR

## Bosch Azure:
- [ ] VM created and running
- [ ] Docker installed on VM
- [ ] PostgreSQL database created
- [ ] docker-compose.yml created
- [ ] .env file with secrets created
- [ ] Application running

## Testing:
- [ ] Can access http://VM-IP
- [ ] Login page appears
- [ ] Verified source code NOT on VM

---

# 🔒 **SOURCE CODE PROTECTION SUMMARY**

| Location | Has Source Code? |
|----------|------------------|
| Your Matasma Laptop | ✅ YES |
| GitHub Private Repo | ✅ YES (only YOU access) |
| Bosch ACR | ❌ NO (compiled image only) |
| Bosch VM | ❌ NO (compiled image only) |
| Bosch Employees | ❌ NO (web interface only) |

**Your TypeScript source code NEVER reaches Bosch!**

---

# 📞 **SUMMARY: WHO DOES WHAT**

## You (Matasma):
- ✅ Keep code in GitHub (your account)
- ✅ Build Docker images on your laptop
- ✅ Push to Bosch ACR
- ✅ Build updates when needed

## Bosch IT:
- ✅ Provide ACR credentials
- ✅ Provide VM access
- ✅ Setup domain & SSL

## Bosch Users:
- ✅ Access via browser only
- ❌ No technical work

---

**END OF GUIDE** 🎊

*Complete Deployment Guide with GitHub*  
*Version 1.0 - November 2025*
