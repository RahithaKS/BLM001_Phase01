# LedgerLM Deployment Guide
## Matasma Azure → Bosch Azure (No Docker Desktop Needed!)

**For non-technical users - every single click explained**

---

# 🚨 READ THIS FIRST - BEFORE YOU START

## What You Need (Checklist)

Before starting, make sure you have:

| Item | Where to Get It | Example |
|------|-----------------|---------|
| ✅ Your laptop | (You have this) | Windows 10/11 |
| ✅ Email address | matasma.com email | yourname@matasma.com |
| ✅ Phone number | For verification | +91-XXXXXXXXXX |
| ✅ Credit/Debit card | For Azure verification | Won't be charged for free tier |
| ✅ Bosch ACR password | Ask Bosch IT team | They will email you |
| ✅ Bosch VM IP address | Ask Bosch IT team | Example: 20.219.xxx.xxx |
| ✅ SMTP VM IP address | Ask Bosch IT team | Example: 10.0.xxx.xxx |

## Ask Bosch IT for These (Email Template)

```
Subject: LedgerLM Deployment - Need Azure Access Details

Hi Team,

I need the following to deploy LedgerLM:

1. Bosch ACR (boschledgerlm) credentials:
   - Username: boschledgerlm
   - Password: [please provide]

2. VM IP addresses:
   - ledger-llm-VM public IP: [please provide]
   - ledger-llm-smtp-02 private IP: [please provide]

3. VM SSH access:
   - Username: [please provide]  
   - Password: [please provide]

Thanks!
```

---

# NAVIGATION GUIDE - How to Find Things in Azure

## Azure Portal Layout (Picture in Words)

```
┌─────────────────────────────────────────────────────────────┐
│ [☰ Menu]   🔍 Search bar                      [?] [🔔] [👤]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │ + Create a   │  │ Resource     │  │ All          │     │
│   │   resource   │  │ groups       │  │ resources    │     │
│   └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│   Recent resources will appear here...                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Areas:**
- **☰ Menu** (three lines, top-left): Opens full navigation
- **🔍 Search bar** (top-center): Type to find anything
- **👤 Profile icon** (top-right): Your account settings

---

# ULTRA-GRANULAR QUICK REFERENCE

## Finding Container Registries

**Step-by-step with exact clicks:**

1. Open browser → Go to https://portal.azure.com
2. See the search bar at top? It says "Search resources, services, and docs"
3. Click inside that search bar
4. Type exactly: `container registries`
5. Look at dropdown that appears
6. Under "Services" section, click "Container registries"
7. You're now on the Container registries page!

## Finding Resource Groups

1. Click inside search bar (top)
2. Type: `resource groups`
3. Under "Services", click "Resource groups"
4. Done!

## Finding Virtual Machines

1. Click inside search bar
2. Type: `virtual machines` or the VM name like `ledger-llm-VM`
3. Click on the result
4. Done!

---

## What We're Doing (Simple Picture)

```
YOUR LAPTOP          MATASMA AZURE           BOSCH AZURE
(write code)         (build image)           (run app)
    │                     │                      │
    │   Push code         │   Copy image         │
    └────────────────────►│─────────────────────►│
                          │                      │
              Source code stays    Only compiled app
              with Matasma!        goes to Bosch
