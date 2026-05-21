# LedgerLM Complete Deployment Guide
## From Matasma Laptop to Bosch Azure - Final Version

**Last Updated: December 2025**
**Version: 1.1 (Includes all bug fixes and lessons learned)**

---

## CRITICAL SECURITY REQUIREMENT

```
+------------------------------------------------------------------+
|                    SOURCE CODE PROTECTION                         |
|                                                                   |
|   Source code NEVER leaves your Matasma laptop!                  |
|   Only compiled Docker images go to Bosch infrastructure.        |
|                                                                   |
|   [MATASMA LAPTOP] ---> [COMPILED IMAGE] ---> [BOSCH ACR/VM]     |
|   (Source Code)         (No Source!)          (Runs App)          |
+------------------------------------------------------------------+
```

---

## Network Architecture

```
+------------------------------------------------------------------+
|  MATASMA SIDE (Your Control)                                      |
|                                                                   |
|  [Matasma Laptop]                                                 |
|     ├── Source code (TypeScript, React, Python)                   |
|     ├── Docker Desktop                                            |
|     ├── Builds Docker image                                       |
|     └── Pushes to Bosch ACR (via Internet)                       |
|                                                                   |
+------------------------------------------------------------------+
                              |
                              | Compiled Docker Image Only
                              v
+------------------------------------------------------------------+
|  BOSCH SIDE (Client Infrastructure)                               |
|                                                                   |
|  [Bosch Laptop]                                                   |
|     └── Accesses VM via Azure Bastion (browser-based)            |
|                                                                   |
|  [Bosch ACR] (boschledgerlm.azurecr.io)                          |
|     └── Stores compiled Docker images                             |
|                                                                   |
|  [Bosch VM] (ledger-llm-VM)                                       |
|     └── Pulls image from ACR                                      |
|     └── Runs LedgerLM application                                 |
|     └── PostgreSQL + pgvector installed                           |
|                                                                   |
+------------------------------------------------------------------+

IMPORTANT: You CANNOT SSH directly from Matasma laptop to Bosch VM!
           Bosch VM access is ONLY via Azure Bastion from Bosch laptop.
```

---

## Table of Contents

| Section | Description | Time |
|---------|-------------|------|
| 1 | Prerequisites & Setup | 5 min read |
| 2 | Install Docker Desktop (Matasma) | 15-20 min |
| 3 | Prepare Code & Environment | 10 min |
| 4 | Build Docker Image | 15-20 min |
| 5 | Push to Bosch ACR | 10-15 min |
| 6 | Access Bosch VM via Bastion | 5 min |
| 7 | Install Docker on Bosch VM | 15 min |
| 8 | Install PostgreSQL + pgvector | 20 min |
| 9 | Deploy Application | 15 min |
| 10 | Verify & Test | 10 min |
| 11 | Troubleshooting Guide | Reference |
| 12 | Quick Reference Commands | Reference |

**Total First-Time Setup: ~2 hours**
**Subsequent Deployments: ~15 minutes**

---

# SECTION 1: Prerequisites & Setup

## 1.1 What You Need

### On Matasma Laptop:
- [ ] Windows 10/11 (64-bit)
- [ ] Administrator access
- [ ] 10+ GB free disk space
- [ ] Docker Desktop installed
- [ ] LedgerLM source code
- [ ] Internet connection

### On Bosch Side:
- [ ] Access to Bosch laptop
- [ ] Azure Portal access (portal.azure.com)
- [ ] Bosch ACR credentials (see Section 1.2)
- [ ] Azure Bastion access to VM

### Bosch Azure Resources:
| Resource | Value |
|----------|-------|
| Container Registry | boschledgerlm.azurecr.io |
| VM Name | ledger-llm-VM |
| VM Public IP | 20.193.250.55 |
| Resource Group | Ask Bosch IT |

---

## 1.2 Get Bosch ACR Credentials

**Where:** Azure Portal (from Bosch laptop)

**Steps:**
1. Go to: https://portal.azure.com
2. Search for: "Container registries"
3. Click: "boschledgerlm"
4. Left menu: Click "Access keys"
5. Toggle ON: "Admin user" (if not already enabled)
6. Copy these values:
   ```
   Login server:  boschledgerlm.azurecr.io
   Username:      boschledgerlm
   Password:      [Copy password or password2]
   ```

**EXPECTED OUTCOME:**
```
+--------------------------------------------------+
| Access keys                                       |
|                                                  |
| Admin user: [ENABLED]                            |
|                                                  |
| Login server: boschledgerlm.azurecr.io           |
| Username: boschledgerlm                          |
| Password: ********************************       |
| Password2: ********************************      |
+--------------------------------------------------+
```

**Keep these credentials safe - you'll need them!**

---

# SECTION 2: Install Docker Desktop on Matasma Laptop

## 2.1 Check System Requirements

**Command:**
1. Press: `Windows + R`
2. Type: `winver`
3. Press: Enter

**EXPECTED OUTCOME:**
```
+------------------------------------------+
| About Windows                            |
|                                          |
| Windows 10 Pro                           |
| Version 22H2 (OS Build 19045.xxxx)       |
|                                          |
+------------------------------------------+
```

