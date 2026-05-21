# Complete LedgerLM Deployment Guide - Docker Desktop Method

## Build on Your Laptop, Deploy to Bosch Azure

**Source Code Stays Safe on Your Laptop - Only Compiled Image Goes to Bosch!**

---

## What This Guide Covers

Every step shows:
- **YOUR LAPTOP** = Your Matasma laptop (Docker Desktop installed)
- **GITHUB** = Code backup (only YOU can access)
- **BOSCH ACR** = Container Registry (receives only compiled images)
- **BOSCH VM** = Runs the application (NO source code here!)

---

## Security Model

```
+------------------------------------------------------------------+
|                    MATASMA SIDE (Your Control)                   |
|                                                                  |
|  YOUR LAPTOP                                                     |
|  ├── Source code (TypeScript, React, Python)                    |
|  ├── Docker Desktop installed                                    |
|  ├── Build Docker image (compiles code)                         |
|  └── Push compiled image to Bosch ACR                           |
|                                                                  |
|  GITHUB (Private Repo)                                           |
|  └── Backup of your source code (Bosch has NO access)           |
|                                                                  |
+------------------------------------------------------------------+
                              │
                              │ Only COMPILED IMAGE goes to Bosch
                              │ (No source code!)
                              ▼
+------------------------------------------------------------------+
|                    BOSCH SIDE (Client Infrastructure)            |
|                                                                  |
|  BOSCH ACR (boschledgerlm.azurecr.io)                           |
|  └── Stores compiled Docker images only                         |
|                                                                  |
|  BOSCH VM (ledger-llm-VM)                                        |
|  └── Pulls and runs the image                                   |
|  └── NO source code ever touches this machine!                  |
|                                                                  |
+------------------------------------------------------------------+
```

---

## Prerequisites Checklist

Before starting, make sure you have:

- [ ] Windows 10/11 laptop (64-bit)
- [ ] Administrator access on your laptop
- [ ] At least 10 GB free disk space
- [ ] Code already on your laptop (or on GitHub)
- [ ] Bosch ACR credentials (boschledgerlm / password)
- [ ] Internet connection

---

## Total Time: 60-90 minutes (first time)

| Part | Description | Time |
|------|-------------|------|
| Part 0 | Install Docker Desktop | 15-20 min |
| Part 1 | Prepare Your Code | 10 min |
| Part 2 | Build Docker Image | 15-20 min |
| Part 3 | Push to Bosch ACR | 10-15 min |
| Part 4 | Deploy on Bosch VM | 15 min |
| Part 5 | Verify & Test | 5 min |

---

# PART 0: INSTALL DOCKER DESKTOP

**This installs Docker on your Matasma laptop.**

---

## Step 0.1: Check System Requirements

Time: 2 minutes
Where: Your laptop

1. **Press:** Windows key + R

2. **Type:** `winver`

3. **Press:** Enter

4. **You'll see:** Windows version
   ```
   +------------------------------------------+
   | About Windows                            |
   |                                          |
   | Windows 10 Pro                           |
   | Version 22H2 (OS Build 19045.xxxx)       |
   |                                          |
   +------------------------------------------+
   ```

5. **Check:** You need Windows 10 version 1903 or higher, or Windows 11

**Windows version OK!**

---

## Step 0.2: Enable Virtualization (If Needed)

Time: 5 minutes
Where: Your laptop

1. **Press:** Ctrl + Shift + Esc (opens Task Manager)

2. **Click:** "Performance" tab

3. **Click:** "CPU" on the left

4. **Look at bottom right for:** "Virtualization: Enabled"
   ```
   +------------------------------------------+
   | Performance                              |
   |                                          |
   | CPU: Intel Core i7                       |
   | ...                                      |
   | Virtualization: Enabled     <-- Check!  |
   +------------------------------------------+
   ```

5. **If it says "Enabled":** Skip to Step 0.3