```

**Result:** Bosch runs your app but NEVER sees your source code!

---

# PHASE 1: SETUP MATASMA AZURE ACCOUNT
**Time: 30 minutes | Who: You (one-time setup)**

---

## Step 1.1: Create Microsoft Azure Account for Matasma

⏱️ **Time:** 10 minutes

1. **Open** your web browser (Chrome, Edge, etc.)

2. **Go to:** https://azure.microsoft.com

3. **Click:** Green button **"Start free"** (or "Try Azure for free")

4. **Sign in options:**
   - If you have Microsoft/Outlook account: Use that
   - If not: Click **"Create one!"** to make new account

5. **Fill in your details:**
   ```
   Email: yourname@matasma.com (or personal email)
   Password: Create a strong password
   Name: Your Name
   Country: India
   Phone: Your phone number for verification
   ```

6. **Credit Card:** Azure needs a card for verification
   - First 12 months: Many services FREE
   - They charge only if you use paid services
   - You can set spending limits

7. **Click:** "Sign up"

8. **Verify:** Check email and click verification link

9. **Wait:** Account setup (2-3 minutes)

10. **You'll see:** Azure Portal dashboard (blue interface)

✅ **Matasma Azure account created!**

---

## Step 1.2: Create Resource Group (Folder for Your Stuff)

⏱️ **Time:** 3 minutes

**Think of Resource Group as a folder to organize everything**

1. **In Azure Portal**, look at the top search bar

2. **Type:** `resource groups`

3. **Click:** "Resource groups" from results

4. **Click:** Blue **"+ Create"** button

5. **Fill in:**
   ```
   Subscription: Your subscription (probably "Azure subscription 1")
   Resource group name: matasma-ledgerlm-rg
   Region: Central India (same as Bosch)
   ```

6. **Click:** "Review + create"

7. **Click:** "Create"

8. **Wait:** 10 seconds

✅ **Resource group created!**

---

## Step 1.3: Create Container Registry (ACR) for Matasma

⏱️ **Time:** 5 minutes

**This stores your Docker images (like a photo album for app packages)**

1. **In search bar**, type: `container registries`

2. **Click:** "Container registries"

3. **Click:** Blue **"+ Create"** button

4. **Fill in the form:**

   **Basics tab:**
   ```
   Subscription: Your subscription
   Resource group: matasma-ledgerlm-rg (the one you just created)
   Registry name: maborledgerlm (must be unique, no spaces/dashes)
   Location: Central India
   SKU: Basic (cheapest, ~$5/month)
   ```

5. **Click:** "Review + create"

6. **Click:** "Create"

7. **Wait:** 1-2 minutes for deployment

8. **Click:** "Go to resource"

9. **IMPORTANT - Write down:**
   ```
   Login server: maborledgerlm.azurecr.io
   ```
   (Find this on the Overview page)

✅ **Matasma Container Registry created!**

---

## Step 1.4: Enable Admin Access to ACR

⏱️ **Time:** 1 minute

**This lets you push/pull images**

1. **In your ACR** (maborledgerlm), look at left sidebar

2. **Click:** "Access keys" (under Settings)

3. **Toggle ON:** "Admin user"

4. **Write down these values:**
   ```
   Login server: maborledgerlm.azurecr.io
   Username: maborledgerlm
   Password: (copy the password shown)
   Password2: (copy the second password - backup)
   ```

5. **Save these somewhere safe!** (You'll need them later)

✅ **Admin access enabled!**

---

# PHASE 2: SETUP GITHUB (Code Storage)
**Time: 20 minutes | Who: You (one-time setup)**

---

## Step 2.1: Create GitHub Account

⏱️ **Time:** 5 minutes

1. **Go to:** https://github.com

2. **Click:** "Sign up"

3. **Enter:**
   ```
   Email: yourname@matasma.com
   Password: Strong password
   Username: matasma-yourname
   ```

4. **Verify** email

5. **Complete** setup wizard

✅ **GitHub account ready!**

---

## Step 2.2: Create Private Repository

⏱️ **Time:** 3 minutes

1. **On GitHub**, click **"+"** (top right) → "New repository"

2. **Fill in:**
   ```
   Repository name: ledgerlm-app
   Description: LedgerLM Financial Analysis Platform
   ```

3. **Select:** 🔘 **Private** (IMPORTANT!)

4. **Leave unchecked:** All boxes at bottom

5. **Click:** "Create repository"

6. **You'll see** an empty repository page

7. **Copy the URL shown:**
   ```
   https://github.com/YOUR-USERNAME/ledgerlm-app.git
   ```

✅ **Private repository created!**

---

## Step 2.3: Download and Install Git

⏱️ **Time:** 5 minutes

1. **Go to:** https://git-scm.com/download/win

2. **Click:** "Click here to download"

3. **Run** the downloaded file

4. **Click:** Next → Next → Next... (keep clicking Next, accept all defaults)

5. **Click:** Install → Finish

6. **Verify:** Open Command Prompt, type:
   ```
   git --version
   ```
   Should show: `git version 2.x.x`

✅ **Git installed!**

---

## Step 2.4: Upload Your Code to GitHub

⏱️ **Time:** 10 minutes

1. **Download your code from Replit:**
   - In Replit, click the three dots menu (⋮)
   - Click "Download as zip"
   - Save to your Downloads folder
   - Extract the zip file

2. **Open Command Prompt** (Start → type "cmd" → Enter)

3. **Navigate to extracted folder:**
   ```
   cd C:\Users\YourName\Downloads\ledgerlm-app
   ```

4. **Initialize Git:**
   ```
   git init
   ```

5. **Configure your name:**
   ```
   git config user.name "Your Name"
   git config user.email "yourname@matasma.com"
   ```

6. **Add all files:**
   ```
   git add .
   ```

7. **Create first commit:**
   ```
   git commit -m "Initial commit"
   ```

8. **Connect to GitHub:**
   ```
   git remote add origin https://github.com/YOUR-USERNAME/ledgerlm-app.git
   ```
   (Replace YOUR-USERNAME with your actual GitHub username)

9. **Push code:**
   ```
   git branch -M main
   git push -u origin main
   ```

10. **Login popup:** Sign in to GitHub when prompted

11. **Verify:** Go to GitHub.com → Your repository → You should see all your files!

✅ **Code uploaded to GitHub!**

---

# PHASE 3: SETUP AUTOMATED BUILD (Azure DevOps)
**Time: 30 minutes | Who: You (one-time setup)**

**This automatically builds your Docker image in the cloud!**

---

## Step 3.1: Create Azure DevOps Account

⏱️ **Time:** 5 minutes

1. **Go to:** https://dev.azure.com

2. **Click:** "Start free"

3. **Sign in** with your Microsoft account (same as Azure)

4. **Create organization:**
   ```
   Organization name: matasma-dev
   Project location: Central India (or closest)
   ```

5. **Click:** Continue

6. **Create first project:**
   ```
   Project name: LedgerLM
   Visibility: Private
   ```

7. **Click:** "Create project"

✅ **Azure DevOps ready!**

---

## Step 3.2: Connect GitHub to Azure DevOps

⏱️ **Time:** 5 minutes

1. **In Azure DevOps**, click: "Project settings" (bottom left gear icon)

2. **Under Pipelines**, click: "Service connections"

3. **Click:** "Create service connection"

4. **Select:** "GitHub"

5. **Click:** "Next"

6. **Authentication:** "Grant authorization"

7. **Click:** "Authorize AzurePipelines"

8. **GitHub login:** Approve access

9. **Service connection name:** `github-connection`

10. **Click:** "Save"

✅ **GitHub connected!**

---

## Step 3.3: Connect Azure Container Registry

⏱️ **Time:** 5 minutes

1. **Still in Service connections**, click: "New service connection"

2. **Select:** "Docker Registry"

3. **Click:** "Next"

4. **Registry type:** "Azure Container Registry"

5. **Authentication:** "Service Principal"

6. **Fill in:**
   ```
   Subscription: Your Azure subscription
   Azure container registry: maborledgerlm
   Service connection name: matasma-acr-connection
   ```

7. **Click:** "Save"

✅ **ACR connected!**

---

## Step 3.4: Create Build Pipeline

⏱️ **Time:** 10 minutes

**This tells Azure how to build your app**

1. **In Azure DevOps**, click: "Pipelines" (left sidebar, rocket icon)

2. **Click:** "Create Pipeline"

3. **Where is your code?** Click: "GitHub"

4. **Select repository:** `ledgerlm-app`

5. **Authorize** if prompted

6. **Configure:** Click "Docker - Build and push an image to Azure Container Registry"

7. **Select subscription:** Your Azure subscription

8. **Container registry:** maborledgerlm

9. **Image name:** ledgerlm-app

10. **Dockerfile:** Dockerfile (it will find it)

11. **Click:** "Validate and configure"

12. **You'll see YAML code** - Replace ALL of it with this:

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

variables:
  imageRepository: 'ledgerlm-app'
  containerRegistry: 'maborledgerlm.azurecr.io'
  dockerfilePath: '$(Build.SourcesDirectory)/Dockerfile'
  tag: '$(Build.BuildId)'

stages:
- stage: Build
  displayName: 'Build and Push'
  jobs:
  - job: Build
    displayName: 'Build Docker Image'
    steps:
    
    - task: Docker@2
      displayName: 'Build image'
      inputs:
        containerRegistry: 'matasma-acr-connection'
        repository: '$(imageRepository)'
        command: 'build'
        Dockerfile: '$(dockerfilePath)'
        tags: |
          $(tag)
          latest

    - task: Docker@2
      displayName: 'Push image'
      inputs:
        containerRegistry: 'matasma-acr-connection'
        repository: '$(imageRepository)'
        command: 'push'
        tags: |
          $(tag)
          latest

- stage: CopyToBosch
  displayName: 'Copy to Bosch ACR'
  dependsOn: Build
  jobs:
  - job: Copy
    displayName: 'Copy Image to Bosch'
    steps:
    
    - task: Docker@2
      displayName: 'Login to Matasma ACR'
      inputs:
        containerRegistry: 'matasma-acr-connection'
        command: 'login'

    - task: Bash@3
      displayName: 'Pull, Tag, and Push to Bosch'
      inputs:
        targetType: 'inline'
        script: |
          # Pull from Matasma
          docker pull $(containerRegistry)/$(imageRepository):$(tag)
          
          # Tag for Bosch
          docker tag $(containerRegistry)/$(imageRepository):$(tag) boschledgerlm.azurecr.io/$(imageRepository):$(tag)
          docker tag $(containerRegistry)/$(imageRepository):$(tag) boschledgerlm.azurecr.io/$(imageRepository):latest
          
          # Login to Bosch ACR (credentials from variables)
          echo $(BOSCH_ACR_PASSWORD) | docker login boschledgerlm.azurecr.io -u $(BOSCH_ACR_USERNAME) --password-stdin
          
          # Push to Bosch
          docker push boschledgerlm.azurecr.io/$(imageRepository):$(tag)
          docker push boschledgerlm.azurecr.io/$(imageRepository):latest
```

