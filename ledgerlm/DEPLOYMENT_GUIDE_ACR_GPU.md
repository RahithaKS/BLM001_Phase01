# LedgerLM GPU Deployment via Azure Container Registry (ACR)
## Matasma Windows to Bosch Azure VM

**Your Setup:**
- ACR: `boschledgerlm.azurecr.io/ledgerlm-app`
- Current version: v1.0.24 (without GPU)
- Next version: v1.0.25 (with GPU)

---

## PART A: On Matasma Windows Laptop

### Step 1: Open Command Prompt in Project Folder

1. **Open** File Explorer
2. **Navigate to:** Your LedgerLM project folder
3. **Click** in the address bar
4. **Type:** `cmd` and press Enter

### Step 2: Login to Bosch ACR

**Type:**
```
az acr login --name boschledgerlm
```

**Expected Output:**
```
Login Succeeded
```

If you get an error, run:
```
az login
```
Then try the ACR login again.

### Step 3: Build GPU Docker Image

**Type:**
```
docker build -f Dockerfile.gpu -t boschledgerlm.azurecr.io/ledgerlm-app:v1.0.25-gpu .
```

**Wait 15-25 minutes.** Lots of text will scroll.

**Expected Output at end:**
```
Successfully built abc123def456
Successfully tagged boschledgerlm.azurecr.io/ledgerlm-app:v1.0.25-gpu
```

### Step 4: Tag as Latest

**Type:**
```
docker tag boschledgerlm.azurecr.io/ledgerlm-app:v1.0.25-gpu boschledgerlm.azurecr.io/ledgerlm-app:latest-gpu
```

### Step 5: Push to Bosch ACR

**Type (push both tags):**
```
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.25-gpu
docker push boschledgerlm.azurecr.io/ledgerlm-app:latest-gpu
```

**Wait 5-15 minutes** for upload.

**Expected Output:**
```
v1.0.25-gpu: digest: sha256:abc123... size: 1234
latest-gpu: digest: sha256:abc123... size: 1234
```

### Step 6: Verify in Azure Portal

1. **Open browser**
2. **Go to:** Azure Portal → boschledgerlm → Repositories → ledgerlm-app
3. **You should see:**
   - `v1.0.25-gpu`
   - `latest-gpu`

---

## PART B: On Bosch Azure VM

### Step 7: Connect to VM (SSH)

**From Windows Command Prompt:**
```
ssh ledgerllm@YOUR_VM_IP
```

Or use **PuTTY** to connect.

### Step 8: Install NVIDIA Container Toolkit (First Time Only)

**Run these commands one by one:**

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
```

```bash
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
```

```bash
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

### Step 9: Login to ACR from VM

```bash
az acr login --name boschledgerlm
```

### Step 10: Navigate to Application Folder

```bash
cd ~/ledgerlm
```

If folder doesn't exist:
```bash
mkdir -p ~/ledgerlm
cd ~/ledgerlm
```

### Step 11: Create docker-compose.yml

```bash
nano docker-compose.yml
```

**Paste this content:**

```yaml
version: '3.8'

services:
  app:
    image: boschledgerlm.azurecr.io/ledgerlm-app:latest-gpu
    container_name: ledgerlm-app
    restart: always
    ports:
      - "80:80"
      - "443:443"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST:-172.17.0.1}:${POSTGRES_PORT:-5432}/${POSTGRES_DB}
      NODE_ENV: production
      PORT: 5000
      PYTHON_BACKEND_URL: http://127.0.0.1:8000
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT:-465}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASSWORD: ${SMTP_PASSWORD}
      SMTP_FROM: ${SMTP_FROM:-noreply@ledgerlm.com}
      SESSION_SECRET: ${SESSION_SECRET}
      NVIDIA_VISIBLE_DEVICES: all
      CUDA_VISIBLE_DEVICES: "0"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
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
```

**Save:** Press `Ctrl+X`, then `Y`, then `Enter`

### Step 12: Create .env File

```bash
nano .env
```

**Paste your values:**

```env
POSTGRES_USER=ledgerlm_app
POSTGRES_PASSWORD=YourPassword123!
POSTGRES_HOST=172.17.0.1
POSTGRES_PORT=5432
POSTGRES_DB=ledgerlm
OPENAI_API_KEY=sk-proj-your-key
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASSWORD=your-password
SMTP_FROM=ledgerlm@bosch.com
SESSION_SECRET=your-32-character-secret
```

**Save:** Press `Ctrl+X`, then `Y`, then `Enter`

### Step 13: Pull New GPU Image from ACR

```bash
docker compose pull
```

**Expected Output:**
```
[+] Pulling 1/1
 ✔ app Pulled   
```

### Step 14: Stop Old Container (if running)

```bash
docker compose down
```

### Step 15: Start Application with GPU

```bash
docker compose up -d
```

**Expected Output:**
```
[+] Running 1/1
 ✔ Container ledgerlm-app  Started
```

### Step 16: Verify GPU is Working

```bash
docker exec ledgerlm-app nvidia-smi
```

**Expected Output:**
```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 535.274.02    Driver Version: 535.274.02    CUDA Version: 12.2  |
|   0  Tesla T4 ...
```

### Step 17: Check Application Status

```bash
docker ps
```

**Expected Output:**
```
CONTAINER ID   IMAGE                                              STATUS
abc123         boschledgerlm.azurecr.io/ledgerlm-app:latest-gpu   Up (healthy)
```

### Step 18: Test in Browser

Open: `http://YOUR_VM_IP`

You should see the LedgerLM login page.

---

## Quick Reference Commands

### On Matasma Windows (Build & Push):

```batch
REM Login to ACR
az acr login --name boschledgerlm

REM Build with new version
docker build -f Dockerfile.gpu -t boschledgerlm.azurecr.io/ledgerlm-app:v1.0.25-gpu .

REM Tag as latest
docker tag boschledgerlm.azurecr.io/ledgerlm-app:v1.0.25-gpu boschledgerlm.azurecr.io/ledgerlm-app:latest-gpu

REM Push to ACR
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.25-gpu
docker push boschledgerlm.azurecr.io/ledgerlm-app:latest-gpu
```

### On Bosch VM (Pull & Run):

```bash
# Login to ACR
az acr login --name boschledgerlm

# Pull latest GPU image
cd ~/ledgerlm
docker compose pull

# Restart application
docker compose down
docker compose up -d

# Verify GPU
docker exec ledgerlm-app nvidia-smi

# View logs
docker logs -f ledgerlm-app
```

---

## Version History

| Version | Date | GPU Support | Notes |
|---------|------|-------------|-------|
| v1.0.24 | 12/15/2025 | No | Current production |
| v1.0.25-gpu | Next | Yes | With CUDA 12.2 |

---

**End of Guide**
