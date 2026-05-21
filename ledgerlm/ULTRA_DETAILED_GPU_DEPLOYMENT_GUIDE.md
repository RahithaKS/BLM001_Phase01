# LedgerLM GPU Deployment Guide
## Ultra-Granular Step-by-Step with Expected Outputs

---

# SECURITY: CODE PROTECTION

```
+------------------+     +---------+     +------------------+
|  SOURCE CODE     |     |  IMAGE  |     |  NO SOURCE CODE  |
|  (Matasma Only)  | --> |  (ACR)  | --> |  (Bosch VM)      |
+------------------+     +---------+     +------------------+
```

**IMPORTANT:** Source code NEVER leaves Matasma laptop. Only compiled Docker images are pushed to ACR and pulled by Bosch VM. Bosch VM cannot see your source code.

---

# CONTAINERS: 2 TOTAL

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BOSCH VM                                    │
│                                                                     │
│  ┌─────────────────────┐      ┌─────────────────────────────────┐  │
│  │  ledgerlm-db        │      │  ledgerlm-app                   │  │
│  │  (PostgreSQL 16)    │◄────►│  (Node.js + Python + Nginx)     │  │
│  │                     │      │                                 │  │
│  │  Port: 5432         │      │  Port: 80 (web)                 │  │
│  │  Volume: postgres_  │      │  Volume: app_uploads            │  │
│  │          data       │      │  GPU: Tesla T4                  │  │
│  └─────────────────────┘      └─────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

| Container | Image | Purpose |
|-----------|-------|---------|
| `ledgerlm-db` | `postgres:16` | PostgreSQL database |
| `ledgerlm-app` | `boschledgerlm.azurecr.io/ledgerlm-app:vX.X.X-gpu` | Application (from ACR) |

---

# FILES CHECKLIST

## Files on MATASMA LAPTOP (with source code)

