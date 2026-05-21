# 🚀 LedgerLM Deployment: Matasma → Bosch Azure
## Complete Beginner's Guide (Source Code Protection)

**Your Situation:**
- ✅ You work at **Matasma** (have source code on your laptop)
- ✅ Client is **Bosch** (wants app deployed in their Azure)
- ✅ **Critical:** Bosch must NEVER get source code
- ✅ Bosch employees will access from their new laptops

**How This Works:**
1. **You (on Matasma laptop):** Build Docker images → Push to Bosch's Azure Container Registry
2. **Bosch Azure:** Pull pre-built images → Run containers (no source code!)
3. **Bosch employees:** Use the application via web browser

**Source code stays on your Matasma laptop forever! ✅**

---

## 📋 **What You Need Before Starting**

### From Bosch IT Department

**Email them this:**

```
Subject: Azure Resources for LedgerLM Deployment

Hi Bosch IT Team,

Matasma will deploy LedgerLM to your Azure environment. We need:

1. Azure Container Registry (ACR) access:
   - Registry name (e.g., boschledgerlm.azurecr.io)
   - Push permissions for Matasma (username + password or Service Principal)
   
2. Azure VM provisioned:
   - Ubuntu Server 22.04 LTS
   - Size: Standard_NC4as_T4_v3 (4 vCPU, 16GB RAM, NVIDIA T4 GPU)
   - OR: Standard_D4s_v3 (if no GPU available)
   - Public IP address
   - Ports open: 80, 443, 22
   
3. PostgreSQL Database:
   - Azure Database for PostgreSQL (Flexible Server)
   - OR: We'll install on VM (your choice)
   
4. Domain name: ledgerlm.bosch.com (or similar)

5. SSL Certificate for HTTPS

We will ONLY push pre-built Docker images to your ACR.
Source code will NOT be shared.

Regards,
[Your Name]
Matasma
```