13. **Click:** "Save and run"

14. **Commit message:** "Add build pipeline"

15. **Click:** "Save and run"

**First build will fail - that's OK!** We need to add Bosch credentials next.

✅ **Pipeline created!**

---

## Step 3.5: Add Bosch ACR Credentials to Pipeline

⏱️ **Time:** 5 minutes

**We need to securely store Bosch's registry password**

1. **In Azure DevOps**, click: "Pipelines" → "Library"

2. **Click:** "+ Variable group"

3. **Variable group name:** `bosch-credentials`

4. **Click:** "+ Add"

5. **Add these variables:**
   ```
   Name: BOSCH_ACR_USERNAME
   Value: boschledgerlm
   ```
   
   Click "+ Add" again:
   ```
   Name: BOSCH_ACR_PASSWORD
   Value: (paste the password Bosch gave you)
   ```
   **Click the lock icon 🔒 to make it secret!**

6. **Click:** "Save"

7. **Now link to pipeline:**
   - Go to Pipelines → Your pipeline → Edit
   - Click "Variables" (top right)
   - Click "Variable groups"
   - Click "Link variable group"
   - Select "bosch-credentials"
   - Click "Link"
   - Click "Save"

✅ **Credentials secured!**

---

## Step 3.6: Run the Pipeline

