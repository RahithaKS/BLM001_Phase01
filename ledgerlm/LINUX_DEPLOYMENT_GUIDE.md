# LedgerLM - Linux Ubuntu Server Deployment Guide

Complete step-by-step guide for deploying LedgerLM on Ubuntu Linux server with Nginx, PostgreSQL, and pgvector.

---

## 📋 Prerequisites

- **Ubuntu Server 22.04 LTS or 24.04 LTS**
- **Minimum 4GB RAM** (8GB+ recommended for GPU usage)
- **Root or sudo access**
- **Domain name** (optional, for SSL/HTTPS)
- **High-end GPU** (NVIDIA recommended for faster embeddings - optional)

---

## 🚀 Part 1: Server Setup & Prerequisites

### Step 1: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2: Install Node.js 20 LTS

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### Step 3: Install Python 3.11+

```bash
# Install Python and development tools
sudo apt install -y python3 python3-pip python3-venv python3-dev build-essential

# Verify installation
python3 --version  # Should show 3.11+ or 3.12+
```

### Step 4: Install PostgreSQL 16 with pgvector

```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update

# Install PostgreSQL 16 and pgvector extension
sudo apt install -y postgresql-16 postgresql-16-pgvector

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
sudo -u postgres psql --version  # Should show 16.x
```

### Step 5: Install Nginx

```bash
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify
sudo nginx -v  # Should show nginx/1.x
```

### Step 6: Install Additional Tools

```bash
# Install Git, Certbot (SSL), UFW (firewall), and Tesseract (OCR)
sudo apt install -y git certbot python3-certbot-nginx ufw tesseract-ocr

# Verify Tesseract
tesseract --version  # Should show 5.x
```

---

## 🗄️ Part 2: PostgreSQL Database Setup

### Step 1: Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# Run these commands inside PostgreSQL:
CREATE DATABASE ledgerlm;
CREATE USER ledgerlm_app WITH PASSWORD 'YourStrongPasswordHere123!';
GRANT ALL PRIVILEGES ON DATABASE ledgerlm TO ledgerlm_app;

# Connect to the database
\c ledgerlm

# Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

# Grant schema permissions
GRANT ALL ON SCHEMA public TO ledgerlm_app;

# Exit PostgreSQL
\q
```

### Step 2: Configure PostgreSQL Authentication

```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

**Add this line** (before other local entries):

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   ledgerlm        ledgerlm_app                            md5
```

**Save and exit** (Ctrl+X, then Y, then Enter)

```bash
# Reload PostgreSQL
sudo systemctl reload postgresql
```

### Step 3: Test Database Connection

```bash
# Test the connection
psql -U ledgerlm_app -d ledgerlm -h localhost

# If prompted for password, enter: YourStrongPasswordHere123!
# You should see: ledgerlm=>

# Exit
\q
```

---

## 📁 Part 3: Application Deployment

### Step 1: Create Application User

```bash
# Create dedicated user for the application
sudo useradd -r -m -s /bin/bash ledgerlm

# Create application directory
sudo mkdir -p /opt/ledgerlm
sudo chown ledgerlm:ledgerlm /opt/ledgerlm
```

### Step 2: Upload Application Files

**Option A: Using Git (Recommended)**

```bash
# Switch to ledgerlm user
sudo su - ledgerlm

# Clone your repository
cd /opt/ledgerlm
git clone https://github.com/yourusername/ledgerlm.git .

