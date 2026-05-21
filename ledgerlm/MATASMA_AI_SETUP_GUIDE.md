# MATASMA Server - Open Source AI Setup Guide

## Complete Ultra-Granular Setup for NVIDIA RTX 5000 Ada (32GB)

---

# PREPARATION CHECKLIST

Before you begin, confirm you have:

- [ ] Physical access to Matasma server OR remote desktop access
- [ ] Admin/root password for the server
- [ ] Internet connection on the server
- [ ] At least 100GB free disk space
- [ ] About 3-4 hours of time

---

# PHASE 1: ACCESS YOUR MATASMA SERVER

## Step 1.1: Connect to the Server

### If you're sitting at the Matasma server:
1. Turn on the monitor
2. Turn on the server (power button)
3. Wait for login screen
4. Enter your username and password
5. You should see the desktop

### If you're connecting remotely from your laptop:

**Option A: Using Remote Desktop (Windows)**
1. On your laptop, press `Windows key + R`
2. Type: `mstsc`
3. Press Enter
4. In the Computer field, type: `MATASMA_IP_ADDRESS`
5. Click "Connect"
6. Enter username and password
7. Click "OK"

**Option B: Using SSH (Command Line)**
1. Open PowerShell on your laptop
2. Type: `ssh your_username@MATASMA_IP_ADDRESS`
3. Press Enter
4. Type your password (you won't see it as you type - this is normal)
5. Press Enter

**Expected Outcome:** You see the Matasma server desktop OR a command prompt.

---

## Step 1.2: Open Terminal

### If you see a desktop:
1. Look for "Terminal" application
2. Click on it to open

**OR**

1. Right-click anywhere on the desktop
2. Select "Open Terminal" or "Open in Terminal"

### If you're already in command line (SSH):
You're already in terminal - skip to next step.

**Expected Outcome:** A black/dark window with a blinking cursor.

---

## Step 1.3: Verify You're on the Right Server

**Type this command exactly (then press Enter):**
```
hostname
```

**Expected Outcome:** Should show "matasma" or your server name.

---

## Step 1.4: Check You Have Admin Access

**Type this command:**
```
sudo whoami
```

**It will ask for password. Type your password and press Enter.**

**Expected Outcome:** Shows the word `root`

**If you see "Permission denied":** You don't have admin access. Contact your IT admin.

---

# PHASE 2: CHECK YOUR GPU

## Step 2.1: Verify GPU is Detected

**Type this command:**
```
lspci | grep -i nvidia
```

**Expected Outcome:** Shows something like:
```
01:00.0 VGA compatible controller: NVIDIA Corporation AD102GL [RTX 5000 Ada Generation] ...
```

**If you see nothing:** Your GPU might not be properly installed. Contact hardware support.

---

## Step 2.2: Check NVIDIA Driver Status

**Type this command:**
```
nvidia-smi
```

**Expected Outcome A (Driver Already Installed):**
```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 535.154.05   Driver Version: 535.154.05   CUDA Version: 12.2     |
|-------------------------------+----------------------+----------------------+
| GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
| Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |
|===============================+======================+======================|
|   0  NVIDIA RTX 5000 ...  On | 00000000:01:00.0  On |                  Off |
| 30%   35C    P8    20W / 250W |    512MiB / 32768MiB |      0%      Default |
+-------------------------------+----------------------+----------------------+
```

**If you see this:** SKIP to PHASE 3 (driver already installed)

**Expected Outcome B (Driver NOT Installed):**
```
Command 'nvidia-smi' not found
```
OR
```
NVIDIA-SMI has failed because it couldn't communicate with the NVIDIA driver
```

**If you see this:** Continue to Step 2.3

---

## Step 2.3: Check Operating System Version

**Type this command:**
```
cat /etc/os-release
```

**Expected Outcome:** Shows something like:
```
NAME="Ubuntu"
VERSION="22.04.3 LTS (Jammy Jellyfish)"
```

**Write down your version - you'll need it for driver installation.**

---

## Step 2.4: Update System Packages

**Type this command:**
```
sudo apt update && sudo apt upgrade -y
```

**Expected Duration:** 2-10 minutes depending on internet speed.

**Expected Outcome:** Lots of text scrolling. Ends with no errors.

---

## Step 2.5: Install NVIDIA Driver

**Type this command:**
```
sudo apt install nvidia-driver-545 -y
```

**Expected Duration:** 5-15 minutes.

**Expected Outcome:** Installation completes without errors.

**If you see errors about "nvidia-driver-545 not found":**

Try this instead:
```
sudo ubuntu-drivers autoinstall
```

---

## Step 2.6: Reboot the Server

**IMPORTANT: This will disconnect you if remote. You'll need to reconnect.**

**Type this command:**
```
sudo reboot
```

**Wait 2-3 minutes for server to restart.**

**Then reconnect using Step 1.1 and 1.2.**

---

## Step 2.7: Verify Driver After Reboot

**Type this command:**
```
nvidia-smi
```

**Expected Outcome:** The table showing your RTX 5000 Ada with 32GB memory.

**If you see the table:** SUCCESS! Continue to PHASE 3.

**If you still see errors:** Contact IT support - driver installation may need manual intervention.

---

# PHASE 3: INSTALL CUDA TOOLKIT

CUDA allows programs to use your GPU for AI calculations.

## Step 3.1: Check if CUDA is Already Installed

**Type this command:**
```
nvcc --version
```

**Expected Outcome A (CUDA Installed):**
```
nvcc: NVIDIA (R) Cuda compiler driver
Copyright (c) 2005-2023 NVIDIA Corporation
Built on ...
Cuda compilation tools, release 12.2, V12.2.xxx
```

**If you see this:** SKIP to PHASE 4.

**Expected Outcome B (CUDA Not Installed):**
```
Command 'nvcc' not found
```

**If you see this:** Continue to Step 3.2.

---

## Step 3.2: Navigate to Downloads Folder

**Type these commands one by one:**
```
cd ~
```
```
mkdir -p downloads
```
```
cd downloads
```

**Expected Outcome:** Your prompt changes to show `~/downloads`

---

## Step 3.3: Download CUDA Installer

**Type this command (it's one long line - copy the whole thing):**
```
wget https://developer.download.nvidia.com/compute/cuda/12.2.0/local_installers/cuda_12.2.0_535.54.03_linux.run
```

**Expected Duration:** 2-10 minutes (file is about 4GB).

**Expected Outcome:** Shows download progress, then completes.

---

## Step 3.4: Make Installer Executable

**Type this command:**
```
chmod +x cuda_12.2.0_535.54.03_linux.run
```

**Expected Outcome:** No output (silence means success).

---

## Step 3.5: Run CUDA Installer

**Type this command:**
```
sudo ./cuda_12.2.0_535.54.03_linux.run --toolkit --silent --override
```

**Expected Duration:** 5-10 minutes.

**Expected Outcome:** Returns to command prompt after installation.

---

## Step 3.6: Add CUDA to System Path

**Type these commands one by one:**

```
echo 'export PATH=/usr/local/cuda-12.2/bin:$PATH' >> ~/.bashrc
```

```
echo 'export LD_LIBRARY_PATH=/usr/local/cuda-12.2/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
```

```
source ~/.bashrc
```

**Expected Outcome:** No output (silence means success).

---

## Step 3.7: Verify CUDA Installation

**Type this command:**
```
nvcc --version
```

**Expected Outcome:**
```
nvcc: NVIDIA (R) Cuda compiler driver
Cuda compilation tools, release 12.2, V12.2.xxx
```

**If you see this:** SUCCESS! Continue to PHASE 4.

---

# PHASE 4: INSTALL OLLAMA

Ollama is the easiest way to run AI models. It handles everything automatically.

## Step 4.1: Download and Install Ollama

**Type this command:**
```
curl -fsSL https://ollama.com/install.sh | sh
```

**Expected Duration:** 1-2 minutes.

**Expected Outcome:** Shows installation progress, ends with "Install complete"

---

## Step 4.2: Verify Ollama Installed

**Type this command:**
```
ollama --version
```

**Expected Outcome:** Shows version number like `ollama version 0.1.xx`

---

## Step 4.3: Configure Ollama for Network Access

We need to make Ollama accessible from other computers.

**Type this command:**
```
sudo mkdir -p /etc/systemd/system/ollama.service.d
```

**Then type this command:**
```
sudo nano /etc/systemd/system/ollama.service.d/override.conf
```

**A text editor opens. Type EXACTLY this (3 lines):**
```
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
Environment="OLLAMA_ORIGINS=*"
```

**To save and exit:**
1. Press `Ctrl + X`
2. Press `Y`
3. Press `Enter`

---

## Step 4.4: Restart Ollama Service

**Type these commands:**
```
sudo systemctl daemon-reload
```
```
sudo systemctl restart ollama
```

---

## Step 4.5: Verify Ollama is Running

**Type this command:**
```
sudo systemctl status ollama
```

**Expected Outcome:** Shows "active (running)" in green.

**Press `q` to exit the status view.**

---

## Step 4.6: Test Ollama

**Type this command:**
```
curl http://localhost:11434/api/tags
```

**Expected Outcome:**
```
{"models":[]}
```

(Empty list because we haven't downloaded any models yet)

---

# PHASE 5: DOWNLOAD AI MODELS

Now we download the three AI models you need.

## Step 5.1: Download Embedding Model

This model converts text into numbers for search. Size: ~700MB.

**Type this command:**
```
ollama pull nomic-embed-text
```

**Expected Duration:** 2-5 minutes.

**Expected Outcome:** Shows download progress bar, then completes.

---

## Step 5.2: Download Chat Model

This model answers questions. Size: ~4.7GB.

**Type this command:**
```
ollama pull qwen2.5:7b
```

**Expected Duration:** 5-15 minutes.

**Expected Outcome:** Shows download progress bar, then completes.

---

## Step 5.3: Download Vision Model

This model extracts data from images (KPI dashboards). Size: ~8GB.

**Type this command:**
```
ollama pull llava:13b
```

**Expected Duration:** 10-20 minutes.

**Expected Outcome:** Shows download progress bar, then completes.

---

## Step 5.4: Verify All Models Downloaded

**Type this command:**
```
ollama list
```

**Expected Outcome:**
```
NAME                      ID            SIZE    MODIFIED
nomic-embed-text:latest   abc123...     274 MB  X minutes ago
qwen2.5:7b                def456...     4.7 GB  X minutes ago
llava:13b                 ghi789...     8.0 GB  X minutes ago
```

**If you see all 3 models:** SUCCESS! Continue to PHASE 6.

---

# PHASE 6: TEST THE MODELS

## Step 6.1: Test Chat Model

**Type this command:**
```
ollama run qwen2.5:7b "What is 2 plus 2?"
```

**Expected Outcome:** The model responds with "4" and possibly an explanation.

**Type `/bye` to exit the chat.**

---

## Step 6.2: Test Embedding Model

**Type this command:**
```
curl http://localhost:11434/api/embeddings -d '{"model": "nomic-embed-text", "prompt": "Hello world"}'
```

**Expected Outcome:** A long JSON response with many numbers like:
```
{"embedding":[0.123, -0.456, 0.789, ...]}
```

---

## Step 6.3: Monitor GPU During Test

**Open a NEW terminal window** (keep the first one open).

**In the new terminal, type:**
```
watch -n 1 nvidia-smi
```

**This shows GPU usage updating every second.**

**Expected Outcome:** When running AI models, you should see:
- Memory-Usage increasing (models loaded)
- GPU-Util showing percentage (0-100%)

**Press `Ctrl + C` to exit the monitor.**

---

## Step 6.4: Test Vision Model

**Type this command:**
```
ollama run llava:13b "Describe what you see in a typical KPI dashboard"
```

**Expected Outcome:** The model describes what KPI dashboards typically contain.

**Type `/bye` to exit.**

---

# PHASE 7: OPEN FIREWALL

Your Bosch VM needs to connect to this server. We need to open the port.

## Step 7.1: Check Current Firewall Status

**Type this command:**
```
sudo ufw status
```

**Expected Outcome A (Firewall Inactive):**
```
Status: inactive
```
If you see this, you can skip to PHASE 8 (no firewall blocking).

**Expected Outcome B (Firewall Active):**
```
Status: active
...
```
If you see this, continue to Step 7.2.

---

## Step 7.2: Open Ollama Port

**Type this command:**
```
sudo ufw allow 11434/tcp
```

**Expected Outcome:** "Rule added"

---

## Step 7.3: Verify Port is Open

**Type this command:**
```
sudo ufw status
```

**Expected Outcome:** Shows `11434/tcp ALLOW Anywhere`

---

# PHASE 8: GET SERVER IP ADDRESS

You need this IP to connect from Bosch VM.

## Step 8.1: Find Your IP Address

**Type this command:**
```
hostname -I
```

**Expected Outcome:** Shows IP addresses like:
```
192.168.1.100 10.0.0.5
```

**Write down the first IP address.** This is your Matasma server IP.

---

## Step 8.2: Test Remote Access (Optional)

If you have another computer on the same network:

**On that other computer, type:**
```
curl http://MATASMA_IP:11434/api/tags
```

Replace `MATASMA_IP` with the IP you wrote down.

**Expected Outcome:** Shows the list of models.

---

# PHASE 9: VERIFY EVERYTHING WORKS

## Step 9.1: Final GPU Check

**Type this command:**
```
nvidia-smi
```

**Verify:**
- [ ] GPU shows "NVIDIA RTX 5000 Ada"
- [ ] Memory shows "32768MiB" total
- [ ] No errors displayed

---

## Step 9.2: Final Ollama Check

**Type this command:**
```
ollama list
```

**Verify:**
- [ ] nomic-embed-text is listed
- [ ] qwen2.5:7b is listed
- [ ] llava:13b is listed

---

## Step 9.3: Final Service Check

**Type this command:**
```
sudo systemctl status ollama
```

**Verify:**
- [ ] Shows "active (running)"

---

# PHASE 10: CONFIGURATION SUMMARY

## Your Matasma Server Settings

Write these down - you'll need them for LedgerLM:

| Setting | Value |
|---------|-------|
| Server IP | _____________ (from Step 8.1) |
| Ollama Port | 11434 |
| Ollama URL | http://YOUR_IP:11434 |
| Embedding Model | nomic-embed-text |
| Chat Model | qwen2.5:7b |
| Vision Model | llava:13b |

---

## Environment Variables for LedgerLM

When you're ready to connect LedgerLM to your Matasma AI server, add these to your Bosch VM's `.env` file:

```bash
USE_LOCAL_AI=true
OLLAMA_BASE_URL=http://MATASMA_IP:11434
OLLAMA_TIMEOUT=600
LOCAL_EMBEDDING_MODEL=nomic-embed-text
LOCAL_CHAT_MODEL=qwen2.5:7b
LOCAL_VISION_MODEL=llava:13b
```

Replace `MATASMA_IP` with your actual IP address.

---

# MAINTENANCE COMMANDS

## Start Ollama (if stopped)
```
sudo systemctl start ollama
```

## Stop Ollama
```
sudo systemctl stop ollama
```

## Restart Ollama
```
sudo systemctl restart ollama
```

## Check Ollama Status
```
sudo systemctl status ollama
```

## View Ollama Logs
```
journalctl -u ollama -f
```
(Press Ctrl+C to exit)

## Update Models
```
ollama pull nomic-embed-text
ollama pull qwen2.5:7b
ollama pull llava:13b
```

## Check GPU Usage
```
nvidia-smi
```

## Check Disk Space
```
df -h
```

---

# TROUBLESHOOTING

## Problem: "Connection refused" when testing

**Solution:**
```
sudo systemctl restart ollama
```
Wait 10 seconds, then try again.

---

## Problem: "Model not found"

**Solution:** Re-download the model:
```
ollama pull model-name
```

---

## Problem: GPU memory error

**Solution:** Restart Ollama to clear memory:
```
sudo systemctl restart ollama
```

---

## Problem: Slow responses

**Check if GPU is being used:**
```
nvidia-smi
```

If GPU-Util is 0% during inference, GPU is not being used. Restart:
```
sudo systemctl restart ollama
```

---

## Problem: Can't connect from Bosch VM

**Check firewall:**
```
sudo ufw status
```

**Make sure port 11434 is open:**
```
sudo ufw allow 11434/tcp
```

**Test locally first:**
```
curl http://localhost:11434/api/tags
```

---

# TOTAL SETUP TIME ESTIMATE

| Phase | Duration |
|-------|----------|
| Phase 1: Access Server | 5 min |
| Phase 2: Check GPU | 15-30 min |
| Phase 3: Install CUDA | 20-30 min |
| Phase 4: Install Ollama | 5 min |
| Phase 5: Download Models | 20-40 min |
| Phase 6: Test Models | 10 min |
| Phase 7: Open Firewall | 5 min |
| Phase 8: Get IP | 2 min |
| Phase 9: Verify | 5 min |
| **TOTAL** | **1.5 - 3 hours** |

---

# NEXT STEPS AFTER THIS GUIDE

1. Your Matasma AI server is now ready
2. Next: Apply code changes to LedgerLM (separate guide)
3. Then: Update Bosch VM to connect to Matasma AI server
4. Finally: Test end-to-end KPI extraction with local AI

---

# COST SAVINGS ACHIEVED

| Before (OpenAI) | After (Matasma) |
|-----------------|-----------------|
| $30-40 per 1M tokens | $0 |
| ~$500-2000/month | ~$50/month electricity |
| Internet required | Works offline |
| Data sent to cloud | Data stays local |

---

**Document Version:** 2.0
**Target Hardware:** NVIDIA RTX 5000 Ada Generation (32GB)
**Target Server:** Matasma (Local/On-Premise)