⏱️ **Time:** 15 minutes (build time)

1. **Go to:** Pipelines → Your pipeline

2. **Click:** "Run pipeline"

3. **Click:** "Run"

4. **Watch the build:**
   - Stage 1: Build and Push (5-10 minutes)
   - Stage 2: Copy to Bosch (2-3 minutes)

5. **When complete:** Green checkmarks on both stages!

✅ **Image built and pushed to Bosch!**

---

# PHASE 4: DEPLOY ON BOSCH AZURE
**Time: 30 minutes | Who: You or Bosch IT**

---

## Step 4.1: Connect to Bosch VM

⏱️ **Time:** 5 minutes

1. **Go to Azure Portal:** https://portal.azure.com

2. **Login** with Bosch credentials they gave you

3. **Search:** `ledger-llm-VM`

4. **Click** on the virtual machine

5. **Find:** Public IP address (write it down)

6. **Connect via SSH:**
   - Open Command Prompt on your laptop
   - Type:
     ```
     ssh azureuser@<VM-IP-ADDRESS>
     ```
   - Replace `<VM-IP-ADDRESS>` with actual IP
   - Type "yes" if asked about fingerprint
   - Enter password when prompted

✅ **Connected to Bosch VM!**

---

## Step 4.2: Get SMTP Server IP

