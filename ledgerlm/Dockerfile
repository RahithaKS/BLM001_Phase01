# ================================
# LedgerLM Production Dockerfile
# ================================
# This creates a single container that runs:
# - Node.js backend (Express)
# - Python backend (FastAPI)
# - Nginx reverse proxy
# Source code is compiled/minimized - not exposed

# ================================
# Stage 1: Build Node.js Frontend + Backend
# ================================
FROM node:20-bullseye AS node-builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install ALL dependencies (including dev for build)
RUN npm ci

# Copy source code for building
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY attached_assets ./attached_assets
COPY tsconfig.json ./

# CRITICAL: Copy Tailwind and PostCSS configs (required for CSS processing!)
COPY tailwind.config.ts ./
COPY postcss.config.js ./

# Copy production vite config (without Replit-specific plugins)
COPY vite.config.production.ts ./vite.config.ts

# Build frontend (compiles TypeScript to JavaScript, bundles for production)
# Verify the build succeeded by checking for index.html
RUN npm run build && \
    echo "=== Verifying frontend build ===" && \
    ls -la server/public/ && \
    test -f server/public/index.html || (echo "ERROR: Frontend build failed - index.html not found!" && exit 1) && \
    echo "=== Frontend build successful ==="

# ================================
# Stage 2: Production Image
# ================================
FROM node:20-bullseye-slim

# Install Python 3.11 and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    tesseract-ocr \
    poppler-utils \
    nginx \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Install tsx for running TypeScript server in production
RUN npm install -g tsx

# Install vite (needed for server/vite.ts imports even in production mode)
# Install drizzle-kit for database migrations
# Install nanoid (used in server/vite.ts)
RUN npm install vite drizzle-kit nanoid

# Copy server code (will be transpiled at runtime by tsx)
# This includes server/public with compiled frontend from builder
COPY --from=node-builder /app/server ./server
COPY shared ./shared
COPY tsconfig.json ./

# Copy attached_assets (for any runtime asset references)
COPY attached_assets ./attached_assets

# Copy vite config (needed for server/vite.ts import)
COPY --from=node-builder /app/vite.config.ts ./

# Copy drizzle config for database migrations
COPY drizzle.config.ts ./

# Verify frontend files exist in production image
RUN echo "=== Verifying production frontend files ===" && \
    ls -la server/public/ && \
    test -f server/public/index.html || (echo "ERROR: index.html missing in production image!" && exit 1) && \
    echo "=== Production frontend files verified ==="

# ================================
# Setup Python Backend
# ================================
WORKDIR /app/python_backend

# Copy Python requirements first for caching
COPY python_backend/requirements.txt ./

# Create virtual environment and install dependencies
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy Python backend code
COPY python_backend ./

# ================================
# Configure Nginx
# ================================
WORKDIR /app

# Remove default Nginx config
RUN rm -f /etc/nginx/sites-enabled/default

# Create Nginx configuration
RUN echo 'server { \n\
    listen 80; \n\
    server_name _; \n\
    \n\
    # Security headers \n\
    add_header X-Frame-Options "SAMEORIGIN" always; \n\
    add_header X-Content-Type-Options "nosniff" always; \n\
    add_header X-XSS-Protection "1; mode=block" always; \n\
    \n\
    # Client body size limit (for file uploads - 500MB) \n\
    client_max_body_size 500M; \n\
    \n\
    # Timeouts for large file uploads \n\
    proxy_connect_timeout 600; \n\
    proxy_send_timeout 600; \n\
    proxy_read_timeout 600; \n\
    send_timeout 600; \n\
    \n\
    # Proxy to Node.js backend \n\
    location / { \n\
        proxy_pass http://127.0.0.1:5000; \n\
        proxy_http_version 1.1; \n\
        proxy_set_header Upgrade $http_upgrade; \n\
        proxy_set_header Connection "upgrade"; \n\
        proxy_set_header Host $host; \n\
        proxy_cache_bypass $http_upgrade; \n\
        proxy_set_header X-Real-IP $remote_addr; \n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \n\
        proxy_set_header X-Forwarded-Proto $scheme; \n\
    } \n\
    \n\
    # Proxy to Python RAG backend \n\
    location /api/python/ { \n\
        proxy_pass http://127.0.0.1:8000/; \n\
        proxy_set_header Host $host; \n\
        proxy_set_header X-Real-IP $remote_addr; \n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \n\
        proxy_connect_timeout 300; \n\
        proxy_send_timeout 300; \n\
        proxy_read_timeout 300; \n\
    } \n\
}' > /etc/nginx/sites-available/ledgerlm

# Enable site
RUN ln -sf /etc/nginx/sites-available/ledgerlm /etc/nginx/sites-enabled/

# Test Nginx config
RUN nginx -t

# ================================
# Configure Supervisor (Process Manager)
# ================================
RUN echo '[supervisord] \n\
nodaemon=true \n\
user=root \n\
logfile=/var/log/supervisor/supervisord.log \n\
pidfile=/var/run/supervisord.pid \n\
\n\
[program:nginx] \n\
command=/usr/sbin/nginx -g "daemon off;" \n\
autostart=true \n\
autorestart=true \n\
stdout_logfile=/dev/stdout \n\
stdout_logfile_maxbytes=0 \n\
stderr_logfile=/dev/stderr \n\
stderr_logfile_maxbytes=0 \n\
\n\
[program:node-backend] \n\
command=/usr/local/bin/tsx server/index.ts \n\
directory=/app \n\
environment=NODE_ENV="production" \n\
autostart=true \n\
autorestart=true \n\
startsecs=10 \n\
stdout_logfile=/dev/stdout \n\
stdout_logfile_maxbytes=0 \n\
stderr_logfile=/dev/stderr \n\
stderr_logfile_maxbytes=0 \n\
\n\
[program:python-backend] \n\
command=/opt/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 \n\
directory=/app/python_backend \n\
autostart=true \n\
autorestart=true \n\
startsecs=5 \n\
stdout_logfile=/dev/stdout \n\
stdout_logfile_maxbytes=0 \n\
stderr_logfile=/dev/stderr \n\
stderr_logfile_maxbytes=0' > /etc/supervisor/conf.d/ledgerlm.conf

# Create directories
RUN mkdir -p /app/uploads /var/log/supervisor && \
    chmod 777 /app/uploads

# Expose port
EXPOSE 80

# Health check - verify both backends are running
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# Start supervisor (manages all processes)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