| # | File Name | Location | Purpose |
|---|-----------|----------|---------|
| 1 | `Dockerfile.gpu` | `C:\Projects\LedgerLM\` | Used to build image |
| 2 | `client/`, `server/`, `python_backend/` | `C:\Projects\LedgerLM\` | Source code (STAYS HERE) |
| 3 | All other project files | `C:\Projects\LedgerLM\` | Source code (STAYS HERE) |

## Files on BOSCH VM (NO source code)

| # | File Name | Location | Purpose |
|---|-----------|----------|---------|
| 1 | `docker-compose.yml` | `~/ledgerlm/` | Config to run container (you type this) |
| 2 | `.env` | `~/ledgerlm/` | Passwords and API keys (you type this) |

## What Goes to Azure Container Registry

| # | What | Contains |
|---|------|----------|
| 1 | Docker Image | Compiled application (not readable source code) |

---

# PART A: SETUP MATASMA LAPTOP (ONE TIME)

---

## Step 1: Open Web Browser

**Action:** Double-click Chrome or Edge icon on your desktop

**Expected:** Browser window opens

**Next:** Go to Step 2

---

## Step 2: Download Docker Desktop

**Action:** Type this URL in browser address bar:
```
https://www.docker.com/products/docker-desktop/
```

**Expected:** Docker website loads with download button

**Next:** Go to Step 3

---

## Step 3: Click Download Button

**Action:** Click the blue "Download for Windows" button

**Expected:** File `Docker Desktop Installer.exe` starts downloading (about 500MB)

**Next:** Wait for download to complete, then go to Step 4

---

## Step 4: Run Docker Installer

**Action:** Double-click `Docker Desktop Installer.exe` in your Downloads folder

**Expected:** Installation wizard opens

**Next:** Go to Step 5

---

## Step 5: Configure Docker Installation

**Action:** Check the box that says "Use WSL 2 instead of Hyper-V"

**Expected:** Checkbox is checked

**Action:** Click "OK" button

**Expected:** Installation progress bar appears

**Next:** Wait 5-10 minutes for installation, then go to Step 6

---

## Step 6: Restart Computer

**Action:** Click "Close and restart" button

**Expected:** Computer restarts

**Next:** After computer restarts, go to Step 7

---

## Step 7: Open Docker Desktop

**Action:** Click Start menu, type "Docker Desktop", click on it

**Expected:** Docker Desktop window opens with loading animation

**Next:** Wait 1-2 minutes until you see green "Engine running" status, then go to Step 8

---

## Step 8: Accept Docker Terms

**Action:** Click "Accept" button on terms screen

**Expected:** Docker dashboard appears

**Next:** Go to Step 9

---

## Step 9: Verify Docker Installation

**Action:** Press Windows key + R, type `cmd`, press Enter

**Expected:** Black command prompt window opens

**Action:** Type this command and press Enter:
```batch
docker --version
```

**Expected Output:**
```
Docker version 24.0.7, build afdd53b
```
(Version number may vary)

**If you see this:** Docker is installed. Go to Step 10.

**If you see "command not found":** Restart computer and try again.

---

## Step 10: Open Replit in Browser

**Action:** Open browser and go to:
```
https://replit.com
```

**Expected:** Replit website loads

**Action:** Sign in to your account

**Expected:** Your projects list appears

**Next:** Go to Step 11

---

## Step 11: Find LedgerLM Project

**Action:** Click on your LedgerLM project

**Expected:** Project opens in Replit editor

**Next:** Go to Step 12

---

## Step 12: Download Code from Replit

**Action:** Click the three dots menu (⋮) next to project name in top left

**Expected:** Dropdown menu appears

**Action:** Click "Download as zip"

**Expected:** File `LedgerLM-main.zip` starts downloading

**Next:** Wait for download, then go to Step 13

---

## Step 13: Create Project Folder

**Action:** Open File Explorer (Windows key + E)

**Action:** Navigate to `C:\`

**Action:** Right-click in empty space, click "New" → "Folder"

**Action:** Name the folder `Projects`

**Expected:** Folder `C:\Projects` is created

**Next:** Go to Step 14

---

## Step 14: Extract Downloaded Code

**Action:** Go to Downloads folder

**Action:** Right-click on `LedgerLM-main.zip`

**Action:** Click "Extract All..."

**Action:** Change destination to: `C:\Projects\LedgerLM`

**Action:** Click "Extract"

**Expected:** Files are extracted to `C:\Projects\LedgerLM`

**Verify:** Open `C:\Projects\LedgerLM` - you should see:
```
C:\Projects\LedgerLM\
├── Dockerfile.gpu         ✓ This file must exist
├── docker-compose.gpu.yml ✓ This file must exist
├── client\
├── server\
├── python_backend\
├── shared\
└── (other files)
```

**Next:** Go to Step 15

---

# PART B: BUILD DOCKER IMAGE (EVERY DEPLOY)

---

## Step 15: Open Command Prompt in Project Folder

**Action:** Open File Explorer

**Action:** Navigate to `C:\Projects\LedgerLM`

**Action:** Click in the address bar at the top (where it shows the path)

**Action:** Type `cmd` and press Enter

**Expected:** Command prompt opens showing:
```
C:\Projects\LedgerLM>
```

**Next:** Go to Step 16

---

## Step 16: Login to Azure Container Registry

**Action:** Type this command and press Enter:
```batch
docker login boschledgerlm.azurecr.io
```

**Expected:** Prompt asks for username

**Action:** Type your ACR username and press Enter

**Expected:** Prompt asks for password

**Action:** Type your ACR password and press Enter

**Expected Output:**
```
Login Succeeded
```

**If you see "Login Succeeded":** Go to Step 17

**If you see "unauthorized":** Check your username/password with your Azure admin

---

## Step 17: Build Docker Image

**Action:** Type this command and press Enter:
```batch
docker build -f Dockerfile.gpu -t boschledgerlm.azurecr.io/ledgerlm-app:v1.0.30-gpu .
```

**IMPORTANT:** Don't forget the dot (.) at the end!

**Expected:** Build process starts. You will see:
```
[+] Building 0.5s (1/1) FINISHED
 => [internal] load build definition from Dockerfile.gpu
 => => transferring dockerfile: 5.02kB