⏱️ **Time:** 2 minutes

1. **In Azure Portal**, search: `ledger-llm-smtp-02-ip`

2. **Click** on it

3. **Copy** the IP address shown

4. **This is your SMTP_HOST** (save it)

✅ **SMTP IP noted!**

---

## Step 4.3: Install Docker on Bosch VM

⏱️ **Time:** 10 minutes

**Run these commands in the SSH terminal:**

1. **Update system:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

3. **Install Docker Compose:**
   ```bash
   sudo apt install -y docker-compose
   ```

4. **Reconnect** (logout and login again):
   ```bash
   exit
   ```
   Then SSH back in.

5. **Verify Docker:**
   ```bash
   docker --version
   ```

✅ **Docker installed!**

---

## Step 4.4: Install PostgreSQL

⏱️ **Time:** 10 minutes

1. **Add PostgreSQL repository:**
   ```bash
   sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
   wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
   ```

2. **Install PostgreSQL with pgvector:**
   ```bash
   sudo apt update
   sudo apt install -y postgresql-16 postgresql-16-pgvector
   ```

3. **Start PostgreSQL:**
   ```bash
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

4. **Create database:**
   ```bash
   sudo -u postgres psql
   ```

5. **In PostgreSQL prompt, type:**
   ```sql
   CREATE DATABASE ledgerlm;
   CREATE USER ledgerlm_app WITH PASSWORD 'YourSecurePassword123!';
   GRANT ALL PRIVILEGES ON DATABASE ledgerlm TO ledgerlm_app;
   \c ledgerlm
   CREATE EXTENSION vector;
   GRANT ALL ON SCHEMA public TO ledgerlm_app;
   \q
   ```

✅ **Database ready!**

---

## Step 4.5: Login to Bosch ACR from VM

⏱️ **Time:** 2 minutes

```bash
docker login boschledgerlm.azurecr.io -u boschledgerlm -p "<PASSWORD-FROM-BOSCH>"
```

Replace `<PASSWORD-FROM-BOSCH>` with actual password.

✅ **Logged in to ACR!**

---

## Step 4.6: Create Application Configuration

⏱️ **Time:** 5 minutes

1. **Create folder:**
   ```bash
   mkdir ~/ledgerlm && cd ~/ledgerlm
   ```

2. **Create docker-compose.yml:**
   ```bash
   nano docker-compose.yml
   ```

3. **Paste this:**
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
       volumes:
         - app_uploads:/app/uploads
   volumes:
     app_uploads:
   ```