**SUCCESS:** Windows 10 version 1903+ or Windows 11 shown.

---

## 2.2 Check Virtualization

**Steps:**
1. Press: `Ctrl + Shift + Esc` (Task Manager)
2. Click: "Performance" tab
3. Click: "CPU"

**EXPECTED OUTCOME:**
```
+------------------------------------------+
| Performance > CPU                        |
|                                          |
| Utilization: 15%                         |
| Speed: 2.60 GHz                          |
| ...                                      |
| Virtualization: Enabled  <-- CHECK THIS  |
+------------------------------------------+
```

**SUCCESS:** "Virtualization: Enabled" displayed.
**FAILURE:** If "Disabled", enable in BIOS or contact IT.

---

## 2.3 Download & Install Docker Desktop

**Steps:**
1. Go to: https://www.docker.com/products/docker-desktop/
2. Click: "Download for Windows"
3. Run: `Docker Desktop Installer.exe`
4. Keep default options:
   - [x] Use WSL 2 instead of Hyper-V
   - [x] Add shortcut to desktop
5. Click: "Ok" and wait for installation
6. Click: "Close and restart"

**EXPECTED OUTCOME (During Installation):**
```
+------------------------------------------+
| Docker Desktop Installer                 |
|                                          |
| Installing components...                 |
| ████████████████████░░░░ 80%            |
|                                          |
+------------------------------------------+
```

**EXPECTED OUTCOME (After Installation):**
```
+------------------------------------------+
| Installation succeeded                   |
|                                          |
| [Close and restart]                      |
+------------------------------------------+
```

**SUCCESS:** Computer restarts, Docker whale icon appears in system tray.

---

## 2.4 Verify Docker Installation

**Command:**
```cmd
docker --version
```

**EXPECTED OUTCOME:**
```
Docker version 24.0.7, build afdd53b
```

**SUCCESS:** Version number displayed (24.x.x or higher).
**FAILURE:** "docker is not recognized" = Docker not installed properly.

---

# SECTION 3: Prepare Code & Environment

## 3.1 Open Project Folder

**Command:**
```cmd
cd C:\path\to\your\ledgerlm-project
```

**EXPECTED OUTCOME:**
```
C:\Users\YourName\ledgerlm-project>
```

**SUCCESS:** Command prompt shows your project folder path.

---

## 3.2 Verify Required Files Exist

**Command:**
```cmd
dir Dockerfile docker-compose.vm-postgres.yml .env.vm-postgres.example
```

**EXPECTED OUTCOME:**
```
 Directory of C:\Users\YourName\ledgerlm-project

12/01/2025  10:30 AM            6,543 Dockerfile
12/01/2025  10:30 AM            2,156 docker-compose.vm-postgres.yml
12/01/2025  10:30 AM            1,823 .env.vm-postgres.example
               3 File(s)         10,522 bytes
```

**SUCCESS:** All three files listed.
**FAILURE:** "File Not Found" = Missing required files.

---

## 3.3 Create Environment File

**Command:**
```cmd
copy .env.vm-postgres.example .env
```

**EXPECTED OUTCOME:**
```
        1 file(s) copied.
```

**SUCCESS:** .env file created.

**Next:** Edit `.env` file with your actual values using Notepad:

```cmd
notepad .env
```

**Update these values:**
```env
# PostgreSQL Connection (Will be on Bosch VM)
POSTGRES_HOST=172.17.0.1
POSTGRES_PORT=5432
POSTGRES_DB=ledgerlm
POSTGRES_USER=ledgerlm
POSTGRES_PASSWORD=SSrrsKS@05

# Application Settings
APP_PORT=80
SESSION_SECRET=your-random-32-character-string-here

# OpenAI API Key
OPENAI_API_KEY=sk-your-actual-openai-key

# Email Configuration
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_USER=customer@ledgerlm.ai
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=customer@ledgerlm.ai

# Testing (Bypasses Email OTP)
NEMKO_ADMIN_OTP=123456
```

**SUCCESS:** File saved with your actual values.

---

# SECTION 4: Build Docker Image

## 4.1 Make Sure Docker Desktop is Running

**Steps:**
1. Look for Docker whale icon in system tray (bottom right)
2. If not running, double-click Docker Desktop shortcut
3. Wait for status

**EXPECTED OUTCOME:**
```
+------------------------------------------+
| Docker Desktop                           |
|                                          |
| Docker Desktop is running                |
| Engine running                           |
+------------------------------------------+
```

**SUCCESS:** Docker whale icon is white (not red), tooltip shows "Docker Desktop is running".
**FAILURE:** Red whale icon = Docker not started, wait or restart Docker Desktop.

---

## 4.2 Build the Image

**Command:**
```cmd
docker build -t boschledgerlm.azurecr.io/ledgerlm-app:latest -t boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1 .
```