**Wait for Bosch to provide:**
- ✅ ACR registry name (e.g., `boschledgerlm.azurecr.io`)
- ✅ ACR credentials (username + password)
- ✅ VM IP address (or you'll create it yourself)
- ✅ Domain name

### Your API Keys

Collect these (you'll need them):

1. **OpenAI API Key**
   - Go to: https://platform.openai.com/api-keys
   - Create new key
   - Copy it (starts with `sk-proj-...`)

2. **Anaplan Credentials**
   - Workspace ID
   - Model ID
   - Process ID
   - Username
   - Password

3. **Email (SMTP) Settings**
   - SMTP server (e.g., smtp.office365.com)
   - Port (587 or 465)
   - Email username
   - Email password

---

## 🔧 **PART A: On Your Matasma Laptop**

**This is what YOU do (source code stays here)**

### Step 1: Install Docker Desktop

**What is Docker?** It packages your app into a container (like a sealed box). Source code is compiled inside, not visible.

1. **Go to:** https://www.docker.com/products/docker-desktop/
2. **Download:** Docker Desktop for Windows
3. **Double-click** the installer
4. **Click:** "OK" → "Next" → "Install"
5. **Restart** your computer when asked
6. **Open** Docker Desktop
7. **Accept** the terms
8. **Skip** tutorial

✅ **Test:** Open Command Prompt, type: `docker --version`  
Should show: `Docker version 24.x.x`

### Step 2: Install Azure CLI

**What is Azure CLI?** It lets you login to Bosch's Azure from command line.

1. **Go to:** https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows
2. **Click:** "Download the MSI installer"
3. **Download** and **run** the installer
4. **Click:** "Next" → "I accept" → "Install"

✅ **Test:** Open Command Prompt, type: `az --version`  
Should show version info

### Step 3: Prepare Your Code

1. **Open** File Explorer
2. **Navigate to** your LedgerLM project folder
3. **Find** `.env.production.example`
4. **Copy** it and rename to `.env.production`
5. **Open** `.env.production` with Notepad
6. **Fill in** your values:

```env
# Database (Bosch will provide the actual URL)
POSTGRES_PASSWORD=TemporaryPassword123!

# Your API Keys
OPENAI_API_KEY=sk-proj-YOUR-KEY-HERE
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@matasma.com
SMTP_PASSWORD=your-email-password
SMTP_FROM=ledgerlm@bosch.com

# Anaplan
ANAPLAN_WORKSPACE_ID=your-workspace-id
ANAPLAN_MODEL_ID=your-model-id
ANAPLAN_PROCESS_ID=your-process-id
ANAPLAN_USERNAME=your-username
ANAPLAN_PASSWORD=your-password

# Session Security
SESSION_SECRET=CreateARandomString32CharactersLong
```

7. **Save** and close

### Step 4: Build Docker Image

**This compiles your source code into a sealed container.**

1. **Open** Command Prompt
2. **Navigate** to your project:
   ```
   cd C:\path\to\LedgerLM
   ```
   Replace with your actual path

3. **Build the image:**
   ```
   docker build -t ledgerlm-app:latest .
   ```
   Press Enter

**What happens:**
- Takes 10-15 minutes
- Lots of text will scroll
- Downloads dependencies
- Compiles TypeScript → JavaScript
- Packages everything
- **Source code is compiled, not visible in final image!**

**When done, you'll see:**
```
Successfully built abc123def456
Successfully tagged ledgerlm-app:latest
```

✅ **Success!** Your app is now a Docker image on your laptop.

### Step 5: Login to Bosch's Azure Container Registry

**Use credentials Bosch gave you.**

1. **In Command Prompt:**
   ```
   az acr login --name boschledgerlm
   ```
   Replace `boschledgerlm` with the actual registry name

2. **If prompted, enter:**
   - Username: (from Bosch)
   - Password: (from Bosch)

**You should see:** `Login Succeeded`

### Step 6: Tag Your Image for Bosch

**This prepares the image for upload.**

```
docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:latest
docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
```

Replace `boschledgerlm` with actual registry name.

### Step 7: Push Image to Bosch Azure

**This uploads the compiled image (NO source code!).**

```
docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
```

**What happens:**
- Upload progress shows (takes 5-15 minutes)
- Image is uploaded to Bosch's Azure
- **Only the compiled image goes to Bosch!**
- **Source code stays on your Matasma laptop!**

**When done:**
```
latest: digest: sha256:abc123... size: 1234
```

✅ **Done!** Pre-built image is now in Bosch's Azure Container Registry.

---

## ☁️ **PART B: In Bosch's Azure Environment**

**This part happens in Bosch's Azure (either you do it via Azure Portal, or Bosch IT does it)**

### Option 1: Bosch IT Does It (Easier for You)

**Send Bosch IT this email:**

```
Subject: Deploy LedgerLM from ACR

Hi Bosch IT,

The LedgerLM Docker images are now in your Container Registry:
- Registry: boschledgerlm.azurecr.io
- Image: ledgerlm-app:latest

Please deploy using the attached docker-compose.yml file.

Steps needed:
1. Create Ubuntu 22.04 VM (Standard_NC4as_T4_v3 with GPU)
2. Install Docker on VM
3. Pull image from ACR
4. Create PostgreSQL database
5. Run: docker-compose up -d

I can assist via screen-share if needed.

Thanks!
```

**Attach:** `docker-compose.yml` file from your project

### Option 2: You Do It Via Azure Portal (More Control)

**Follow these steps if YOU will set up the VM:**

#### B1: Login to Bosch's Azure Portal

1. **Ask Bosch IT for:**
   - Azure Portal login (Bosch guest account for you)
   - OR: They add your Matasma email as guest user

2. **Go to:** https://portal.azure.com
3. **Login** with credentials they provide

#### B2: Create Virtual Machine

**Detailed steps:**

1. **In search bar**, type: `Virtual machines`
2. **Click:** Virtual machines
3. **Click:** "+ Create" → "Azure virtual machine"

**Fill in the form:**

**Basics tab:**
- **Subscription:** (Bosch's subscription)
- **Resource group:** Click "Create new" → Name: `ledgerlm-rg` → OK
- **VM name:** `ledgerlm-vm`
- **Region:** (Same as Bosch's location)
- **Image:** Ubuntu Server 22.04 LTS - x64 Gen2
- **Size:** Click "See all sizes"
  - **If GPU available:** Standard_NC4as_T4_v3 (NVIDIA T4 GPU)
  - **If no GPU:** Standard_D4s_v3 (4 vCPU, 16GB RAM)
  - Click "Select"

- **Authentication:** SSH public key
- **Username:** `azureuser`
- **SSH key:** Generate new key pair
- **Key name:** `ledgerlm-ssh-key`

- **Public inbound ports:** Allow selected ports
- **Select ports:** ✅ HTTP (80), HTTPS (443), SSH (22)

4. **Click:** "Next: Disks"

**Disks tab:**
- **OS disk type:** Standard SSD

5. **Click:** "Review + create"
6. **Click:** "Create"
7. **Download private key** when prompted (save it!)

**Wait 3-5 minutes for deployment.**

8. **Click:** "Go to resource"
9. **Copy the Public IP address** (e.g., 20.xx.xx.xx)

#### B3: Connect to VM

**Using PuTTY (Windows):**

1. **Download PuTTY:** https://www.putty.org/
2. **Install** it
3. **Convert SSH key:**
   - Open PuTTYgen
   - Load the .pem file
   - Save private key as .ppk file

4. **Open PuTTY**
5. **Host Name:** `azureuser@20.xx.xx.xx` (your VM IP)
6. **Connection → SSH → Auth → Credentials:** Browse to .ppk file
7. **Click:** Open
8. **Accept** security alert

✅ **You're connected to the VM!**

#### B4: Install Docker on VM

**In the PuTTY terminal, run these commands:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose -y

# Install NVIDIA drivers (if using GPU VM)
sudo apt install -y ubuntu-drivers-common
sudo ubuntu-drivers autoinstall

# Reboot
sudo reboot
```

**VM will restart. Wait 2 minutes, then reconnect with PuTTY.**

#### B5: Login to ACR from VM

**In PuTTY:**

```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to ACR
az acr login --name boschledgerlm
```

Enter credentials when asked.

#### B6: Create PostgreSQL Database

**Option A: Install on VM (Simpler)**

```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Install PostgreSQL + pgvector
sudo apt update
sudo apt install -y postgresql-16 postgresql-16-pgvector

# Create database
sudo -u postgres psql
```

**In PostgreSQL prompt (postgres=#):**

```sql
CREATE DATABASE ledgerlm;
CREATE USER ledgerlm_app WITH PASSWORD 'YourStrongPassword123!';
GRANT ALL PRIVILEGES ON DATABASE ledgerlm TO ledgerlm_app;
\c ledgerlm
CREATE EXTENSION vector;
GRANT ALL ON SCHEMA public TO ledgerlm_app;
\q
```

**Option B: Use Azure Database for PostgreSQL**

(Ask Bosch IT to provision, or create via Azure Portal)

#### B7: Create docker-compose.yml on VM

```bash
mkdir ~/ledgerlm
cd ~/ledgerlm
nano docker-compose.yml
```

**Paste this (update registry name):**

```yaml
version: '3.8'

services:
  app:
    image: boschledgerlm.azurecr.io/ledgerlm-app:latest
    container_name: ledgerlm-app
    restart: always
    ports:
      - "80:80"
      - "443:443"
    environment:
      DATABASE_URL: postgresql://ledgerlm_app:YourStrongPassword123!@localhost:5432/ledgerlm
      NODE_ENV: production
      PORT: 5000
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
    network_mode: host
    volumes:
      - app_uploads:/app/uploads

volumes:
  app_uploads:
```

**Save:** Ctrl+X, Y, Enter

#### B8: Create .env File

```bash
nano .env
```

**Paste your actual values:**

```env
OPENAI_API_KEY=sk-proj-your-key
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASSWORD=your-password
SMTP_FROM=ledgerlm@bosch.com
SESSION_SECRET=your-random-32-char-string
ANAPLAN_WORKSPACE_ID=your-id
ANAPLAN_MODEL_ID=your-id
ANAPLAN_PROCESS_ID=your-id
ANAPLAN_USERNAME=your-username
ANAPLAN_PASSWORD=your-password
```

**Save:** Ctrl+X, Y, Enter

#### B9: Pull Image and Start Application

```bash
# Pull image from ACR
docker-compose pull

# Start application
docker-compose up -d

# Check status
docker-compose ps
```

**You should see:**
```
ledgerlm-app   Up   0.0.0.0:80->80/tcp
```

#### B10: Test the Application

1. **Open web browser**
2. **Go to:** `http://YOUR-VM-IP`
3. **You should see:** LedgerLM login page!

✅ **SUCCESS!** Application is running!

---

## 🔒 **PART C: Set Up HTTPS (SSL)**

### Option 1: Let's Encrypt (Free SSL)

**Only works with domain name (ledgerlm.bosch.com):**

**On the VM:**

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot certonly --standalone -d ledgerlm.bosch.com

# Follow prompts
```

### Option 2: Bosch SSL Certificate

**Ask Bosch IT for certificate files, then:**

```bash
# Copy certificate to VM (using WinSCP or similar)
sudo mkdir -p /etc/ssl/bosch
sudo cp ~/bosch.crt /etc/ssl/bosch/
sudo cp ~/bosch.key /etc/ssl/bosch/
sudo chmod 600 /etc/ssl/bosch/bosch.key
```

**Update docker-compose.yml to mount certificates.**

---

## 🔄 **PART D: How to Update the Application**

**When you make code changes:**

### On Matasma Laptop:

1. **Make your code changes**
2. **Save files**
3. **Build new image:**
   ```
   docker build -t ledgerlm-app:latest .
   ```

4. **Tag with new version:**
   ```
   docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1
   docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

5. **Push to ACR:**
   ```
   docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1
   docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

### On Bosch Azure VM:

1. **Connect via PuTTY**
2. **Navigate to folder:**
   ```
   cd ~/ledgerlm
   ```

3. **Pull new image:**
   ```
   docker-compose pull
   ```

4. **Restart application:**
   ```
   docker-compose up -d
   ```

**Done!** New version is live in 2-3 minutes.

---

## 🛡️ **Security Verification**

### ✅ Confirm Source Code is Protected:

**On Bosch Azure VM, try to look inside the container:**

```bash
docker exec -it ledgerlm-app ls /app
```

**You'll see:**
- `dist/` folder (compiled JavaScript)
- `node_modules/` (dependencies)
- **NO** `client/src/` folder (source code)
- **NO** `.ts` TypeScript files

**Source code is compiled away!** ✅

**Bosch only has:**
- Pre-compiled JavaScript
- Docker image
- Configuration files
- **NO TypeScript source code**

---

## 📊 **Monitoring & Maintenance**

### Check Application Status

**On VM:**

```bash
# View logs
docker-compose logs -f app

# Check if running
docker-compose ps

# Restart if needed
docker-compose restart

# Stop application
docker-compose down

# Start application
docker-compose up -d
```

### Backup Database

```bash
# Create backup
docker exec -i ledgerlm-app pg_dump -U ledgerlm_app ledgerlm > backup-$(date +%Y%m%d).sql

# Restore backup
docker exec -i ledgerlm-app psql -U ledgerlm_app ledgerlm < backup-YYYYMMDD.sql
```

---

## 🆘 **Troubleshooting**

### Problem: Can't push to ACR

**Error:** `unauthorized: authentication required`

**Solution:**
```bash
az acr login --name boschledgerlm
```
Enter credentials again.

### Problem: Image won't pull on VM

**Error:** `Error response from daemon: pull access denied`

**Solution:**
```bash
# On VM, login to ACR
az acr login --name boschledgerlm
docker-compose pull
```

### Problem: Application won't start

**Check logs:**
```bash
docker-compose logs app
```

**Common issues:**
1. **Database connection failed:** Check DATABASE_URL in .env
2. **Missing environment variable:** Check .env file has all values
3. **Port already in use:** Stop other services using port 80

### Problem: GPU not detected

**Check GPU:**
```bash
nvidia-smi
```

**If not found:**
```bash
sudo ubuntu-drivers autoinstall
sudo reboot
```

---

## ✅ **Deployment Checklist**

### On Matasma Laptop:
- [ ] Docker Desktop installed
- [ ] Azure CLI installed
- [ ] Code is ready
- [ ] .env.production filled with API keys
- [ ] Docker image built successfully
- [ ] Logged into Bosch's ACR
- [ ] Image pushed to ACR (verify in Azure Portal)

### On Bosch Azure:
- [ ] VM created and accessible
- [ ] Docker installed on VM
- [ ] PostgreSQL database created
- [ ] docker-compose.yml created
- [ ] .env file with secrets created
- [ ] Image pulled from ACR
- [ ] Application started (docker-compose up -d)
- [ ] Can access http://VM-IP in browser
- [ ] SSL certificate configured (HTTPS)
- [ ] Domain name points to VM

### Final Verification:
- [ ] Bosch employees can access https://ledgerlm.bosch.com
- [ ] Can create account and login
- [ ] Can upload documents
- [ ] AI chat works
- [ ] Source code verified NOT on VM (checked with docker exec)

---

## 📞 **Who Does What**

### You (Matasma):
- ✅ Build Docker images on your laptop
- ✅ Push images to Bosch's ACR
- ✅ Provide docker-compose.yml
- ✅ Provide .env template with variables needed
- ✅ Support during deployment (screen-share)
- ✅ Build and push updates when needed

### Bosch IT:
- ✅ Provide ACR credentials
- ✅ Create VM (or give you guest access to create it)
- ✅ Provide domain name
- ✅ Provide SSL certificate
- ✅ Configure firewall rules
- ✅ Ongoing infrastructure maintenance
- ✅ Pull and run updated images when you notify them

### Bosch Employees:
- ✅ Access application via web browser
- ✅ Login with their Bosch email
- ✅ Use the application
- ✅ No technical work needed

---

## 🎉 **Summary**

**You've successfully deployed LedgerLM to Bosch Azure WITHOUT sharing source code!**

**What happened:**
1. ✅ **Matasma laptop:** Source code → Docker image (compiled)
2. ✅ **Bosch ACR:** Stores pre-built images only
3. ✅ **Bosch VM:** Runs containers from images
4. ✅ **Bosch employees:** Access via browser

**Source code location:**
- ✅ **Matasma laptop:** YES (you keep it)
- ❌ **Bosch ACR:** NO (only compiled images)
- ❌ **Bosch VM:** NO (only compiled images)
- ❌ **Bosch employees:** NO (only web interface)

**For updates:**
- Build new image on Matasma laptop
- Push to ACR
- Bosch pulls and restarts
- Takes 5 minutes

---

**Need help?** Contact Bosch IT or refer to troubleshooting section above.

**End of Guide** 🎊

*Version: 1.0 - Matasma to Bosch Deployment*  
*Last Updated: November 2025*
