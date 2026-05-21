# 🚀 LedgerLM Deployment Guide for Bosch Azure Environment

**Complete step-by-step guide for deploying LedgerLM to Bosch's Azure VM without exposing source code**

---

## 📋 Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Prerequisites](#prerequisites)
3. [Part 1: Local Setup - Build Docker Images](#part-1-local-setup---build-docker-images)
4. [Part 2: Azure Setup - Container Registry](#part-2-azure-setup---container-registry)
5. [Part 3: Azure VM Setup](#part-3-azure-vm-setup)
6. [Part 4: Deploy Application](#part-4-deploy-application)
7. [Part 5: Keycloak SSO Integration](#part-5-keycloak-sso-integration)
8. [Part 6: SSL/HTTPS Setup](#part-6-sslhttps-setup)
9. [Part 7: Monitoring & Maintenance](#part-7-monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview & Architecture

### What Gets Deployed

```
┌──────────────────────────────────────────────────────────┐
│                    Azure (Bosch)                         │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Azure VM (Ubuntu 22.04)              │   │
│  │                                                 │   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │  Docker Container: ledgerlm-app          │  │   │
│  │  │  ┌────────┐  ┌────────┐  ┌────────┐    │  │   │
│  │  │  │ Nginx  │→ │Node.js │→ │ Python │    │  │   │
│  │  │  │  :80   │  │ :5000  │  │ :8000  │    │  │   │
│  │  │  └────────┘  └────────┘  └────────┘    │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  │                                                 │   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │  Docker Container: PostgreSQL + pgvector │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  │                                                 │   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │  Docker Container: Keycloak (SSO)        │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Azure Container Registry (ACR)                 │   │
│  │  - Private Docker images (NO source code)       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Azure Key Vault                                 │   │
│  │  - Secrets, API keys, passwords                  │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Key Security Features

✅ **Source code never leaves your local machine**  
✅ **Only pre-built Docker images deployed to Azure**  
✅ **Secrets stored in Azure Key Vault**  
✅ **Enterprise SSO via Keycloak + Azure AD**  
✅ **HTTPS encryption for all traffic**

---

## 📦 Prerequisites

### What You Need on Your Local Machine

1. **Docker Desktop**  
   - Download: https://www.docker.com/products/docker-desktop/
   - After install: `docker --version` should work

2. **Azure CLI**  
   - Download: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
   - After install: `az --version` should work

3. **Git** (to clone your code)
   - Download: https://git-scm.com/downloads

4. **Your LedgerLM source code** (this project)

### What You Need from Bosch IT

Request these from Bosch Azure administrators:

| Resource | Purpose | Example |
|----------|---------|---------|
| **Azure VM** | Runs the application | Ubuntu 22.04 LTS, Standard_D4s_v3 (4 vCPU, 16GB RAM) |
| **Azure Container Registry** | Stores private Docker images | `boschledgerlm.azurecr.io` |
| **Azure Key Vault** | Stores secrets securely | `ledgerlm-keyvault` |
| **Domain Name** | Public URL | `ledgerlm.bosch.com` |
| **SSL Certificate** | HTTPS encryption | Wildcard or specific cert |
| **Azure AD App Registration** | For Keycloak SSO | Client ID, Client Secret |
| **Network Access** | Firewall rules | Ports 80, 443, 8080 |

---

## 🏗️ Part 1: Local Setup - Build Docker Images

### Step 1: Prepare Your Code

```bash
# Navigate to your project directory
cd /path/to/ledgerlm

# Make sure you have the latest code
git pull

# Copy environment template
cp .env.production.example .env.production
```

### Step 2: Configure Environment Variables

Edit `.env.production` with your Bosch-specific values:

```bash
# Open in your editor
nano .env.production  # or use VS Code, Notepad++, etc.
```

**Important values to fill:**
- `POSTGRES_PASSWORD` - Create a strong database password
- `OPENAI_API_KEY` - Your OpenAI API key
- `SMTP_*` - Bosch email server settings
- `ANAPLAN_*` - Your Anaplan credentials
- `SESSION_SECRET` - Generate random string (32+ characters)

**Example:**
```env
POSTGRES_PASSWORD=Bosch@SecureDB2025!
OPENAI_API_KEY=sk-proj-abc123xyz...
SMTP_HOST=smtp.office365.com
SMTP_USER=ledgerlm@bosch.com
SMTP_PASSWORD=your-email-password
SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Step 3: Build Docker Image Locally

This creates the Docker image **on your machine** (source code is compiled, not exposed):

```bash
# Build the image
docker build -t ledgerlm-app:latest .

# This takes 5-10 minutes (installing dependencies, compiling code)
# You'll see output like:
# Step 1/25 : FROM node:20-bullseye AS node-base
# Step 2/25 : RUN apt-get update...
# ...
# Successfully built abc123def456
# Successfully tagged ledgerlm-app:latest
```

### Step 4: Test Locally (Optional but Recommended)

```bash
# Start all services locally
docker-compose up -d

# Check if running
docker ps

# Should see:
# - ledgerlm-app (port 80)
# - ledgerlm-db (port 5432)

# Test in browser
# Open: http://localhost

# Stop when done testing
docker-compose down
```

---

## 🔐 Part 2: Azure Setup - Container Registry

### Step 1: Login to Azure

```bash
# Login to your Bosch Azure account
az login

# You'll be redirected to browser to login
# Use your Bosch credentials

# Verify you're in the right subscription
az account show

# If wrong subscription, switch:
az account set --subscription "Bosch-Production"
```

### Step 2: Create Container Registry (or use existing)

**Option A: Use Existing ACR** (Ask Bosch IT for name)
```bash
# If Bosch already has an ACR
ACR_NAME="boschledgerlm"  # Replace with actual name
```

**Option B: Create New ACR** (If Bosch IT asks you to create it)
```bash
# Create resource group (if needed)
az group create --name ledgerlm-rg --location eastus

# Create container registry
az acr create \
  --resource-group ledgerlm-rg \
  --name boschledgerlm \
  --sku Basic

ACR_NAME="boschledgerlm"
```

### Step 3: Login to Container Registry

```bash
# Login to ACR
az acr login --name $ACR_NAME

# You should see: "Login Succeeded"
```

### Step 4: Tag and Push Your Image

```bash
# Tag your image for ACR
docker tag ledgerlm-app:latest ${ACR_NAME}.azurecr.io/ledgerlm-app:latest
docker tag ledgerlm-app:latest ${ACR_NAME}.azurecr.io/ledgerlm-app:v1.0.0

# Push to Azure (this uploads your pre-built image)
docker push ${ACR_NAME}.azurecr.io/ledgerlm-app:latest
docker push ${ACR_NAME}.azurecr.io/ledgerlm-app:v1.0.0

# Takes 5-10 minutes depending on your internet speed
# You'll see upload progress for each layer
```

### Step 5: Verify Image is in ACR

```bash
# List images in your registry
az acr repository list --name $ACR_NAME --output table

# You should see: ledgerlm-app

# List tags
az acr repository show-tags --name $ACR_NAME --repository ledgerlm-app --output table

# You should see: latest, v1.0.0
```

✅ **Your source code is now securely stored as a Docker image in Azure - no source code exposed!**

---

## 🖥️ Part 3: Azure VM Setup

### Step 1: Get VM Details from Bosch IT

Ask for:
- VM IP address or hostname
- SSH username (usually: `azureuser`)
- SSH private key or password

Example:
- IP: `20.xx.xx.xx`
- Username: `azureuser`
- SSH key: `~/.ssh/bosch-ledgerlm.pem`

### Step 2: Connect to VM via SSH

```bash
# If using SSH key
ssh -i ~/.ssh/bosch-ledgerlm.pem azureuser@20.xx.xx.xx

# If using password
ssh azureuser@20.xx.xx.xx
# (enter password when prompted)

# You should now see Ubuntu terminal:
# azureuser@ledgerlm-vm:~$
```

### Step 3: Install Docker on VM

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (avoid sudo)
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose -y

# Verify installation
docker --version  # Should show 24.x or higher
docker-compose --version  # Should show 2.x or higher

# Important: Logout and login again for group changes
exit
ssh -i ~/.ssh/bosch-ledgerlm.pem azureuser@20.xx.xx.xx
```

### Step 4: Configure VM to Access ACR

```bash
# On the VM, login to Azure
az login

# Login to your ACR
az acr login --name boschledgerlm

# Test: Pull the image
docker pull boschledgerlm.azurecr.io/ledgerlm-app:latest

# You should see: "Status: Downloaded newer image..."
```

---

## 🚀 Part 4: Deploy Application

### Step 1: Create Deployment Directory

```bash
# On the VM
mkdir -p ~/ledgerlm
cd ~/ledgerlm
```

### Step 2: Create docker-compose.yml on VM

```bash
# Create the file
nano docker-compose.yml
```

**Paste this content** (update ACR name):

```yaml
version: '3.8'

services:
  database:
    image: pgvector/pgvector:pg16
    container_name: ledgerlm-db
    restart: always
    environment:
      POSTGRES_USER: ledgerlm
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ledgerlm
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - ledgerlm-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ledgerlm"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    image: boschledgerlm.azurecr.io/ledgerlm-app:latest
    container_name: ledgerlm-app
    restart: always
    ports:
      - "80:80"
      - "443:443"
    environment:
      DATABASE_URL: postgresql://ledgerlm:${POSTGRES_PASSWORD}@database:5432/ledgerlm
      NODE_ENV: production
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASSWORD: ${SMTP_PASSWORD}
      SMTP_FROM: ${SMTP_FROM}
      SESSION_SECRET: ${SESSION_SECRET}
      ANAPLAN_WORKSPACE_ID: ${ANAPLAN_WORKSPACE_ID}
      ANAPLAN_MODEL_ID: ${ANAPLAN_MODEL_ID}
      ANAPLAN_PROCESS_ID: ${ANAPLAN_PROCESS_ID}
      ANAPLAN_USERNAME: ${ANAPLAN_USERNAME}
      ANAPLAN_PASSWORD: ${ANAPLAN_PASSWORD}
    volumes:
      - app_uploads:/app/uploads
    depends_on:
      database:
        condition: service_healthy
    networks:
      - ledgerlm-network

volumes:
  postgres_data:
  app_uploads:

networks:
  ledgerlm-network:
```

**Save and exit** (`Ctrl+X`, then `Y`, then `Enter`)

### Step 3: Create .env File with Secrets

```bash
# Create .env file
nano .env
```

**Paste your production values:**

```env
POSTGRES_PASSWORD=YourStrongDBPassword123!
OPENAI_API_KEY=sk-proj-your-key-here
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=ledgerlm@bosch.com
SMTP_PASSWORD=your-email-password
SMTP_FROM=ledgerlm@bosch.com
SESSION_SECRET=your-32-char-random-string
ANAPLAN_WORKSPACE_ID=8a868cdc7e5feca9017e8e4afdd57430
ANAPLAN_MODEL_ID=BE462879B50444F498A0DA70F40FABA2
ANAPLAN_PROCESS_ID=118000000093
ANAPLAN_USERNAME=your-anaplan-user
ANAPLAN_PASSWORD=your-anaplan-password
```

**Save and exit**

### Step 4: Start the Application

```bash
# Pull latest images
docker-compose pull

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# You should see:
# ledgerlm-app   Up   0.0.0.0:80->80/tcp
# ledgerlm-db    Up   5432/tcp

# View logs (real-time)
docker-compose logs -f app

# Press Ctrl+C to stop viewing logs
```

### Step 5: Verify Application is Running

```bash
# Test from VM
curl http://localhost

# You should see HTML output

# Check health endpoint
curl http://localhost/api/health

# Should return: {"status":"healthy"}
```

### Step 6: Open Firewall Ports (if needed)

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# If using Keycloak
sudo ufw allow 8080/tcp

# Enable firewall
sudo ufw enable
```

---

## 🔐 Part 5: Keycloak SSO Integration

### Step 1: Deploy Keycloak

```bash
# Add Keycloak to docker-compose.yml
cd ~/ledgerlm
nano docker-compose.yml
```

**Add this service:**

```yaml
  keycloak:
    image: quay.io/keycloak/keycloak:23.0
    container_name: ledgerlm-keycloak
    restart: always
    command: start
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://database:5432/keycloak
      KC_DB_USERNAME: ledgerlm
      KC_DB_PASSWORD: ${POSTGRES_PASSWORD}
      KC_HOSTNAME: keycloak.bosch.com
      KC_PROXY: edge
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
    ports:
      - "8080:8080"
    depends_on:
      database:
        condition: service_healthy
    networks:
      - ledgerlm-network
```

**Add to .env:**
```env
KEYCLOAK_ADMIN_PASSWORD=SecureAdminPassword123!
```

**Restart:**
```bash
docker-compose up -d
```

### Step 2: Configure Keycloak with Azure AD

1. **Access Keycloak Admin Console:**
   - URL: `http://your-vm-ip:8080`
   - Username: `admin`
   - Password: (from `KEYCLOAK_ADMIN_PASSWORD`)

2. **Create Realm:**
   - Click "Create Realm"
   - Name: `bosch`
   - Click "Create"

3. **Add Azure AD Identity Provider:**
   - Go to: Identity Providers → Add provider → OpenID Connect v1.0
   - **Alias:** `azure-ad`
   - **Display Name:** `Bosch Azure AD`
   - **Discovery URL:** Get from Bosch IT  
     Format: `https://login.microsoftonline.com/{tenant-id}/v2.0/.well-known/openid-configuration`
   - **Client ID:** From Azure AD App Registration
   - **Client Secret:** From Azure AD App Registration
   - **Trust Email:** ON
   - Click "Save"

4. **Copy Redirect URI:**
   - After saving, copy the "Redirect URI" shown
   - Give this to Bosch IT to add to Azure AD App Registration

5. **Create Client for LedgerLM:**
   - Go to: Clients → Create client
   - **Client ID:** `ledgerlm-app`
   - **Client Protocol:** openid-connect
   - Click "Next"
   - **Valid redirect URIs:** `https://ledgerlm.bosch.com/*`
   - **Web origins:** `https://ledgerlm.bosch.com`
   - Click "Save"

### Step 3: Update LedgerLM to Use Keycloak

(You'll need to modify your authentication code to integrate with Keycloak - this requires code changes)

---

## 🔒 Part 6: SSL/HTTPS Setup

### Option A: Using Let's Encrypt (Free SSL)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Stop your app temporarily
cd ~/ledgerlm
docker-compose down

# Get certificate
sudo certbot certonly --standalone -d ledgerlm.bosch.com

# Follow prompts, enter your email

# Certificate will be at:
# /etc/letsencrypt/live/ledgerlm.bosch.com/fullchain.pem
# /etc/letsencrypt/live/ledgerlm.bosch.com/privkey.pem
```

### Option B: Using Bosch SSL Certificate

Ask Bosch IT for:
- Certificate file (`.crt` or `.pem`)
- Private key file (`.key`)

```bash
# Copy certificates to VM
scp bosch-cert.crt azureuser@vm-ip:/home/azureuser/
scp bosch-key.key azureuser@vm-ip:/home/azureuser/

# On VM, move to proper location
sudo mkdir -p /etc/ssl/bosch
sudo mv ~/bosch-cert.crt /etc/ssl/bosch/
sudo mv ~/bosch-key.key /etc/ssl/bosch/
sudo chmod 600 /etc/ssl/bosch/bosch-key.key
```

### Configure Nginx for HTTPS

```bash
# Update docker-compose.yml to mount certificates
nano docker-compose.yml
```

**Add volume mounts to app service:**

```yaml
  app:
    # ... existing config ...
    volumes:
      - app_uploads:/app/uploads
      - /etc/letsencrypt:/etc/letsencrypt:ro  # Add this
      - ./nginx-ssl.conf:/etc/nginx/sites-available/ledgerlm:ro  # Add this
```

**Create nginx-ssl.conf:**

```bash
nano nginx-ssl.conf
```

**Paste:**

```nginx
server {
    listen 80;
    server_name ledgerlm.bosch.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ledgerlm.bosch.com;

    ssl_certificate /etc/letsencrypt/live/ledgerlm.bosch.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ledgerlm.bosch.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 200M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

**Restart:**

```bash
docker-compose down
docker-compose up -d
```

**Test HTTPS:**
```bash
curl https://ledgerlm.bosch.com
```

---

## 📊 Part 7: Monitoring & Maintenance

### View Logs

```bash
# All logs
docker-compose logs -f

# Specific service
docker-compose logs -f app

# Last 100 lines
docker-compose logs --tail=100 app
```

### Update Application

```bash
# On your local machine: Build new version
docker build -t ledgerlm-app:latest .
docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1

# On VM: Pull and update
cd ~/ledgerlm
docker-compose pull
docker-compose up -d

# Docker automatically restarts with new image
```

### Backup Database

```bash
# Create backup directory
mkdir -p ~/backups

# Backup database
docker exec ledgerlm-db pg_dump -U ledgerlm ledgerlm > ~/backups/ledgerlm-$(date +%Y%m%d).sql

# Compress
gzip ~/backups/ledgerlm-$(date +%Y%m%d).sql

# Automate with cron
crontab -e

# Add this line (daily backup at 2 AM):
0 2 * * * docker exec ledgerlm-db pg_dump -U ledgerlm ledgerlm | gzip > ~/backups/ledgerlm-$(date +\%Y\%m\%d).sql.gz
```

### Monitor Resources

```bash
# CPU, Memory usage
docker stats

# Disk usage
docker system df

# Clean up old images
docker system prune -a
```

---

## 🔧 Troubleshooting

### Application Won't Start

```bash
# Check logs
docker-compose logs app

# Common issues:
# 1. Database not ready → wait 30 seconds, restart
# 2. Missing env var → check .env file
# 3. Port conflict → check: sudo netstat -tulpn | grep :80
```

### Can't Connect to Database

```bash
# Test database connection
docker exec -it ledgerlm-db psql -U ledgerlm -d ledgerlm

# Should see: ledgerlm=#
# If not, check DATABASE_URL in .env
```

### SSL Certificate Issues

```bash
# Test certificate
openssl s_client -connect ledgerlm.bosch.com:443

# Renew Let's Encrypt (before expiry)
sudo certbot renew
```

### Pull New Image from ACR

```bash
# Re-authenticate
az acr login --name boschledgerlm

# Pull latest
docker pull boschledgerlm.azurecr.io/ledgerlm-app:latest
```

---

## ✅ Deployment Checklist

- [ ] Docker images built locally
- [ ] Images pushed to Azure Container Registry
- [ ] Azure VM accessible via SSH
- [ ] Docker installed on VM
- [ ] VM can pull from ACR
- [ ] docker-compose.yml created
- [ ] .env file configured with all secrets
- [ ] Application started (`docker-compose up -d`)
- [ ] Firewall ports opened (80, 443)
- [ ] SSL certificate configured
- [ ] HTTPS working (`https://ledgerlm.bosch.com`)
- [ ] Keycloak deployed and configured
- [ ] Azure AD integration working
- [ ] Database backups configured
- [ ] Monitoring in place

---

## ⏰ VM Shutdown Policy Handling (7-8 PM Daily)

Bosch Azure VMs have a policy to shut down after 7-8 PM. Here's how to handle this:

### What Happens When VM Shuts Down

| Component | Impact | Auto-Recovery on Restart |
|-----------|--------|--------------------------|
| Docker Containers | All containers stop | Yes, with `restart: always` |
| Database | Connections closed, data persisted | Yes, data safe in volumes |
| User Sessions | Active sessions preserved | Yes, stored in PostgreSQL |
| Scheduled Tasks | Missed if during shutdown | Yes, resumes with next schedule |
| In-progress Uploads | Lost | No, user must re-upload |
| In-progress AI Processing | Fails | No, user must reprocess |

### Automatic Recovery Features

1. **Docker `restart: always`** - Containers auto-start when VM boots
2. **PostgreSQL Sessions** - User logins persist across restarts (using `connect-pg-simple`)
3. **Scheduler Resumes** - Anaplan sync scheduler restarts automatically on boot

### Recommended Configuration

```yaml
# In docker-compose.yml - ensure restart policy
services:
  app:
    restart: always  # Critical for auto-recovery
  database:
    restart: always
```

### Best Practices for Shutdown Window

1. **Schedule Anaplan Sync Before Shutdown**
   - Current setting: 5:30 AM IST (well before shutdown)
   - Configure via Admin > Enterprise Data > Schedule Settings

2. **Inform Users**
   - Display a banner warning about shutdown window
   - Recommend completing large uploads before 6 PM

3. **Database Backup Before Shutdown**
   ```bash
   # Add to crontab - backup at 6:30 PM daily before shutdown
   30 18 * * * docker exec ledgerlm-db pg_dump -U ledgerlm ledgerlm | gzip > ~/backups/pre-shutdown-$(date +\%Y\%m\%d).sql.gz
   ```

### Potential Azure Bottlenecks to Check with Bosch IT

| Bottleneck | Question to Ask | Impact |
|------------|-----------------|--------|
| **Outbound Firewall** | Are HTTPS calls to api.openai.com, api.anaplan.com allowed? | AI features won't work |
| **Proxy Settings** | Is there a corporate proxy for outbound traffic? | May need proxy config in Docker |
| **DNS Resolution** | Can VM resolve external domains? | API calls will fail |
| **ACR Access** | Can VM pull from Azure Container Registry? | Deployment will fail |
| **SSL Inspection** | Does Azure inspect SSL traffic? | May break API certificates |
| **Rate Limiting** | Are there API call limits? | May throttle AI responses |
| **Azure PostgreSQL** | Is managed DB available? | Better than VM-hosted DB |

### Verify External Connectivity (Run on VM)

```bash
# Test OpenAI API connectivity
curl -s -o /dev/null -w "%{http_code}" https://api.openai.com/v1/models

# Test Anaplan API connectivity  
curl -s -o /dev/null -w "%{http_code}" https://api.anaplan.com/1/3/users/me

# Test SMTP connectivity
nc -zv smtpout.secureserver.net 465

# Test DNS resolution
nslookup api.openai.com
nslookup api.anaplan.com
```

### Startup Verification Script

Create `/home/azureuser/ledgerlm/verify-startup.sh`:

```bash
#!/bin/bash
# Run after VM boot to verify all services

echo "=== LedgerLM Startup Verification ==="

# Check containers
echo "1. Checking Docker containers..."
docker-compose ps

# Check database
echo "2. Testing database connection..."
docker exec ledgerlm-db pg_isready -U ledgerlm && echo "OK" || echo "FAILED"

# Check app health
echo "3. Testing application health..."
curl -s http://localhost/api/health | jq . || echo "App not responding"

# Check external APIs
echo "4. Testing external connectivity..."
curl -s -o /dev/null -w "OpenAI: %{http_code}\n" https://api.openai.com/v1/models

echo "=== Verification Complete ==="
```

Make executable: `chmod +x verify-startup.sh`

Run after each VM restart: `./verify-startup.sh`

---

## 📞 Support

**For Bosch-specific issues:**
- Contact Bosch Azure Support

**For LedgerLM application issues:**
- Check logs: `docker-compose logs -f`
- Email: support@ledgerlm.com

---

## 🎉 You're Done!

Your LedgerLM application is now running securely on Bosch Azure with:
✅ No source code exposed  
✅ Enterprise SSO via Keycloak  
✅ HTTPS encryption  
✅ Automated backups  
✅ Production-ready deployment  

**Access your application:**  
https://ledgerlm.bosch.com