**EXPECTED OUTCOME (During Build - 10-20 minutes):**
```
[+] Building 847.3s (25/25) FINISHED
 => [internal] load build definition from Dockerfile                    0.1s
 => [internal] load .dockerignore                                       0.0s
 => [internal] load metadata for docker.io/library/node:20-bullseye     1.2s
 => [node-builder 1/7] FROM docker.io/library/node:20-bullseye         45.3s
 => [node-builder 2/7] WORKDIR /app                                     0.1s
 => [node-builder 3/7] COPY package*.json ./                            0.1s
 => [node-builder 4/7] RUN npm ci                                     120.5s
 => [node-builder 5/7] COPY client ./client                             0.5s
 => [node-builder 6/7] COPY server ./server                             0.2s
 => [node-builder 7/7] RUN npm run build                               85.2s
 => [stage-1  1/15] FROM docker.io/library/node:20-bullseye-slim       32.1s
 => [stage-1  2/15] RUN apt-get update && apt-get install -y...       180.3s
 => [stage-1  3/15] WORKDIR /app                                        0.0s
 => [stage-1  4/15] COPY package*.json ./                               0.1s
 => [stage-1  5/15] RUN npm ci --only=production                       65.2s
 => [stage-1  6/15] RUN npm install -g tsx                             12.3s
 => [stage-1  7/15] RUN npm install vite                               15.1s
 => ...
 => exporting to image                                                   5.2s
 => => naming to boschledgerlm.azurecr.io/ledgerlm-app:latest           0.0s
 => => naming to boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1           0.0s
```

**SUCCESS:** Build completes with "naming to boschledgerlm.azurecr.io/ledgerlm-app:latest".
**FAILURE:** Red error messages = Check Dockerfile or source code issues.

---

## 4.3 Verify Image Was Created

**Command:**
```cmd
docker images | findstr ledgerlm
```

**EXPECTED OUTCOME:**
```
boschledgerlm.azurecr.io/ledgerlm-app   latest    a1b2c3d4e5f6   2 minutes ago   2.19GB
boschledgerlm.azurecr.io/ledgerlm-app   v1.0.1    a1b2c3d4e5f6   2 minutes ago   2.19GB
```

**SUCCESS:** Two rows shown with `latest` and `v1.0.1` tags, size ~2.19GB.
**FAILURE:** No output = Build failed, re-run build command.

---

# SECTION 5: Push to Bosch ACR

## 5.1 Login to Bosch ACR

**Command:**
```cmd
docker login boschledgerlm.azurecr.io
```

**EXPECTED PROMPTS AND OUTCOME:**
```
Username: boschledgerlm
Password: [paste password from Azure Portal - characters won't show]

Login Succeeded
```

**SUCCESS:** "Login Succeeded" displayed.
**FAILURE:** "unauthorized: authentication required" = Wrong username/password.

---

## 5.2 Push the Image

**Commands:**
```cmd
docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1
```

**EXPECTED OUTCOME (5-15 minutes depending on internet):**
```
The push refers to repository [boschledgerlm.azurecr.io/ledgerlm-app]
5f70bf18a086: Pushed
a1b2c3d4e5f6: Pushed
b2c3d4e5f6a7: Pushed
c3d4e5f6a7b8: Pushed
d4e5f6a7b8c9: Pushed
e5f6a7b8c9d0: Pushed
f6a7b8c9d0e1: Pushed
latest: digest: sha256:abc123def456... size: 3256

The push refers to repository [boschledgerlm.azurecr.io/ledgerlm-app]
5f70bf18a086: Layer already exists
a1b2c3d4e5f6: Layer already exists
...
v1.0.1: digest: sha256:abc123def456... size: 3256
```

**SUCCESS:** Both pushes complete with "digest: sha256:..." shown.
**FAILURE:** "denied: requested access to the resource is denied" = Not logged in or wrong ACR name.

---

## 5.3 Verify Image in ACR (Optional)

**From Bosch laptop, in Azure Portal:**
1. Go to: Container registries > boschledgerlm
2. Click: Repositories
3. Click: ledgerlm-app

**EXPECTED OUTCOME:**
```
+--------------------------------------------------+
| Repositories > ledgerlm-app                       |
|                                                  |
| Tags:                                            |
| ┌─────────┬─────────────────┬──────────────┐    |
| │ Tag     │ Last Updated    │ Size         │    |
| ├─────────┼─────────────────┼──────────────┤    |
| │ latest  │ 2 minutes ago   │ 2.19 GB      │    |
| │ v1.0.1  │ 2 minutes ago   │ 2.19 GB      │    |
| └─────────┴─────────────────┴──────────────┘    |
+--------------------------------------------------+
```

**SUCCESS:** Both `latest` and `v1.0.1` tags visible.

---

# SECTION 6: Access Bosch VM via Azure Bastion

**IMPORTANT: This is done from BOSCH LAPTOP, not Matasma laptop!**

## 6.1 Connect via Azure Bastion

**Steps:**
1. Go to: https://portal.azure.com (from Bosch laptop)
2. Search for: "Virtual machines"
3. Click: "ledger-llm-VM"
4. Click: "Connect" > "Bastion"
5. Enter VM credentials:
   ```
   Username: [Ask Bosch IT]
   Password: [Ask Bosch IT]
   ```
6. Click: "Connect"

**EXPECTED OUTCOME:**
```
+------------------------------------------------------------------+
| Azure Bastion - ledger-llm-VM                                     |
|                                                                   |
| Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-1052-azure)      |
|                                                                   |
| azureuser@ledger-llm-VM:~$                                        |
+------------------------------------------------------------------+
```