```

Then many more lines as it downloads and builds...

**Wait Time:** 15-25 minutes

**Expected Final Output:**
```
Successfully built abc123def456
Successfully tagged boschledgerlm.azurecr.io/ledgerlm-app:v1.0.30-gpu
```

**If you see "Successfully":** Go to Step 18

**If you see "ERROR: failed to solve":** Check Troubleshooting section at bottom

---

## Step 18: Verify Image was Created

**Action:** Type this command and press Enter:
```batch
docker images
```

**Expected Output:**
```
REPOSITORY                                    TAG           IMAGE ID       CREATED          SIZE
boschledgerlm.azurecr.io/ledgerlm-app        v1.0.30-gpu   abc123def456   2 minutes ago    2.5GB
```

**If you see the image listed:** Go to Step 19

**If image is not listed:** Re-run Step 17

---

## Step 19: Push Image to Azure Container Registry

**Action:** Type this command and press Enter:
```batch
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.30-gpu
```

**Expected:** Upload progress appears:
```
The push refers to repository [boschledgerlm.azurecr.io/ledgerlm-app]
abc123: Pushing [==>                                                ]  50MB/1.2GB
```

**Wait Time:** 5-15 minutes depending on internet speed

**Expected Final Output:**
```
v1.0.30-gpu: digest: sha256:abc123... size: 3256
```

**If you see the digest:** Image is uploaded! Go to Step 20

---

# PART C: SETUP BOSCH VM (ONE TIME)

---

## Step 20: Open SSH Connection to VM

**Action:** Open Command Prompt (Windows key + R, type `cmd`, Enter)

**Action:** Type this command (replace YOUR_VM_IP with actual IP):
```batch
ssh ledgerllm@YOUR_VM_IP
```

**Example:**
```batch
ssh ledgerllm@168.63.129.16
```

**Expected:** Prompt asks for password

**Action:** Type your VM password and press Enter

**Expected Output:**
```
Welcome to Ubuntu 22.04.3 LTS
ledgerllm@ledger-llm-VM:~$
```

**If you see the prompt:** You are connected! Go to Step 21

---

## Step 21: Verify GPU is Working

**Action:** Type this command and press Enter:
```bash
nvidia-smi
```

**Expected Output:**
```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 535.274.02    Driver Version: 535.274.02    CUDA Version: 12.2  |
|-------------------------------+----------------------+----------------------|
| GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
|   0  Tesla T4            Off  | 00000001:00:00.0 Off |                    0 |
+-----------------------------------------------------------------------------+
```

**If you see Tesla T4:** GPU is working! Go to Step 22

**If you see "command not found":** GPU drivers not installed, contact your admin

---

## Step 22: Install NVIDIA Container Toolkit

**Action:** Type this command and press Enter:
```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
```

**Expected:** May ask for password, then no output (that's OK)

**Action:** Type this command and press Enter:
```bash
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
```

**Expected Output:** Shows the repository URL

**Action:** Type this command and press Enter:
```bash
sudo apt-get update
```

**Expected:** Package lists update (many lines)

**Action:** Type this command and press Enter:
```bash
sudo apt-get install -y nvidia-container-toolkit
```

**Expected:** Package installs

**Action:** Type this command and press Enter:
```bash
sudo nvidia-ctk runtime configure --runtime=docker
```

**Expected Output:**
```
INFO[0000] Config file path: /etc/docker/daemon.json
INFO[0000] Successfully updated config file
```

**Action:** Type this command and press Enter:
```bash
sudo systemctl restart docker
```

**Expected:** No output (that's OK)

**Next:** Go to Step 23

---

## Step 23: Verify Docker Can Access GPU

**Action:** Type this command and press Enter:
```bash
docker run --rm --gpus all nvidia/cuda:12.2.2-runtime-ubuntu22.04 nvidia-smi
```

**Wait Time:** 1-2 minutes (downloads CUDA image first time)

**Expected Output:**
```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 535.274.02    Driver Version: 535.274.02    CUDA Version: 12.2  |
|   0  Tesla T4            ...                                                |
+-----------------------------------------------------------------------------+
```

**If you see Tesla T4:** Docker GPU access works! Go to Step 24

---

## Step 24: Create Application Directory and .env File

**Action:** Type this command and press Enter:
```bash
mkdir -p ~/ledgerlm
```

**Expected:** No output (that's OK)

**Action:** Type this command and press Enter:
```bash
cd ~/ledgerlm
```

**Expected:** Prompt changes to show `~/ledgerlm`

**Action:** Type this command and press Enter:
```bash
nano .env
```

**Expected:** Text editor opens (blank screen with menu at bottom)

**Action:** Type or paste this content (fill in YOUR values):
```
POSTGRES_USER=ledgerlm_app
POSTGRES_PASSWORD=YOUR_DATABASE_PASSWORD_HERE
POSTGRES_PORT=5432
POSTGRES_DB=ledgerlm
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY_HERE
SESSION_SECRET=type32randomcharactershere1234567
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASSWORD=your-email-password
SMTP_FROM=ledgerlm@bosch.com
```

**Action:** Press Ctrl+O (to save)

**Expected:** Prompt asks "File Name to Write"

**Action:** Press Enter (to confirm filename)

**Expected:** Shows "Wrote X lines"

**Action:** Press Ctrl+X (to exit)

**Expected:** Returns to command prompt

**Verify:** Type this and press Enter:
```bash
cat .env
```

**Expected:** Shows your .env content

**Next:** Go to Step 25

---

## Step 25: Create docker-compose.yml File (2 Containers)

**Action:** Type this command and press Enter:
```bash
nano ~/ledgerlm/docker-compose.yml
```

**Expected:** Text editor opens

**Action:** Paste this exact content (includes BOTH database and app containers):
```yaml
services:
  db:
    image: postgres:16
    container_name: ledgerlm-db
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  app:
    image: boschledgerlm.azurecr.io/ledgerlm-app:v1.0.30-gpu
    container_name: ledgerlm-app
    restart: always
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "80:80"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@ledgerlm-db:5432/${POSTGRES_DB}
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
      NVIDIA_VISIBLE_DEVICES: all
      CUDA_VISIBLE_DEVICES: "0"
    runtime: nvidia
    volumes:
      - app_uploads:/app/uploads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 90s

