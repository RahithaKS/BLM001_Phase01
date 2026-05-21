# LedgerLM GPU Deployment Quick Guide
## Matasma Laptop → Azure Container Registry → Bosch VM

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│  Matasma Laptop │ ───→ │  Azure Container     │ ───→ │   Bosch VM      │
│  (Build Image)  │ push │  Registry (ACR)      │ pull │  (Run Container)│
└─────────────────┘      └──────────────────────┘      └─────────────────┘
```

## FILES NEEDED

| File | Used On | Purpose |
|------|---------|---------|
| `Dockerfile.gpu` | Matasma (build) | Creates GPU-enabled Docker image |
| `docker-compose.gpu.yml` | Bosch VM (run) | Runs container with GPU access |
| `.env` | Bosch VM (run) | Contains database URL, API keys |

## CONTAINER COUNT: **1 Container**

Inside the single container, **supervisor** manages 3 services:
- **Nginx** (port 80) - Web server / reverse proxy
- **Node.js** (port 5000) - Main backend API
- **Python** (port 8000) - OCR/PDF processing

---

## STEP 1: BUILD ON MATASMA LAPTOP

```batch
cd C:\Users\SamrithaS\OneDrive - Matasma Digital Technologies LLP\Desktop\Bosch_Revamp_UI_Versions\006BochLedgerLM16121113

docker build -f Dockerfile.gpu -t boschledgerlm.azurecr.io/ledgerlm-app:v1.0.25-gpu .
```

## STEP 2: PUSH TO ACR

```batch
docker login boschledgerlm.azurecr.io
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.25-gpu
```

## STEP 3: ON BOSCH VM

### First time setup:
```bash
mkdir -p ~/ledgerlm
cd ~/ledgerlm

# Create .env file
nano .env
```

### .env file contents:
```env
# Database
POSTGRES_USER=ledgerlm_app
POSTGRES_PASSWORD=YourPassword
POSTGRES_HOST=172.17.0.1
POSTGRES_PORT=5432
POSTGRES_DB=ledgerlm

# OpenAI
OPENAI_API_KEY=sk-proj-xxx

# Session
SESSION_SECRET=random32characterstring

# Email (optional)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=email@company.com
SMTP_PASSWORD=password
SMTP_FROM=ledgerlm@bosch.com
```

### Copy docker-compose.gpu.yml to VM:
Transfer `docker-compose.gpu.yml` to `~/ledgerlm/docker-compose.yml`

### Login to ACR and run:
```bash
cd ~/ledgerlm
docker login boschledgerlm.azurecr.io
docker compose pull
docker compose up -d
```

---

## VERIFY DEPLOYMENT

```bash
# Check container is running
docker ps

# Check logs
docker logs -f ledgerlm-app

# Check GPU access
docker exec ledgerlm-app nvidia-smi

# Test health endpoint
curl http://localhost/api/health
```

---

## UPDATE TO NEW VERSION

On Matasma (build new version):
```batch
docker build -f Dockerfile.gpu -t boschledgerlm.azurecr.io/ledgerlm-app:v1.0.26-gpu .
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.26-gpu
```

On Bosch VM (update & restart):
```bash
cd ~/ledgerlm
# Edit docker-compose.yml to change version tag
nano docker-compose.yml
# Pull and restart
docker compose pull
docker compose up -d
```

---

## WHAT HAPPENS ON STARTUP

1. Container starts
2. **drizzle-kit push** runs (updates database schema automatically)
3. Supervisor starts Nginx, Node.js, Python services
4. App available on port 80

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| Build fails with "unknown instruction" | Windows line ending issue - re-download Dockerfile.gpu from Replit |
| Container won't start | Check logs: `docker logs ledgerlm-app` |
| Database connection fails | Verify DATABASE_URL in .env, check PostgreSQL is running |
| GPU not detected | Run `nvidia-smi` on VM, restart Docker with `sudo systemctl restart docker` |