**SUCCESS:** Black terminal window opens in browser with command prompt.
**FAILURE:** "Connection failed" = Check VM is running or credentials.

---

## 6.2 Azure Bastion Limitations - CRITICAL!

**WARNING: Keyboard shortcuts behave differently in browser terminal!**

| What You Want | DON'T Do | DO This Instead |
|--------------|----------|-----------------|
| Search in nano | Ctrl+W (CLOSES BROWSER TAB!) | Use `grep` or `sed` |
| Copy text | Ctrl+C | Right-click > Copy |
| Paste text | Ctrl+V | Right-click > Paste |
| Edit files | nano/vim | Use `cat`, `sed`, or `echo` |

**EXPECTED OUTCOME (If you accidentally press Ctrl+W):**
```
Browser tab closes! You lose your session!
```

**SOLUTION:** Always use `cat`, `sed`, `echo` commands for file editing (shown in Section 9).

---

# SECTION 7: Install Docker on Bosch VM

**All commands in this section run on Bosch VM (via Azure Bastion)**

## 7.1 Update System

**Commands:**
```bash
sudo apt-get update
sudo apt-get upgrade -y
```

**EXPECTED OUTCOME:**
```
Hit:1 http://azure.archive.ubuntu.com/ubuntu jammy InRelease
Get:2 http://azure.archive.ubuntu.com/ubuntu jammy-updates InRelease [119 kB]
...
Reading package lists... Done
Building dependency tree... Done
...
0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.
```

**SUCCESS:** "Done" messages without errors.

---

## 7.2 Install Docker

**Commands (run one by one):**

```bash
# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg lsb-release
```

**EXPECTED OUTCOME:**
```
Reading package lists... Done
Building dependency tree... Done
ca-certificates is already the newest version...
0 upgraded, 0 newly installed, 0 to remove...
```

```bash
# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

**EXPECTED OUTCOME:**
```
(no output = success)
```

```bash
# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

**EXPECTED OUTCOME:**
```
(no output = success)
```

```bash
# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

**EXPECTED OUTCOME:**
```
Reading package lists... Done
...
Setting up docker-ce (5:24.0.7-1~ubuntu.22.04~jammy) ...
Setting up docker-compose-plugin (2.21.0-1~ubuntu.22.04~jammy) ...
```

**SUCCESS:** "Setting up docker-ce" and "docker-compose-plugin" shown.

---

## 7.3 Configure Docker Permissions

**Commands:**
```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Apply changes
newgrp docker
```

**EXPECTED OUTCOME:**
```
(no output = success, prompt returns)
```

---

## 7.4 Verify Docker Installation

**Commands:**
```bash
docker --version
docker compose version
```

**EXPECTED OUTCOME:**
```
Docker version 24.0.7, build afdd53b
Docker Compose version v2.21.0
```

**SUCCESS:** Both version numbers displayed.
**FAILURE:** "permission denied" = Run the usermod command again.

---

# SECTION 8: Install PostgreSQL + pgvector on Bosch VM

## 8.1 Install PostgreSQL 14

**Command:**
```bash
sudo apt-get install -y postgresql-14 postgresql-contrib-14
```

**EXPECTED OUTCOME:**
```
Reading package lists... Done
...
Setting up postgresql-14 (14.10-0ubuntu0.22.04.1) ...
Creating new PostgreSQL cluster 14/main ...
/usr/lib/postgresql/14/bin/initdb...
Success.
```

**SUCCESS:** "Success" and "Setting up postgresql-14" shown.

---

## 8.2 Start PostgreSQL

**Commands:**
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl status postgresql
```

**EXPECTED OUTCOME:**
```
Synchronizing state of postgresql.service...
Created symlink /etc/systemd/system/multi-user.target.wants/postgresql.service

● postgresql.service - PostgreSQL RDBMS
     Loaded: loaded (/lib/systemd/system/postgresql.service; enabled)
     Active: active (exited) since Mon 2025-12-01 10:30:00 UTC
   Main PID: 12345 (code=exited, status=0/SUCCESS)
        CPU: 25ms
```

**SUCCESS:** "Active: active" shown in green.
**FAILURE:** "Active: failed" = Check logs with `journalctl -xe`.

---

## 8.3 Create Database and User

**Command:**
```bash
sudo -u postgres psql
```

**EXPECTED OUTCOME:**
```
psql (14.10 (Ubuntu 14.10-0ubuntu0.22.04.1))
Type "help" for help.

postgres=#
```

**SUCCESS:** `postgres=#` prompt appears.

**Now run these SQL commands one by one:**

```sql
CREATE USER ledgerlm WITH PASSWORD 'SSrrsKS@05';
```
**EXPECTED:** `CREATE ROLE`

```sql
CREATE DATABASE ledgerlm OWNER ledgerlm;
```
**EXPECTED:** `CREATE DATABASE`

```sql
GRANT ALL PRIVILEGES ON DATABASE ledgerlm TO ledgerlm;
```
**EXPECTED:** `GRANT`

```sql
\c ledgerlm
```
**EXPECTED:** `You are now connected to database "ledgerlm" as user "postgres".`