4. **Save:** Press Ctrl+X, then Y, then Enter

5. **Create .env file:**
   ```bash
   nano .env
   ```

6. **Paste this (fill in your values):**
   ```env
   DATABASE_URL=postgresql://ledgerlm_app:YourSecurePassword123!@localhost:5432/ledgerlm
   NODE_ENV=production
   PORT=5000
   
   # Leave empty for self-hosted LLM
   OPENAI_API_KEY=
   
   # SMTP - Use Bosch SMTP VM IP from Step 4.2
   SMTP_HOST=<SMTP-IP-FROM-STEP-4.2>
   SMTP_PORT=25
   SMTP_USER=
   SMTP_PASSWORD=
   SMTP_FROM=ledgerlm@bosch.com
   
   # Security - Generate random 32 characters
   SESSION_SECRET=abc123def456ghi789jkl012mno345pq
   
   # Anaplan credentials
   ANAPLAN_WORKSPACE_ID=8a868cdc7e5feca9017e8e4afdd57430
   ANAPLAN_MODEL_ID=BE462879B50444F498A0DA70F40FABA2
   ANAPLAN_PROCESS_ID=118000000093
   ANAPLAN_USERNAME=<your-anaplan-username>
   ANAPLAN_PASSWORD=<your-anaplan-password>
   ```

7. **Save:** Ctrl+X, Y, Enter

✅ **Configuration ready!**

---

## Step 4.7: Start Application

⏱️ **Time:** 5 minutes

1. **Pull latest image:**
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
   Should show: `ledgerlm-app   Up`

4. **Check logs:**
   ```bash
   docker-compose logs -f
   ```
   Press Ctrl+C to exit logs

✅ **Application running!**

---

## Step 4.8: Test Application

⏱️ **Time:** 1 minute

1. **Open browser**

2. **Go to:** `http://<BOSCH-VM-IP>`

3. **You should see:** LedgerLM login page!

✅ **SUCCESS! Application deployed!**

---

# PHASE 5: FUTURE UPDATES (Easy!)
**When you make code changes**

---

## Automatic Updates

After initial setup, updates are AUTOMATIC:

1. **Make changes** in Replit

2. **Download** updated code (zip)

3. **Push to GitHub:**
   ```cmd
   cd C:\Users\YourName\Downloads\ledgerlm-app
   git add .
   git commit -m "Describe your changes"
   git push
   ```

4. **Pipeline runs automatically!** (builds and pushes to Bosch)

5. **On Bosch VM** (via SSH):
   ```bash
   cd ~/ledgerlm
   docker-compose pull
   docker-compose up -d
   ```

✅ **Update complete in 5 minutes!**

---

# SUMMARY: What Goes Where

| Location | What's There | Who Can See |
|----------|--------------|-------------|
| Replit | Source code (development) | You only |
| GitHub (Private) | Source code (backup) | You only |
| Matasma Azure ACR | Docker image | Matasma only |
| Bosch ACR | Docker image (copy) | Bosch |
| Bosch VM | Running app | Everyone (via browser) |

**Source code NEVER reaches Bosch!** ✅

---

# CHECKLIST

## Phase 1: Matasma Azure
- [ ] Azure account created
- [ ] Resource group: matasma-ledgerlm-rg
- [ ] Container registry: maborledgerlm
- [ ] Admin access enabled

## Phase 2: GitHub
- [ ] GitHub account created
- [ ] Private repository: ledgerlm-app
- [ ] Code pushed to GitHub

## Phase 3: Azure DevOps
- [ ] DevOps organization created
- [ ] GitHub connected
- [ ] ACR connected
- [ ] Pipeline created
- [ ] Bosch credentials added
- [ ] Pipeline runs successfully