volumes:
  postgres_data:
    driver: local
  app_uploads:
    driver: local
```

**Action:** Press Ctrl+O, then Enter, then Ctrl+X

**Expected:** File saved, returns to prompt

**Next:** Go to Step 26

---

## Step 26: Login to ACR on VM

**Action:** Type this command and press Enter:
```bash
docker login boschledgerlm.azurecr.io
```

**Action:** Enter username when prompted

**Action:** Enter password when prompted

**Expected Output:**
```
Login Succeeded
```

**Next:** Go to Step 27

---

# PART D: START APPLICATION

---

## Step 27: Pull Images from ACR

**Action:** Type this command and press Enter:
```bash
cd ~/ledgerlm
docker compose pull
```

**Expected Output:**
```
[+] Pulling 2/2
 ✔ db Pulled
 ✔ app Pulled
```

**Wait Time:** 3-10 minutes (app image is large)

**Next:** Go to Step 28

---

## Step 28: Start the Application (2 Containers)

**Action:** Type this command and press Enter:
```bash
docker compose up -d
```

**Expected Output:**
```
[+] Running 4/4
 ✔ Network ledgerlm_default    Created
 ✔ Volume ledgerlm_postgres_data Created
 ✔ Container ledgerlm-db       Started
 ✔ Container ledgerlm-app      Started