```sql
GRANT ALL ON SCHEMA public TO ledgerlm;
```
**EXPECTED:** `GRANT`

```sql
\q
```
**EXPECTED:** Returns to bash prompt.

---

## 8.4 Install pgvector Extension (FROM SOURCE)

**Commands (run one by one):**

```bash
# Install build dependencies
sudo apt-get install -y postgresql-server-dev-14 build-essential git
```

**EXPECTED OUTCOME:**
```
Reading package lists... Done
...
Setting up postgresql-server-dev-14...
```

```bash
# Clone pgvector
cd /tmp
git clone --branch v0.8.1 https://github.com/pgvector/pgvector.git
```

**EXPECTED OUTCOME:**
```
Cloning into 'pgvector'...
remote: Enumerating objects: 2451, done.
remote: Counting objects: 100% (456/456), done.
...
```

```bash
# Build and install
cd pgvector
make
```

**EXPECTED OUTCOME:**
```
gcc -Wall -Wmissing-prototypes -Wpointer-arith...
gcc -Wall -Wmissing-prototypes -Wpointer-arith...
```

```bash
sudo make install
```

**EXPECTED OUTCOME:**
```
/bin/mkdir -p '/usr/lib/postgresql/14/lib'
/bin/mkdir -p '/usr/share/postgresql/14/extension'
/usr/bin/install -c -m 755 vector.so '/usr/lib/postgresql/14/lib/vector.so'
/usr/bin/install -c -m 644 vector.control '/usr/share/postgresql/14/extension/'
/usr/bin/install -c -m 644 sql/vector--*.sql '/usr/share/postgresql/14/extension/'
```

**SUCCESS:** Files copied to PostgreSQL extension directory.

```bash
# Clean up
cd ~
rm -rf /tmp/pgvector
```

**EXPECTED OUTCOME:**
```
(no output = success)
```

---

## 8.5 Enable pgvector Extension

**Command:**
```bash
sudo -u postgres psql -d ledgerlm
```

**EXPECTED OUTCOME:**
```
psql (14.10 (Ubuntu 14.10-0ubuntu0.22.04.1))
Type "help" for help.

ledgerlm=#
```

**Now run:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
**EXPECTED:** `CREATE EXTENSION`

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**EXPECTED OUTCOME:**
```
  oid  | extname | extowner | extnamespace | extrelocatable | extversion | ...
-------+---------+----------+--------------+----------------+------------+----
 16389 | vector  |       10 |         2200 | t              | 0.8.1      | ...
(1 row)
```

**SUCCESS:** Row shows `vector` with version `0.8.1`.

```sql
\q
```

---

## 8.6 Configure PostgreSQL for Docker Access

**Commands:**

```bash
# Find config file location
sudo -u postgres psql -c "SHOW hba_file;"
```

**EXPECTED OUTCOME:**
```
              hba_file              
------------------------------------
 /etc/postgresql/14/main/pg_hba.conf
(1 row)
```

```bash
# Add Docker network access
echo "host    all    all    172.17.0.0/16    md5" | sudo tee -a /etc/postgresql/14/main/pg_hba.conf
```

**EXPECTED OUTCOME:**
```
host    all    all    172.17.0.0/16    md5
```

```bash
# Allow listening on all interfaces
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/14/main/postgresql.conf
```

**EXPECTED OUTCOME:**
```
(no output = success)
```

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql
```

**EXPECTED OUTCOME:**
```
(no output = success)
```

---

## 8.7 Verify PostgreSQL Access

**Command:**
```bash
psql -h 127.0.0.1 -U ledgerlm -d ledgerlm -c "SELECT version();"
```

**When prompted:**
```
Password for user ledgerlm: SSrrsKS@05
```

**EXPECTED OUTCOME:**
```
                                                     version                                                      
------------------------------------------------------------------------------------------------------------------
 PostgreSQL 14.10 (Ubuntu 14.10-0ubuntu0.22.04.1) on x86_64-pc-linux-gnu, compiled by gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0, 64-bit
(1 row)
```

**SUCCESS:** PostgreSQL version displayed.
**FAILURE:** "connection refused" = Check pg_hba.conf and restart PostgreSQL.

---

# SECTION 9: Deploy LedgerLM Application

## 9.1 Create Application Directory

**Commands:**
```bash
sudo mkdir -p /opt/ledgerlm
sudo chown $USER:$USER /opt/ledgerlm
cd /opt/ledgerlm
```

**EXPECTED OUTCOME:**
```
(no output = success)
```

**Verify:**
```bash
pwd
```
**EXPECTED:** `/opt/ledgerlm`

---

## 9.2 Create docker-compose.yml

**IMPORTANT: Use cat command, NOT nano (Ctrl+W closes Bastion!):**

```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  app:
    image: boschledgerlm.azurecr.io/ledgerlm-app:latest
    container_name: ledgerlm-app
    restart: always
    ports:
      - "80:80"
    environment:
      DATABASE_URL: postgresql://ledgerlm:SSrrsKS@05@172.17.0.1:5432/ledgerlm
      NODE_ENV: production
      PORT: 5000
      PYTHON_BACKEND_URL: http://127.0.0.1:8000
      SESSION_SECRET: your-random-32-character-session-secret
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      SMTP_HOST: smtpout.secureserver.net
      SMTP_PORT: 465
      SMTP_USER: customer@ledgerlm.ai
      SMTP_PASSWORD: ${SMTP_PASSWORD}
      SMTP_FROM: customer@ledgerlm.ai
      NEMKO_ADMIN_OTP: 123456
    volumes:
      - app_uploads:/app/uploads
    extra_hosts:
      - "host.docker.internal:host-gateway"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 90s