6. **If it says "Disabled":** You need to enable it in BIOS
   - This requires restarting and entering BIOS
   - Contact IT support if unsure

**Virtualization is enabled!**

---

## Step 0.3: Download Docker Desktop

Time: 5 minutes
Where: Your browser

1. **Open** your web browser (Chrome, Edge, Firefox)

2. **Go to:** https://www.docker.com/products/docker-desktop/

3. **You'll see:** Docker Desktop download page
   ```
   +--------------------------------------------------+
   |                                                  |
   |   Docker Desktop                                 |
   |   The fastest way to containerize applications  |
   |                                                  |
   |   [Download for Windows]  <-- Click this!       |
   |                                                  |
   +--------------------------------------------------+
   ```

4. **Click:** "Download for Windows" (big blue button)

5. **Wait** for download to complete
   - File name: `Docker Desktop Installer.exe`
   - Size: approximately 500-600 MB
   - Check your Downloads folder

**Docker Desktop downloaded!**

---

## Step 0.4: Install Docker Desktop

Time: 10 minutes
Where: Your laptop

1. **Open** your Downloads folder

2. **Double-click:** `Docker Desktop Installer.exe`

3. **If prompted "Do you want to allow this app..."**
   - Click: **"Yes"**

4. **Installation wizard appears:**
   ```
   +------------------------------------------+
   | Docker Desktop Installer                 |
   |                                          |
   | Configuration                            |
   |                                          |
   | [x] Use WSL 2 instead of Hyper-V        |
   |     (recommended)                        |
   |                                          |
   | [x] Add shortcut to desktop             |
   |                                          |
   | [Ok]                                     |
   +------------------------------------------+
   ```

5. **Keep both checkboxes selected** (default)

6. **Click:** "Ok"

7. **Wait** for installation (5-10 minutes)
   ```
   Installing Docker Desktop...
   ████████████████████░░░░ 80%
   ```

8. **When complete:**
   ```
   +------------------------------------------+
   | Installation succeeded                   |
   |                                          |
   | [Close and restart]  <-- Click this!    |
   +------------------------------------------+
   ```

9. **Click:** "Close and restart"

10. **Your computer will restart**

**Docker Desktop installed!**

---

## Step 0.5: Start Docker Desktop

Time: 3 minutes
Where: Your laptop (after restart)

1. **After restart**, log back into Windows

2. **Docker Desktop may start automatically**
   - Look for whale icon in system tray (bottom right)
   ```
   [Whale icon] 🐳  <-- Docker is here
   ```

3. **If not started automatically:**
   - Double-click "Docker Desktop" icon on your desktop
   - OR search for "Docker Desktop" in Start menu

4. **First time - License Agreement:**
   ```
   +------------------------------------------+
   | Docker Subscription Service Agreement   |
   |                                          |
   | [x] I accept the terms                   |
   |                                          |
   | [Accept]  <-- Click this                 |
   +------------------------------------------+
   ```
   - Check the box
   - Click "Accept"