```

**Note:** Database starts first, then app starts after database is healthy

**Next:** Go to Step 29

---

## Step 29: Verify Both Containers are Running

**Action:** Type this command and press Enter:
```bash
docker ps
```

**Expected Output (2 containers):**
```
CONTAINER ID   IMAGE                                              STATUS          PORTS
abc123def456   boschledgerlm.azurecr.io/ledgerlm-app:v1.0.30-gpu  Up (healthy)   0.0.0.0:80->80/tcp
def789ghi012   postgres:16                                        Up (healthy)   0.0.0.0:5432->5432/tcp
```

**Check:** Both containers should show STATUS "Up" (after 2 minutes: "Up (healthy)")

**If both show "Up":** Go to Step 30

**If ledgerlm-db missing:** Run `docker logs ledgerlm-db` to see database errors

**If ledgerlm-app missing:** Run `docker logs ledgerlm-app` to see app errors

---

## Step 30: Check Logs for Startup

**Action:** Type this command and press Enter:
```bash
docker logs ledgerlm-app
```

**Expected Output (look for these lines):**
```
=== Running database migrations ===
...
=== Starting services ===
2024-XX-XX XX:XX:XX,XXX INFO spawned: 'nginx' with pid 123
2024-XX-XX XX:XX:XX,XXX INFO spawned: 'node-backend' with pid 124
2024-XX-XX XX:XX:XX,XXX INFO spawned: 'python-backend' with pid 125
```

**If you see these lines:** Application started! Go to Step 31

---

## Step 31: Verify GPU Inside Container

**Action:** Type this command and press Enter:
```bash
docker exec ledgerlm-app nvidia-smi
```

**Expected Output:**
```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 535.274.02    Driver Version: 535.274.02    CUDA Version: 12.2  |
|   0  Tesla T4            ...                                                |
+-----------------------------------------------------------------------------+
```

**If you see Tesla T4:** GPU is accessible inside container!

**Next:** Go to Step 32

---

## Step 32: Test Health Endpoint

**Action:** Type this command and press Enter:
```bash
curl http://localhost/api/health
```

**Expected Output:**
```json
{"status":"ok"}
```

**If you see this:** API is working! Go to Step 33

---

## Step 33: Open in Browser

**Action:** On your Matasma laptop, open browser

**Action:** Go to: `http://YOUR_VM_IP` (example: `http://168.63.129.16`)

**Expected:** LedgerLM login page appears

**DONE! Application is deployed!**

---

# UPDATING TO NEW VERSION

When you have new code changes, follow these steps:

## On Matasma Laptop:

1. Download latest code from Replit (Steps 11-14)
2. Build with NEW version number:
```batch
docker build -f Dockerfile.gpu -t boschledgerlm.azurecr.io/ledgerlm-app:v1.0.30-gpu .
```
3. Push:
```batch
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.30-gpu
```

## On Bosch VM:

1. Edit docker-compose.yml:
```bash
nano ~/ledgerlm/docker-compose.yml
```
2. Change version from `v1.0.30-gpu` to `v1.0.30-gpu`
3. Save and exit (Ctrl+O, Enter, Ctrl+X)
4. Pull and restart:
```bash
cd ~/ledgerlm
docker compose pull
docker compose up -d
```

---

# TROUBLESHOOTING

## Error: "unknown instruction: test" during build

**Cause:** Windows line endings in Dockerfile.gpu

**Fix:** Re-download Dockerfile.gpu from Replit (it has been fixed)

---

## Error: Container exits immediately

**Action:** Check logs:
```bash
docker logs ledgerlm-app
```

**Look for:** Error messages about database connection or missing environment variables

---

## Error: "unauthorized" when logging into ACR

**Fix:** Get correct credentials from Azure Portal → Container Registry → Access Keys

---

## Error: GPU not detected in container

**Fix:** Run these commands on VM:
```bash
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

Then restart container:
```bash
cd ~/ledgerlm
docker compose down
docker compose up -d
```