volumes:
  app_uploads:
    driver: local
EOF
```

**EXPECTED OUTCOME:**
```
(no output = success)
```

**Verify file was created:**
```bash
cat docker-compose.yml | head -20
```

**EXPECTED OUTCOME:**
```
version: '3.8'

services:
  app:
    image: boschledgerlm.azurecr.io/ledgerlm-app:latest
    container_name: ledgerlm-app
    restart: always
    ports:
      - "80:80"
...
```

---

## 9.3 Create .env File

**Command:**
```bash
cat > .env << 'EOF'
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
SMTP_PASSWORD=your-actual-smtp-password-here
EOF
```

**EXPECTED OUTCOME:**
```
(no output = success)
```

**Verify:**
```bash
cat .env
```

**EXPECTED OUTCOME:**
```
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
SMTP_PASSWORD=your-actual-smtp-password-here
```

---

## 9.4 Login to Bosch ACR (from VM)

**Command:**
```bash
docker login boschledgerlm.azurecr.io
```

**When prompted:**
```
Username: boschledgerlm
Password: [paste password from Azure Portal]
```

**EXPECTED OUTCOME:**
```
WARNING! Your password will be stored unencrypted in /home/azureuser/.docker/config.json.
Configure a credential helper to remove this warning.

Login Succeeded
```

**SUCCESS:** "Login Succeeded" displayed.

---

## 9.5 Check for Port Conflicts

**Command:**
```bash
sudo lsof -i :80
```

**EXPECTED OUTCOME (No conflict):**
```
(no output = port 80 is free)
```

**EXPECTED OUTCOME (Conflict - nginx running):**
```
COMMAND   PID     USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
nginx     1234    root   6u   IPv4 123456      0t0  TCP *:http (LISTEN)
nginx     1235    www-data 6u IPv4 123456      0t0  TCP *:http (LISTEN)
```

**If nginx is running, stop it:**
```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

**EXPECTED OUTCOME:**
```
Synchronizing state of nginx.service...
Removed /etc/systemd/system/multi-user.target.wants/nginx.service.
```

**Alternative (force kill):**
```bash
sudo killall nginx
```

---

## 9.6 Pull and Start Application

**Commands:**
```bash
cd /opt/ledgerlm

# Pull latest image
docker pull boschledgerlm.azurecr.io/ledgerlm-app:latest
```

**EXPECTED OUTCOME:**
```
latest: Pulling from ledgerlm-app
a1b2c3d4e5f6: Pull complete
b2c3d4e5f6a7: Pull complete
c3d4e5f6a7b8: Pull complete
d4e5f6a7b8c9: Pull complete
e5f6a7b8c9d0: Pull complete
Digest: sha256:abc123def456...
Status: Downloaded newer image for boschledgerlm.azurecr.io/ledgerlm-app:latest
boschledgerlm.azurecr.io/ledgerlm-app:latest
```

**SUCCESS:** "Downloaded newer image" or "Image is up to date".

```bash
# Start the application
docker compose up -d
```

**EXPECTED OUTCOME:**
```
[+] Running 2/2
 ✔ Network ledgerlm_default      Created                                   0.1s
 ✔ Container ledgerlm-app        Started                                   0.5s
```

**SUCCESS:** Container "Started" shown.

---

## 9.7 Check Container Status

**Command:**
```bash
docker ps
```

**EXPECTED OUTCOME:**
```
CONTAINER ID   IMAGE                                             COMMAND                  CREATED          STATUS                    PORTS                               NAMES
a1b2c3d4e5f6   boschledgerlm.azurecr.io/ledgerlm-app:latest     "/usr/bin/supervisor…"   30 seconds ago   Up 29 seconds (healthy)   0.0.0.0:80->80/tcp, :::80->80/tcp   ledgerlm-app
```

**SUCCESS:** Status shows "Up X seconds (healthy)" and port 80 mapped.
**FAILURE:** Status shows "Restarting" or "Exited" = Check logs (next step).

---

## 9.8 View Logs

**Command:**
```bash
docker logs ledgerlm-app
```

**EXPECTED OUTCOME (Healthy Application):**
```
2025-12-01 10:30:00,000 INFO supervisord started with pid 1
2025-12-01 10:30:01,000 INFO spawned: 'nginx' with pid 10
2025-12-01 10:30:01,000 INFO spawned: 'node-backend' with pid 11
2025-12-01 10:30:01,000 INFO spawned: 'python-backend' with pid 12
2025-12-01 10:30:02,000 INFO success: nginx entered RUNNING state
2025-12-01 10:30:02,000 INFO success: node-backend entered RUNNING state
2025-12-01 10:30:02,000 INFO success: python-backend entered RUNNING state
INFO:     Started server process [12]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
10:30:05 AM [express] serving on port 5000
```