5. **First time - Sign in (Optional):**
   ```
   +------------------------------------------+
   | Sign in to Docker                        |
   |                                          |
   | [Sign in]  [Skip]  <-- Click Skip       |
   +------------------------------------------+
   ```
   - Click "Skip" (you don't need an account)

6. **Wait for Docker to start** (1-2 minutes)
   ```
   Docker Desktop is starting...
   ```

7. **When ready:**
   - Whale icon stops animating
   - Shows "Docker Desktop is running"

**Docker Desktop is running!**

---

## Step 0.6: Verify Docker Installation

Time: 2 minutes
Where: Command Prompt

1. **Press:** Windows key

2. **Type:** `cmd`

3. **Click:** "Command Prompt"

4. **Type this command:**
   ```cmd
   docker --version
   ```

5. **Press Enter**

6. **You should see:**
   ```
   Docker version 24.0.x, build xxxxxxx
   ```

7. **Test Docker is working:**
   ```cmd
   docker run hello-world
   ```

8. **Press Enter**

9. **You should see:**
   ```
   Unable to find image 'hello-world:latest' locally
   latest: Pulling from library/hello-world
   ...
   Hello from Docker!
   This message shows that your installation appears to be working correctly.
   ```

**Docker is working!**

---

# PART 1: PREPARE YOUR CODE

**Make sure your code is ready to build.**

---

## Step 1.1: Open Command Prompt

Time: 1 minute
Where: Your laptop

1. **Press:** Windows key

2. **Type:** `cmd`

3. **Click:** "Command Prompt"

4. **You'll see:**
   ```
   C:\Users\YourName>_
   ```

**Command Prompt is open!**

---

## Step 1.2: Navigate to Your Project

Time: 1 minute
Where: Command Prompt

1. **Type:**
   ```cmd
   cd C:\path\to\your\LedgerLM
   ```
   - **Replace** with YOUR actual project path!
   - **Example:** `cd C:\Users\John\Documents\LedgerLM`
   - **Example:** `cd D:\Projects\ledgerlm-deploy-private`

2. **Press Enter**

3. **Verify you're in the right folder:**
   ```cmd
   dir
   ```

4. **You should see your project files:**
   ```
   Directory of C:\Users\John\Documents\LedgerLM

   11/28/2024  10:00 AM    <DIR>          client
   11/28/2024  10:00 AM    <DIR>          server
   11/28/2024  10:00 AM    <DIR>          python_backend
   11/28/2024  10:00 AM            2,000  Dockerfile
   11/28/2024  10:00 AM            1,500  docker-compose.yml
   11/28/2024  10:00 AM            3,000  package.json
   ```

**In the right folder!**

---

## Step 1.3: Verify Dockerfile Exists

Time: 1 minute
Where: Command Prompt

1. **Type:**
   ```cmd
   type Dockerfile
   ```

2. **Press Enter**

3. **You should see** the Dockerfile content:
   ```
   # =======================================
   # LedgerLM Production Dockerfile
   # =======================================
   ...
   FROM node:20-bullseye AS node-builder
   ...
   ```

4. **If you see "File not found":**
   - Make sure you're in the correct folder
   - Check if Dockerfile exists with `dir Docker*`

**Dockerfile exists!**

---

## Step 1.4: Create Environment File (If Needed)

Time: 3 minutes
Where: Command Prompt

1. **Check if .env.production.example exists:**
   ```cmd
   dir .env*
   ```

2. **If you see `.env.production.example`:**
   ```cmd
   copy .env.production.example .env.production
   ```

3. **Edit the file:**
   ```cmd
   notepad .env.production
   ```

4. **Notepad opens** - Fill in your values:
   ```
   POSTGRES_PASSWORD=YourPassword
   SESSION_SECRET=Random32Characters
   OPENAI_API_KEY=sk-your-key
   ...
   ```

5. **Save:** Press Ctrl+S

6. **Close** Notepad

**Environment file ready!**

---

# PART 2: BUILD DOCKER IMAGE

**This compiles your code into a Docker image.**

---

## Step 2.1: Build the Image

Time: 15-20 minutes
Where: Command Prompt

**This is the main build step!**

1. **Make sure Docker Desktop is running:**
   - Check for whale icon 🐳 in system tray

2. **Type this command:**
   ```cmd
   docker build -t ledgerlm-app:latest .
   ```
   - **IMPORTANT:** Don't forget the `.` at the end!

3. **Press Enter**

4. **You'll see build progress:**
   ```
   [+] Building 120.5s (25/25)
   => [internal] load build definition from Dockerfile
   => [internal] load .dockerignore
   => [stage-1  1/10] FROM node:20-bullseye
   => [stage-1  2/10] WORKDIR /app
   => [stage-1  3/10] COPY package*.json ./
   => [stage-1  4/10] RUN npm ci
   ...
   => exporting to image
   => => naming to docker.io/library/ledgerlm-app:latest
   ```

5. **Wait 15-20 minutes**
   - First build takes longer (downloads base images)
   - Future builds are faster (uses cache)

6. **Success message:**
   ```
   => exporting to image
   => => naming to docker.io/library/ledgerlm-app:latest
   
   What's Next?
     View a summary of image vulnerabilities and recommendations
   ```

**Docker image built!**

---

## Step 2.2: Verify Image was Created

Time: 30 seconds
Where: Command Prompt

1. **Type:**
   ```cmd
   docker images
   ```

2. **Press Enter**

3. **You should see:**
   ```
   REPOSITORY      TAG       IMAGE ID       CREATED          SIZE
   ledgerlm-app    latest    abc123def456   2 minutes ago    1.2GB
   ```

4. **Note the SIZE** - This is your compiled application

**Image confirmed!**

---

## Step 2.3: Create Version Tag

Time: 30 seconds
Where: Command Prompt

1. **Create a version tag:**
   ```cmd
   docker tag ledgerlm-app:latest ledgerlm-app:v1.0.0
   ```

2. **Press Enter**

3. **Verify both tags exist:**
   ```cmd
   docker images
   ```

4. **You should see:**
   ```
   REPOSITORY      TAG       IMAGE ID       SIZE
   ledgerlm-app    latest    abc123def456   1.2GB
   ledgerlm-app    v1.0.0    abc123def456   1.2GB
   ```

**Version tag created!**

---

# PART 3: PUSH TO BOSCH ACR

**Upload your image to Bosch's container registry.**

---

## Step 3.1: Login to Bosch ACR


Time: 2 minutes
Where: Command Prompt

1. **Type:**
   ```cmd
   docker login boschledgerlm.azurecr.io
   ```

2. **Press Enter**

3. **When prompted for Username:**
   ```
   Username: boschledgerlm
   ```
   - Type: `boschledgerlm`
   - Press Enter

4. **When prompted for Password:**
   ```
   Password:
   ```
   - Type your Bosch ACR password (it won't show as you type)
   - This is the password Bosch IT gave you
   - Press Enter

5. **Success message:**
   ```
   Login Succeeded
   ```

**Logged into Bosch ACR!**

---

## Step 3.2: Tag Images for Bosch ACR

Time: 1 minute
Where: Command Prompt

1. **Tag 'latest':**
   ```cmd
   docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

2. **Press Enter**

3. **Tag version:**
   ```cmd
   docker tag ledgerlm-app:v1.0.0 boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
   ```

4. **Press Enter**

5. **Verify tags:**
   ```cmd
   docker images | findstr bosch
   ```

6. **You should see:**
   ```
   boschledgerlm.azurecr.io/ledgerlm-app   latest   abc123   1.2GB
   boschledgerlm.azurecr.io/ledgerlm-app   v1.0.0   abc123   1.2GB
   ```

**Images tagged for Bosch!**

---

## Step 3.3: Push Images to Bosch ACR

Time: 10-15 minutes
Where: Command Prompt

1. **Push 'latest' tag:**
   ```cmd
   docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

2. **Press Enter**

3. **You'll see upload progress:**
   ```
   The push refers to repository [boschledgerlm.azurecr.io/ledgerlm-app]
   5f70bf18a086: Pushing [=====>                  ]  50MB/200MB
   a3ed95caeb02: Pushing [===========>            ] 100MB/200MB
   ...
   ```

4. **Wait 10-15 minutes** for upload
   - Upload speed depends on your internet connection
   - Don't close the Command Prompt!

5. **Success message:**
   ```
   latest: digest: sha256:abc123... size: 3456
   ```

6. **Push version tag:**
   ```cmd
   docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
   ```

7. **Press Enter**

8. **This is faster** (shares layers with 'latest'):
   ```
   v1.0.0: digest: sha256:abc123... size: 3456
   ```

**Images pushed to Bosch ACR!**

---

## Step 3.4: Verify Push in Azure Portal (Optional)

Time: 3 minutes
Where: Your browser

1. **Open** your browser

2. **Go to:** https://portal.azure.com

3. **Login** with Bosch Azure credentials (or your Azure account)

4. **Search for:** `boschledgerlm`

5. **Click:** "boschledgerlm" (Container registry)

6. **Click:** "Repositories" in left sidebar

7. **You should see:** `ledgerlm-app`

8. **Click:** `ledgerlm-app`

9. **You should see your tags:**
   ```
   +------------------------------------------+
   | ledgerlm-app                             |
   |------------------------------------------|
   | Tag        Created                       |
   | latest     Just now                      |
   | v1.0.0     Just now                      |
   +------------------------------------------+
   ```

**Push verified!**

---

# PART 4: DEPLOY ON BOSCH VM

**Now deploy the app on Bosch's virtual machine.**

---

## Step 4.1: Connect to Bosch VM

Time: 2 minutes
Where: Command Prompt (your laptop)

1. **Open a NEW Command Prompt window**

2. **SSH into the Bosch VM:**
   ```cmd
   ssh adminuser@<BOSCH-VM-IP>
   ```
   - Replace `adminuser` with the actual username
   - Replace `<BOSCH-VM-IP>` with the VM's IP address
   - Example: `ssh azureuser@20.193.xxx.xxx`

3. **If asked about fingerprint:**
   ```
   Are you sure you want to continue connecting (yes/no)?
   ```
   - Type: `yes`
   - Press Enter

4. **Enter password** when prompted

5. **You're connected:**
   ```
   adminuser@ledger-llm-VM:~$
   ```

**Connected to Bosch VM!**

---

## Step 4.2: Login to Bosch ACR from VM

Time: 1 minute
Where: Bosch VM (SSH session)

1. **Login to container registry:**
   ```bash
   docker login boschledgerlm.azurecr.io
   ```

2. **Enter Username:** `boschledgerlm`

3. **Enter Password:** (the ACR password)

4. **Success:**
   ```
   Login Succeeded
   ```

**Logged in!**

---

## Step 4.3: Pull the Docker Image

Time: 5-10 minutes
Where: Bosch VM (SSH session)

1. **Pull the image:**
   ```bash
   docker pull boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

2. **Wait for download:**
   ```
   latest: Pulling from ledgerlm-app
   a1b2c3d4: Pull complete
   ...
   Status: Downloaded newer image for boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

**Image downloaded!**

---

## Step 4.4: Create Application Directory

Time: 1 minute
Where: Bosch VM (SSH session)

1. **Create directory:**
   ```bash
   sudo mkdir -p /opt/ledgerlm
   sudo chown $USER:$USER /opt/ledgerlm
   cd /opt/ledgerlm
   ```

**Directory created!**

---

## Step 4.5: Create docker-compose.yml

Time: 5 minutes
Where: Bosch VM (SSH session)

1. **Create the file:**
   ```bash
   nano docker-compose.yml
   ```

2. **Paste this content:**
   ```yaml
   version: '3.8'

   services:
     app:
       image: boschledgerlm.azurecr.io/ledgerlm-app:latest
       container_name: ledgerlm-app
       restart: always
       ports:
         - "80:80"
       environment:
         DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
         NODE_ENV: production
         PORT: 5000
         PYTHON_BACKEND_URL: http://127.0.0.1:8000
         OPENAI_API_KEY: ${OPENAI_API_KEY}
         SMTP_HOST: ${SMTP_HOST}
         SMTP_PORT: ${SMTP_PORT}
         SMTP_USER: ${SMTP_USER}
         SMTP_PASSWORD: ${SMTP_PASSWORD}
         SMTP_FROM: ${SMTP_FROM}
         SESSION_SECRET: ${SESSION_SECRET}
         NEMKO_ADMIN_OTP: ${NEMKO_ADMIN_OTP}
       volumes:
         - app_uploads:/app/uploads
       extra_hosts:
         - "host.docker.internal:host-gateway"

   volumes:
     app_uploads:
       driver: local
   ```

3. **Save and exit:**
   - Press: **Ctrl + O** (Write Out)
   - Press: **Enter**
   - Press: **Ctrl + X** (Exit)

**docker-compose.yml created!**

---

## Step 4.6: Create Environment File

Time: 5 minutes
Where: Bosch VM (SSH session)

1. **Create .env file:**
   ```bash
   nano .env
   ```

2. **Add your configuration:**
   ```bash
   # PostgreSQL (on this VM)
   POSTGRES_HOST=172.17.0.1
   POSTGRES_PORT=5432
   POSTGRES_DB=ledgerlm
   POSTGRES_USER=ledgerlm
   POSTGRES_PASSWORD=YOUR_PASSWORD_HERE

   # Application
   SESSION_SECRET=YourRandom32CharacterStringHere!

   # OpenAI
   OPENAI_API_KEY=sk-your-openai-api-key

   # Email (SMTP) - Use Bosch SMTP or leave empty for testing
   SMTP_HOST=20.40.43.112
   SMTP_PORT=25
   SMTP_USER=
   SMTP_PASSWORD=
   SMTP_FROM=noreply@ledgerlm.com

   # Admin OTP (for testing)
   NEMKO_ADMIN_OTP=123456
   ```

3. **Save and exit:**
   - Press: **Ctrl + O**
   - Press: **Enter**
   - Press: **Ctrl + X**

**Environment file created!**

---

## Step 4.7: Start the Application

Time: 2 minutes
Where: Bosch VM (SSH session)

1. **Start containers:**
   ```bash
   docker-compose up -d
   ```

2. **Success message:**
   ```
   Creating network "ledgerlm_default" with the default driver
   Creating ledgerlm-app ... done
   ```

3. **Verify running:**
   ```bash
   docker ps
   ```

4. **Should show:**
   ```
   CONTAINER ID   IMAGE                                       STATUS
   abc123def456   boschledgerlm.azurecr.io/ledgerlm-app:...   Up 1 minute
   ```

**Application started!**

---

## Step 4.8: Check Logs

Time: 1 minute
Where: Bosch VM (SSH session)

1. **View logs:**
   ```bash
   docker logs ledgerlm-app
   ```

2. **Look for success messages:**
   ```
   [nginx] Starting nginx...
   [node] Server running on port 5000
   [python] Uvicorn running on http://0.0.0.0:8000
   ```

**Logs OK!**

---

# PART 5: VERIFY & TEST

**Test that everything works.**

---

## Step 5.1: Test in Browser

Time: 2 minutes
Where: Your browser

1. **Open** your web browser

2. **Go to:** `http://<BOSCH-VM-IP>`
   - Replace with actual IP (e.g., `http://20.193.xxx.xxx`)

3. **You should see:** LedgerLM login page

4. **Test login:**
   - Email: `nemkomatasma@nemko.com`
   - OTP: `123456`

5. **Success!** You're logged in!

**Application is working!**

---

## Step 5.2: Summary of What Happened

```
YOUR LAPTOP (Matasma)
├── Source code (safe here)
├── Docker Desktop
├── Built Docker image
└── Pushed to Bosch ACR
         │
         │ Only compiled image
         ▼
BOSCH ACR (boschledgerlm.azurecr.io)
├── Stores compiled image only
└── NO source code
         │
         │ Pull image
         ▼
BOSCH VM (ledger-llm-VM)
├── Runs containers
├── NO source code ever!
└── Users access via browser
```

**Security maintained! Source code never left your laptop!**

---

# QUICK REFERENCE: ALL COMMANDS

## On Your Laptop (Command Prompt)

```cmd
# Navigate to project
cd C:\path\to\LedgerLM

# Build image
docker build -t ledgerlm-app:latest .

# Tag for version
docker tag ledgerlm-app:latest ledgerlm-app:v1.0.0

# Login to Bosch ACR
docker login boschledgerlm.azurecr.io

# Tag for Bosch
docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:latest
docker tag ledgerlm-app:v1.0.0 boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0

# Push to Bosch
docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
```

## On Bosch VM (SSH)

```bash
# Login to ACR
docker login boschledgerlm.azurecr.io

# Pull image
docker pull boschledgerlm.azurecr.io/ledgerlm-app:latest

# Start app
cd /opt/ledgerlm
docker-compose up -d

# Check status
docker ps
docker logs ledgerlm-app
```

---

# TROUBLESHOOTING

## Problem: "Docker daemon is not running"

**Solution:**
1. Look for Docker Desktop icon in system tray
2. If not there, start Docker Desktop from Start menu
3. Wait 1-2 minutes for it to fully start

---

## Problem: "docker build" fails with errors

**Solution:**
1. Make sure you're in the correct folder (where Dockerfile is)
2. Check Dockerfile exists: `dir Dockerfile`
3. Make sure Docker Desktop is running

---

## Problem: "Access denied" when pushing to ACR

**Solution:**
1. Login again: `docker login boschledgerlm.azurecr.io`
2. Check username: `boschledgerlm`
3. Check password is correct (get from Bosch IT)

---

## Problem: "no space left on device"

**Solution:**
1. Clean up Docker: `docker system prune -a`
2. This removes unused images and containers

---

## Problem: Build is very slow

**Cause:** First build downloads base images

**Solution:**
- First build: 15-20 minutes (normal)
- Future builds: 5-10 minutes (uses cache)

---

# UPDATING THE APP (Future Changes)

When you make code changes:

1. **On your laptop:**
   ```cmd
   cd C:\path\to\LedgerLM
   
   # Rebuild
   docker build -t ledgerlm-app:v1.1.0 .
   
   # Tag and push
   docker tag ledgerlm-app:v1.1.0 boschledgerlm.azurecr.io/ledgerlm-app:v1.1.0
   docker tag ledgerlm-app:v1.1.0 boschledgerlm.azurecr.io/ledgerlm-app:latest
   docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.1.0
   docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

2. **On Bosch VM:**
   ```bash
   cd /opt/ledgerlm
   docker-compose pull
   docker-compose up -d
   ```

---

# SUCCESS CHECKLIST

After completing this guide, verify:

- [ ] Docker Desktop installed and running
- [ ] Docker image built successfully
- [ ] Image tagged with `latest` and `v1.0.0`
- [ ] Logged into Bosch ACR
- [ ] Images pushed to Bosch ACR
- [ ] Connected to Bosch VM via SSH
- [ ] Image pulled on Bosch VM
- [ ] docker-compose.yml created
- [ ] .env file created with correct values
- [ ] Application started (`docker-compose up -d`)
- [ ] Can access app in browser via Bosch VM IP
- [ ] Can login with test credentials

**If all boxes are checked, deployment is successful!**

---

# SECURITY REMINDER

```
+------------------------------------------------------------------+
|  WHAT WENT TO BOSCH:                                             |
|  ✅ Compiled Docker image (no readable source code)              |
|  ✅ docker-compose.yml (configuration only)                      |
|  ✅ .env file (configuration only)                               |
|                                                                  |
|  WHAT STAYED WITH YOU:                                           |
|  ✅ Source code (TypeScript, React, Python)                      |
|  ✅ GitHub repository (private, your control)                    |
|  ✅ Full intellectual property                                   |
+------------------------------------------------------------------+
```

**Your source code is safe!**

---

**Congratulations! You've successfully deployed LedgerLM using Docker Desktop!**