## Phase 4: Bosch Azure
- [ ] Connected to VM
- [ ] Docker installed
- [ ] PostgreSQL installed
- [ ] Configuration created
- [ ] Application running
- [ ] Login page accessible

---

# COSTS (Estimated Monthly)

| Service | Cost |
|---------|------|
| Matasma Azure ACR (Basic) | ~$5/month |
| Azure DevOps | FREE (1800 build minutes/month) |
| GitHub Private Repo | FREE |
| **Total Matasma Cost** | **~$5/month** |

Bosch pays for their own VM and ACR.

---

---

# 🔧 TROUBLESHOOTING - Common Problems & Fixes

## Problem 1: "I can't login to Azure Portal"

**What you see:** Error message after entering password

**Fix:**
1. Go to https://portal.azure.com (not azure.com)
2. Clear browser cache: Press Ctrl+Shift+Delete → Clear
3. Try different browser (Chrome, Edge)
4. Check CAPS LOCK is off
5. Click "Forgot password?" to reset

---

## Problem 2: "Resource group creation failed"

**What you see:** Red error when creating resource group

**Fix:**
1. Check the name: Only letters, numbers, dashes allowed
2. No spaces in the name!
3. Try different name: `matasma-ledgerlm-rg-2`
4. Check region is "Central India"

---

## Problem 3: "Container registry name already taken"

**What you see:** "Name already exists" error

**Fix:**
1. Registry names must be globally unique
2. Try: `maborledgerlm2` or `matasmallm` or add date: `ledgerlm2024`
3. Only lowercase letters and numbers (no dashes!)

---

## Problem 4: "Pipeline build failed"

**What you see:** Red X on build stage

**Fix - Check these:**

1. **Dockerfile missing?**
   - Go to GitHub → Check Dockerfile exists at root
   - If missing, download from Replit and push again

2. **Service connection error?**
   - Pipelines → Settings → Service connections
   - Delete old connection → Create new one
   - Re-authorize

3. **YAML syntax error?**
   - Copy YAML from this guide exactly
   - No extra spaces at line starts
   - Check indentation (use spaces, not tabs)

**View the error:**
1. Click on failed stage
2. Click on failed step
3. Read the red error message
4. Search that error message on Google

---

## Problem 5: "Cannot push to Bosch ACR"

**What you see:** "unauthorized" or "authentication required"

**Fix:**
1. Check BOSCH_ACR_PASSWORD is correct in variable group
2. Make sure password doesn't have special characters that need escaping
3. Re-ask Bosch IT for fresh password
4. Check username is exactly: `boschledgerlm`

---

## Problem 6: "SSH connection refused to VM"

**What you see:** "Connection refused" or timeout

**Fix:**
1. Check VM is running:
   - Azure Portal → Virtual machines → ledger-llm-VM
   - Status should be "Running"
   - If stopped: Click "Start"

2. Check IP is correct:
   - Look at "Public IP address" on VM overview
   - Use that exact IP

3. Check firewall:
   - VM → Networking → Check port 22 is allowed
   - If not: Add inbound rule for port 22

4. Wait and retry:
   - VM may need 2-3 minutes after starting
   - Try again in 5 minutes

---

## Problem 7: "docker: command not found on VM"

**What you see:** Error when running docker commands

**Fix:**
1. Did you logout/login after installing Docker?
   ```bash
   exit
   ```
   Then SSH back in

2. Re-install Docker:
   ```bash
   sudo apt update
   sudo apt install -y docker.io
   sudo systemctl start docker
   sudo usermod -aG docker $USER
   exit
   ```
   Then SSH back in

---

## Problem 8: "Cannot pull image from Bosch ACR"

**What you see:** "repository does not exist" or "not found"

**Fix:**
1. Login to ACR first:
   ```bash
   docker login boschledgerlm.azurecr.io -u boschledgerlm -p "YOUR_PASSWORD"
   ```

2. Check image exists:
   - Azure Portal (Bosch) → Container registries → boschledgerlm
   - Repositories → Should see "ledgerlm-app"