**SUCCESS:** All three services (nginx, node-backend, python-backend) show "RUNNING state".
**FAILURE:** "FATAL" or error messages = See Troubleshooting section.

---

# SECTION 10: Verify & Test

## 10.1 Test Health Endpoint from VM

**Command:**
```bash
curl -s http://localhost/api/health
```

**EXPECTED OUTCOME:**
```json
{"status":"ok","timestamp":"2025-12-01T10:30:00.000Z"}
```

**SUCCESS:** JSON response with "status":"ok".
**FAILURE:** "Connection refused" or empty = Container not running properly.

---

## 10.2 Test Python Backend from VM

**Command:**
```bash
curl -s http://localhost/api/python/
```

**EXPECTED OUTCOME:**
```json
{"service":"LedgerLM Python Backend","status":"running","version":"1.0.0"}
```

**SUCCESS:** Python backend responding.

---

## 10.3 Test from Browser

**Open in any browser:**
```
http://20.193.250.55
```

**EXPECTED OUTCOME:**
```
+------------------------------------------------------------------+
|                                                                   |
|                         LedgerLM                                  |
|                                                                   |
|              AI-Powered Financial Analysis                        |
|                                                                   |
|    +--------------------------------------------+                 |
|    |  Email                                     |                 |
|    |  [                                      ]  |                 |
|    |                                            |                 |
|    |  [ Send OTP ]                              |                 |
|    +--------------------------------------------+                 |
|                                                                   |
+------------------------------------------------------------------+
```

**SUCCESS:** LedgerLM login page displayed.
**FAILURE:** "This site can't be reached" = Check VM firewall, nginx, or container status.

---

## 10.4 Test Login with Admin OTP

**Since `NEMKO_ADMIN_OTP=123456` is set, you can bypass email verification:**

**Steps:**
1. Go to: `http://20.193.250.55`
2. Enter email: `admin@ledgerlm.ai` (or any email)
3. Click: "Send OTP"
4. Enter OTP: `123456`
5. Click: "Verify"

**EXPECTED OUTCOME:**
```
+------------------------------------------------------------------+
|                                                                   |
|  LedgerLM Dashboard                                Welcome, Admin |
|                                                                   |
|  +----------------+  +------------------------------------+       |
|  | Vault          |  |                                    |       |
|  | Boards         |  |   Your AI Financial Assistant      |       |
|  | Enterprise     |  |                                    |       |
|  | Settings       |  |   Ask me anything about your       |       |
|  +----------------+  |   financial documents...           |       |
|                      +------------------------------------+       |
|                                                                   |
+------------------------------------------------------------------+
```

**SUCCESS:** Dashboard loads with sidebar navigation.
**FAILURE:** "Invalid OTP" = Check NEMKO_ADMIN_OTP environment variable.

---

# SECTION 11: Troubleshooting Guide

## 11.1 Container Won't Start

**Symptoms:** `docker ps` shows container "Restarting" or "Exited".

**Diagnosis:**
```bash
docker logs ledgerlm-app 2>&1 | tail -50
```

**Look for error messages and match to solutions below.**

---

## 11.2 "Cannot find package 'vite'" Error

**Log shows:**
```
Error: Cannot find package 'vite' imported from /app/server/vite.ts
```

**Cause:** Old Docker image missing vite dependency.

**Solution:** 
1. On Matasma laptop, rebuild with latest Dockerfile:
   ```cmd
   docker build -t boschledgerlm.azurecr.io/ledgerlm-app:latest .
   docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```
2. On Bosch VM:
   ```bash
   docker pull boschledgerlm.azurecr.io/ledgerlm-app:latest
   docker compose down && docker compose up -d
   ```

---

## 11.3 "Could not import module 'api.main'" Error

**Log shows:**
```
Error loading ASGI app. Could not import module "api.main"
```

**Cause:** Old Docker image with wrong Python module path.

**Solution:** Same as 11.2 - rebuild and redeploy with latest Dockerfile.

---

## 11.4 Port 80 Already in Use

**Symptoms:** Container exits, logs show "Address already in use".

**Diagnosis:**
```bash
sudo lsof -i :80
```

**If nginx shown:**
```bash
sudo killall nginx
sudo systemctl stop nginx
sudo systemctl disable nginx
```

**Then restart container:**
```bash
docker compose down
docker compose up -d
```

**EXPECTED OUTCOME:** Container starts successfully.

---

## 11.5 Cannot Connect to PostgreSQL

**Log shows:**
```
Error: connect ECONNREFUSED 172.17.0.1:5432
```

**Diagnosis steps:**