# Exit back to your user
exit
```

**Option B: Using SCP (if you have files on another machine)**

```bash
# From your local machine (Windows/Mac):
scp -r /path/to/your/project/* user@your-server-ip:/opt/ledgerlm/

# Then on server, fix permissions:
sudo chown -R ledgerlm:ledgerlm /opt/ledgerlm
```

### Step 3: Create Upload Directories

```bash
# Create directories for document uploads
sudo mkdir -p /var/lib/ledgerlm/uploads
sudo mkdir -p /var/lib/ledgerlm/enterprise-uploads

# Set ownership and permissions
sudo chown -R ledgerlm:ledgerlm /var/lib/ledgerlm
sudo chmod -R 750 /var/lib/ledgerlm
```

### Step 4: Create Environment Files

**Root .env file:**

```bash
sudo nano /opt/ledgerlm/.env
```

**Paste this content** (replace with your actual values):

```env
# Database Configuration
DATABASE_URL=postgresql://ledgerlm_app:YourStrongPasswordHere123!@localhost:5432/ledgerlm
PGHOST=localhost
PGPORT=5432
PGUSER=ledgerlm_app
PGPASSWORD=YourStrongPasswordHere123!
PGDATABASE=ledgerlm

# Server Configuration
PORT=5000
NODE_ENV=production

# OpenAI API Key
OPENAI_API_KEY=sk-proj-your-actual-openai-key-here

# Session Secret (generate a random string)
SESSION_SECRET=generate-a-random-32-character-string-here

# Upload Directories
UPLOAD_DIR=/var/lib/ledgerlm/uploads
ENTERPRISE_UPLOAD_DIR=/var/lib/ledgerlm/enterprise-uploads
```

**Save and exit** (Ctrl+X, Y, Enter)

**Python backend .env file:**

```bash
sudo nano /opt/ledgerlm/python_backend/.env
```

**Paste this content:**

```env
# Database Configuration
DATABASE_URL=postgresql://ledgerlm_app:YourStrongPasswordHere123!@localhost:5432/ledgerlm

# OpenAI API Key
OPENAI_API_KEY=sk-proj-your-actual-openai-key-here

# Server Configuration
PORT=8001
```

**Save and exit** (Ctrl+X, Y, Enter)

### Step 5: Secure Environment Files

```bash
# Set strict permissions (only owner can read)
sudo chmod 600 /opt/ledgerlm/.env
sudo chmod 600 /opt/ledgerlm/python_backend/.env
sudo chown ledgerlm:ledgerlm /opt/ledgerlm/.env
sudo chown ledgerlm:ledgerlm /opt/ledgerlm/python_backend/.env
```

---

## 🔧 Part 4: Install Dependencies & Build

### Step 1: Install Node.js Dependencies

```bash
# Switch to ledgerlm user
sudo su - ledgerlm
cd /opt/ledgerlm

# Install dependencies
npm ci

# Build the application
npm run build

# Exit back to your user
exit
```

### Step 2: Setup Python Virtual Environment

```bash
# Switch to ledgerlm user
sudo su - ledgerlm
cd /opt/ledgerlm/python_backend

# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Deactivate and exit
deactivate
exit
```

### Step 3: Run Database Migrations

```bash
# Switch to ledgerlm user
sudo su - ledgerlm
cd /opt/ledgerlm

# Push database schema (creates all tables)
npm run db:push

# You should see: ✓ Changes applied

# Exit back to your user
exit
```

---

## ⚙️ Part 5: Systemd Services Configuration

### Step 1: Create Node.js Service

```bash

```sudo nano /etc/systemd/system/ledgerlm-node.service

**Paste this complete configuration:**

```ini
[Unit]
Description=LedgerLM Node.js Backend
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=ledgerlm
Group=ledgerlm
WorkingDirectory=/opt/ledgerlm
EnvironmentFile=/opt/ledgerlm/.env

# Start command - runs the built application
ExecStart=/usr/bin/node /opt/ledgerlm/server/index.ts
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ledgerlm-node

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/ledgerlm
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

**Save and exit** (Ctrl+X, Y, Enter)

### Step 2: Create Python FastAPI Service

```bash
sudo nano /etc/systemd/system/ledgerlm-python.service
```

**Paste this complete configuration:**

```ini
[Unit]
Description=LedgerLM Python FastAPI Backend (RAG/AI)
After=network.target postgresql.service ledgerlm-node.service
Wants=postgresql.service

[Service]
Type=simple
User=ledgerlm
Group=ledgerlm
WorkingDirectory=/opt/ledgerlm/python_backend
EnvironmentFile=/opt/ledgerlm/python_backend/.env

# Start command - runs uvicorn with virtual environment
ExecStart=/opt/ledgerlm/python_backend/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ledgerlm-python

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/ledgerlm
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

**Save and exit** (Ctrl+X, Y, Enter)

### Step 3: Enable and Start Services

```bash
# Reload systemd to recognize new services
sudo systemctl daemon-reload

# Enable services (start on boot)
sudo systemctl enable ledgerlm-node
sudo systemctl enable ledgerlm-python

# Start services
sudo systemctl start ledgerlm-node
sudo systemctl start ledgerlm-python

# Check status
sudo systemctl status ledgerlm-node
sudo systemctl status ledgerlm-python
```

**You should see:** `Active: active (running)`

### Step 4: View Service Logs (if needed)

```bash
# View Node.js logs
sudo journalctl -u ledgerlm-node -f

# View Python logs
sudo journalctl -u ledgerlm-python -f

# Press Ctrl+C to exit log view
```

---

## 🌐 Part 6: Nginx Configuration

### Step 1: Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/ledgerlm
```

**Paste this complete configuration:**

```nginx
# Upstream backend servers
upstream node_backend {
    server 127.0.0.1:5000;
    keepalive 32;
}

upstream python_backend {
    server 127.0.0.1:8001;
    keepalive 32;
}

# HTTP Server (will redirect to HTTPS after SSL setup)
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    # Allow Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other traffic to HTTPS (uncomment after SSL setup)
    # return 301 https://$host$request_uri;

    # Temporary: Allow HTTP access (remove after SSL setup)
    location / {
        proxy_pass http://node_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 512M;
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Python backend API routes
    location /api/v2/ {
        proxy_pass http://python_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 512M;
        proxy_buffering off;
        proxy_read_timeout 600s;
        proxy_connect_timeout 75s;
    }
}

# HTTPS Server (uncomment after SSL setup)
# server {
#     listen 443 ssl http2;
#     listen [::]:443 ssl http2;
#     server_name your-domain.com www.your-domain.com;
#
#     # SSL certificates (managed by Certbot)
#     ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
#     include /etc/letsencrypt/options-ssl-nginx.conf;
#     ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
#
#     # Security headers
#     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
#     add_header X-Frame-Options "SAMEORIGIN" always;
#     add_header X-Content-Type-Options "nosniff" always;
#     add_header X-XSS-Protection "1; mode=block" always;
#
#     # Node.js backend (serves React frontend + API)
#     location / {
#         proxy_pass http://node_backend;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_cache_bypass $http_upgrade;
#         client_max_body_size 512M;
#         proxy_buffering off;
#         proxy_read_timeout 300s;
#         proxy_connect_timeout 75s;
#     }
#
#     # Python backend API routes
#     location /api/v2/ {
#         proxy_pass http://python_backend;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection 'upgrade';
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_cache_bypass $http_upgrade;
#         client_max_body_size 512M;
#         proxy_buffering off;
#         proxy_read_timeout 600s;
#         proxy_connect_timeout 75s;
#     }
# }
```

**Important:** Replace `your-domain.com` with your actual domain name!

**Save and exit** (Ctrl+X, Y, Enter)

### Step 2: Enable Nginx Site

```bash
# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/ledgerlm /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# You should see: syntax is ok, test is successful

# Reload Nginx
sudo systemctl reload nginx
```

---

## 🔒 Part 7: SSL/TLS Setup (Optional but Recommended)

**Note:** You need a domain name pointing to your server's IP address.

### Step 1: Setup Let's Encrypt SSL

```bash
# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts:
# - Enter your email address
# - Agree to terms of service
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

### Step 2: Update Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/ledgerlm
```

**Uncomment the HTTPS server block** (remove the `#` at the beginning of each line in the HTTPS section)

**Comment out or remove** the temporary HTTP location block

**Save and reload:**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 3: Test Auto-Renewal

```bash
# Test certificate renewal
sudo certbot renew --dry-run

# Should complete without errors
```

---

## 🔥 Part 8: Firewall Configuration

```bash
# Enable UFW firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'

# Alternative: Allow specific ports
# sudo ufw allow 22/tcp   # SSH
# sudo ufw allow 80/tcp   # HTTP
# sudo ufw allow 443/tcp  # HTTPS

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

**Expected output:**

```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
Nginx Full                 ALLOW       Anywhere
```

---

## ✅ Part 9: Testing & Verification

### Step 1: Check Services

```bash
# Check if all services are running
sudo systemctl status ledgerlm-node
sudo systemctl status ledgerlm-python
sudo systemctl status nginx
sudo systemctl status postgresql
```

All should show: `Active: active (running)`

### Step 2: Test Backend Endpoints

```bash
# Test Node.js backend (from server)
curl http://localhost:5000

# Test Python backend (from server)
curl http://localhost:8001/api/v2/health

# Test through Nginx (from server)
curl http://localhost
```

### Step 3: Access from Browser

**HTTP (before SSL):**
```
http://your-server-ip
```

**HTTPS (after SSL setup):**
```
https://your-domain.com
```

You should see the **LedgerLM login screen**! 🎉

---

## 🔧 Part 10: Maintenance & Troubleshooting

### View Logs

```bash
# Node.js backend logs
sudo journalctl -u ledgerlm-node -f

# Python backend logs
sudo journalctl -u ledgerlm-python -f

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

### Restart Services

```bash
# Restart Node.js backend
sudo systemctl restart ledgerlm-node

# Restart Python backend
sudo systemctl restart ledgerlm-python

# Restart Nginx
sudo systemctl restart nginx

# Restart PostgreSQL
sudo systemctl restart postgresql

# Restart all LedgerLM services
sudo systemctl restart ledgerlm-node ledgerlm-python nginx
```

### Update Application

```bash
# Switch to ledgerlm user
sudo su - ledgerlm
cd /opt/ledgerlm

# Pull latest changes
git pull

# Install new dependencies
npm ci
cd python_backend
source .venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..

# Run database migrations (if schema changed)
npm run db:push

# Build application
npm run build

# Exit back to your user
exit

# Restart services
sudo systemctl restart ledgerlm-node ledgerlm-python
```

### Common Issues

**Issue: Service won't start**

```bash
# Check detailed error logs
sudo journalctl -u ledgerlm-node -n 50 --no-pager
sudo journalctl -u ledgerlm-python -n 50 --no-pager
```

**Issue: Database connection failed**

```bash
# Test database connection
psql -U ledgerlm_app -d ledgerlm -h localhost

# Check PostgreSQL is running
sudo systemctl status postgresql
```

**Issue: 502 Bad Gateway (Nginx)**

```bash
# Check if backends are running
sudo systemctl status ledgerlm-node
sudo systemctl status ledgerlm-python

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log
```

**Issue: File upload fails**

```bash
# Check upload directory permissions
ls -la /var/lib/ledgerlm/

# Should show: drwxr-x--- ledgerlm ledgerlm

# Fix permissions if needed
sudo chown -R ledgerlm:ledgerlm /var/lib/ledgerlm
sudo chmod -R 750 /var/lib/ledgerlm
```

---

## 🚀 Part 11: Performance Optimization (Optional)

### Enable GPU for Embeddings (if you have NVIDIA GPU)

```bash
# Install NVIDIA drivers
sudo apt install -y nvidia-driver-535

# Install CUDA toolkit (optional, for GPU-accelerated processing)
sudo apt install -y nvidia-cuda-toolkit

# Reboot server
sudo reboot

# After reboot, verify GPU
nvidia-smi

# You should see your GPU listed
```

**Note:** The current application uses OpenAI API for embeddings, so GPU isn't required. But if you switch to local models in the future, GPU will help.

### Increase File Upload Limits

Already configured in Nginx (`client_max_body_size 512M`), but you can adjust:

```bash
sudo nano /etc/nginx/sites-available/ledgerlm

# Change this line to your desired limit:
# client_max_body_size 1G;  # for 1GB uploads

sudo systemctl reload nginx
```

### Database Performance Tuning

```bash
sudo nano /etc/postgresql/16/main/postgresql.conf

# Recommended settings for 8GB RAM server:
# shared_buffers = 2GB
# effective_cache_size = 6GB
# maintenance_work_mem = 512MB
# work_mem = 64MB

sudo systemctl restart postgresql
```

---

## 📊 Part 12: Monitoring Setup (Optional)

### Setup Log Rotation

```bash
sudo nano /etc/logrotate.d/ledgerlm
```

**Paste:**

```
/var/log/nginx/access.log /var/log/nginx/error.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

### Monitor Disk Space

```bash
# Check disk usage
df -h

# Check upload directory size
du -sh /var/lib/ledgerlm/uploads
du -sh /var/lib/ledgerlm/enterprise-uploads
```

---

## 🎯 Summary Checklist

- ✅ PostgreSQL 16 installed with pgvector extension
- ✅ Database `ledgerlm` created with user `ledgerlm_app`
- ✅ Node.js 20 and Python 3.11+ installed
- ✅ Application deployed to `/opt/ledgerlm`
- ✅ Environment files configured with secrets
- ✅ Upload directories created with correct permissions
- ✅ Dependencies installed and application built
- ✅ Database migrations applied
- ✅ Systemd services created and running
- ✅ Nginx configured as reverse proxy
- ✅ SSL/TLS enabled (if using domain)
- ✅ Firewall configured
- ✅ Application accessible from browser

---

## 🆘 Getting Help

**Check service status:**
```bash
sudo systemctl status ledgerlm-node ledgerlm-python nginx postgresql
```

**View all logs at once:**
```bash
sudo journalctl -u ledgerlm-node -u ledgerlm-python -u nginx -f
```

**Test database connection:**
```bash
psql -U ledgerlm_app -d ledgerlm -h localhost -c "SELECT version();"
```

---

## 🔐 Security Best Practices

1. **Never commit .env files** to Git
2. **Use strong passwords** for database users
3. **Keep system updated**: `sudo apt update && sudo apt upgrade`
4. **Monitor logs regularly** for suspicious activity
5. **Backup database regularly**: 
   ```bash
   sudo -u postgres pg_dump ledgerlm > backup_$(date +%Y%m%d).sql
   ```
6. **Backup upload directories**:
   ```bash
   tar -czf uploads_backup_$(date +%Y%m%d).tar.gz /var/lib/ledgerlm/
   ```

---

## 🎉 Congratulations!

Your LedgerLM application is now running in production on Ubuntu Linux with:
- ✅ Nginx reverse proxy
- ✅ PostgreSQL database with pgvector
- ✅ SSL/TLS encryption (if configured)
- ✅ Auto-restart on failure
- ✅ Secure file uploads
- ✅ Production-ready configuration

**Access your application at:** `https://your-domain.com`

**Next steps:**
- Create your first admin user
- Upload enterprise documents
- Test document analysis
- Monitor system performance