3. If image not there:
   - Re-run the pipeline from Azure DevOps
   - Wait for both stages to complete (green)

---

## Problem 9: "Application not loading in browser"

**What you see:** "Cannot reach this page" or blank screen

**Fix:**
1. Check container is running:
   ```bash
   docker ps
   ```
   Should show `ledgerlm-app` with status "Up"

2. Check logs for errors:
   ```bash
   docker logs ledgerlm-app
   ```

3. Check port 80 is open:
   - Azure Portal → VM → Networking
   - Add inbound rule: Port 80, Any source

4. Check firewall on VM:
   ```bash
   sudo ufw status
   ```
   If active:
   ```bash
   sudo ufw allow 80
   sudo ufw allow 5000
   ```

5. Try with port number:
   ```
   http://VM-IP:5000
   ```

---

## Problem 10: "Database connection error"

**What you see:** "ECONNREFUSED" or "connection refused" in logs

**Fix:**
1. Check PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```
   If not running:
   ```bash
   sudo systemctl start postgresql
   ```

2. Check DATABASE_URL in .env:
   ```bash
   cat ~/ledgerlm/.env | grep DATABASE
   ```
   Format must be exactly:
   ```
   DATABASE_URL=postgresql://ledgerlm_app:YourPassword@localhost:5432/ledgerlm
   ```

3. Test database connection:
   ```bash
   psql -h localhost -U ledgerlm_app -d ledgerlm
   ```
   Enter password when prompted

---

# 📋 QUICK COMMAND REFERENCE

## Azure Portal URLs

| Purpose | URL |
|---------|-----|
| Azure Portal | https://portal.azure.com |
| Azure DevOps | https://dev.azure.com |
| GitHub | https://github.com |

## SSH Commands Cheat Sheet

| What | Command |
|------|---------|
| Connect to VM | `ssh azureuser@VM-IP` |
| Go to app folder | `cd ~/ledgerlm` |
| See running containers | `docker ps` |
| See all containers | `docker ps -a` |
| View app logs | `docker logs ledgerlm-app` |
| Follow logs live | `docker logs -f ledgerlm-app` |
| Stop app | `docker-compose down` |
| Start app | `docker-compose up -d` |
| Restart app | `docker-compose restart` |
| Pull latest image | `docker-compose pull` |
| Update & restart | `docker-compose pull && docker-compose up -d` |

## File Locations on VM

| File | Path |
|------|------|
| App folder | `~/ledgerlm/` |
| Docker Compose | `~/ledgerlm/docker-compose.yml` |
| Environment vars | `~/ledgerlm/.env` |
| Uploaded files | Inside Docker volume |

---

# 📞 GETTING HELP

## If You're Stuck

1. **Take a screenshot** of the error
2. **Note what step** you were on
3. **Google the error message** (often helpful!)

## Contact Points

| Issue Type | Who to Contact |
|------------|----------------|
| Azure account issues | Microsoft Azure Support |
| Bosch ACR access | Bosch IT Team |
| VM connection issues | Bosch IT Team |
| Application errors | Development Team (Matasma) |

---

# ✅ FINAL VERIFICATION CHECKLIST

Before considering deployment complete:

- [ ] Can login to Azure Portal (Matasma account)
- [ ] Resource group exists: `matasma-ledgerlm-rg`
- [ ] Container registry exists: `maborledgerlm`
- [ ] GitHub repo has latest code
- [ ] Pipeline runs successfully (both stages green)
- [ ] Can SSH into Bosch VM
- [ ] Docker is installed on VM
- [ ] PostgreSQL is running on VM
- [ ] Application container is running
- [ ] Can access http://VM-IP in browser
- [ ] Login page displays correctly

---

**END OF GUIDE**

*Matasma Azure Deployment Guide*
*Version 2.0 - November 2025*
*Updated with ultra-granular steps and troubleshooting*