1. Check PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```
   **EXPECTED:** "Active: active"

2. Check pg_hba.conf has Docker network:
   ```bash
   sudo grep "172.17" /etc/postgresql/14/main/pg_hba.conf
   ```
   **EXPECTED:** `host    all    all    172.17.0.0/16    md5`

3. Check listen address:
   ```bash
   sudo grep "listen_addresses" /etc/postgresql/14/main/postgresql.conf
   ```
   **EXPECTED:** `listen_addresses = '*'`

4. If missing, add and restart:
   ```bash
   echo "host    all    all    172.17.0.0/16    md5" | sudo tee -a /etc/postgresql/14/main/pg_hba.conf
   sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/14/main/postgresql.conf
   sudo systemctl restart postgresql
   ```

---

## 11.6 Docker Permission Denied

**Error:**
```
permission denied while trying to connect to the Docker daemon socket
```

**Solution:**
```bash
sudo usermod -aG docker $USER
newgrp docker
```

**Verify:**
```bash
docker ps
```
**EXPECTED:** No permission error.

---

## 11.7 Azure Bastion Closes When Editing

**Problem:** Pressing Ctrl+W in nano closes browser tab.

**Solution:** Never use nano! Use these methods instead:

**Create file:**
```bash
cat > filename << 'EOF'
file content here
line 2
line 3
EOF
```

**Append to file:**
```bash
echo "new line" >> filename
```

**Replace text:**
```bash
sed -i 's/old-text/new-text/g' filename
```

**View file:**
```bash
cat filename
```

---

## 11.8 Image Not Found on VM

**Error:**
```
Error response from daemon: pull access denied for boschledgerlm.azurecr.io/ledgerlm-app
```

**Causes:**
1. Not logged into ACR
2. Image not pushed yet
3. Wrong image name

**Solution:**
```bash
# Login again
docker login boschledgerlm.azurecr.io

# Then pull
docker pull boschledgerlm.azurecr.io/ledgerlm-app:latest
```

---

# SECTION 12: Quick Reference Commands

## Matasma Laptop Commands

### Full Build & Push
```cmd
cd C:\path\to\ledgerlm
docker build -t boschledgerlm.azurecr.io/ledgerlm-app:latest -t boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1 .
docker login boschledgerlm.azurecr.io
docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1
```

### Quick Update (After Code Changes)
```cmd
docker build -t boschledgerlm.azurecr.io/ledgerlm-app:latest .
docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
```

---

## Bosch VM Commands

### Full Deploy
```bash
cd /opt/ledgerlm
docker login boschledgerlm.azurecr.io
docker pull boschledgerlm.azurecr.io/ledgerlm-app:latest
docker compose down
docker compose up -d
docker ps
docker logs ledgerlm-app
```

### Quick Redeploy
```bash
cd /opt/ledgerlm
docker pull boschledgerlm.azurecr.io/ledgerlm-app:latest
docker compose down && docker compose up -d
docker logs -f ledgerlm-app
```

### Check Status
```bash
docker ps
docker logs ledgerlm-app | tail -30
curl http://localhost/api/health
```

### Restart Container
```bash
docker compose restart
```

### Stop Everything
```bash
docker compose down
```

---

## Key Credentials Reference

| Item | Value |
|------|-------|
| ACR Login Server | boschledgerlm.azurecr.io |
| ACR Username | boschledgerlm |
| ACR Password | [From Azure Portal > Access keys] |
| VM Public IP | 20.193.250.55 |
| PostgreSQL Host (for Docker) | 172.17.0.1 |
| PostgreSQL Port | 5432 |
| PostgreSQL Database | ledgerlm |
| PostgreSQL User | ledgerlm |
| PostgreSQL Password | SSrrsKS@05 |
| Test Admin OTP | 123456 |

---

## Fixed Issues Summary (v1.0.1)

| Issue | Wrong Value | Correct Value |
|-------|-------------|---------------|
| Python module path | `api.main:app` | `main:app` |
| Vite in production | Not installed | Added `RUN npm install vite` |
| Port 80 conflict | nginx running | Stop nginx before deploy |

---

## Application URLs

| URL | Purpose | Expected Response |
|-----|---------|-------------------|
| http://20.193.250.55 | Main application | Login page |
| http://20.193.250.55/api/health | Health check | `{"status":"ok"}` |
| http://20.193.250.55/api/python/ | Python backend | `{"status":"running"}` |

---

## Deployment Checklist

### First-Time Setup
- [ ] Docker Desktop installed on Matasma laptop
- [ ] ACR credentials obtained from Azure Portal
- [ ] Docker image built successfully
- [ ] Docker image pushed to ACR
- [ ] Bosch VM accessed via Azure Bastion
- [ ] Docker installed on VM
- [ ] PostgreSQL 14 installed
- [ ] pgvector 0.8.1 installed from source
- [ ] Database and user created
- [ ] pg_hba.conf configured for Docker
- [ ] docker-compose.yml created
- [ ] .env file created with actual keys
- [ ] Container running and healthy
- [ ] Login page accessible in browser
- [ ] Admin OTP login working

### Subsequent Deployments
- [ ] Code changes committed
- [ ] Docker image rebuilt on Matasma
- [ ] Image pushed to ACR
- [ ] Image pulled on Bosch VM
- [ ] Container restarted
- [ ] Logs verified healthy
- [ ] Application tested in browser

---

# End of Guide

**Congratulations! LedgerLM is now deployed on Bosch Azure!**

**Document Version:** 1.1
**Last Updated:** December 2025
**Total Sections:** 12
**Includes:** All bug fixes and lessons learned from deployment

For support or issues, contact the development team.
