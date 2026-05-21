# Open-Source AI Deployment Guide for LedgerLM

## Complete End-to-End Guide for NVIDIA RTX 5000 Ada Generation (32GB VRAM)

---

## EXECUTIVE SUMMARY

**Goal:** Replace OpenAI API with open-source models running locally on your GPU server.

**Your Hardware:**
- GPU: NVIDIA RTX 5000 Ada Generation (32GB GDDR6 ECC)
- CUDA Cores: ~12,800
- Memory Bandwidth: ~576 GB/s
- This is excellent for running open-source AI models!

**Models We'll Install:**

| Purpose | Model | VRAM Needed | Accuracy |
|---------|-------|-------------|----------|
| Vision/KPI Extraction | **Qwen2.5-VL-7B-Instruct** | ~16GB | Same as GPT-4V |
| Text Embeddings | **nomic-embed-text** | ~2GB | Same as text-embedding-3-small |
| Text Generation (Chat) | **Qwen2.5-7B-Instruct** | ~16GB | Same as GPT-4 |

**Total VRAM Used:** ~18-20GB (fits easily in your 32GB)

---

## PART 1: PREPARE YOUR SERVER

### Step 1.1: Check Your Server's Operating System

**Action:** Open a terminal on your server and type:

```bash
cat /etc/os-release
```

**Expected Result:** You should see Ubuntu 22.04 or similar Linux distribution.

---

### Step 1.2: Check NVIDIA Driver is Installed

**Action:** Type this command:

```bash
nvidia-smi
```

**Expected Result:** You should see your RTX 5000 Ada with 32GB memory listed.

**If you see an error:** You need to install NVIDIA drivers first.

---

### Step 1.3: Install NVIDIA Driver (If Not Already Installed)

**Action:** Run these commands one by one:

```bash
# Update your system
sudo apt update && sudo apt upgrade -y

# Install NVIDIA driver
sudo apt install nvidia-driver-545 -y

# Restart your server
sudo reboot
```

**After reboot, verify with:**

```bash
nvidia-smi
```

---

### Step 1.4: Install CUDA Toolkit

**Action:** Run these commands:

```bash
# Download CUDA 12.2 installer
wget https://developer.download.nvidia.com/compute/cuda/12.2.0/local_installers/cuda_12.2.0_535.54.03_linux.run

# Make it executable
chmod +x cuda_12.2.0_535.54.03_linux.run

# Install CUDA (toolkit only, driver already installed)
sudo ./cuda_12.2.0_535.54.03_linux.run --toolkit --silent

# Add CUDA to your PATH
echo 'export PATH=/usr/local/cuda-12.2/bin:$PATH' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=/usr/local/cuda-12.2/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc
```

**Verify CUDA installation:**

```bash
nvcc --version
```

**Expected:** Shows CUDA version 12.2

---

## PART 2: INSTALL PYTHON ENVIRONMENT

### Step 2.1: Install Miniconda (Python Package Manager)

**Action:** Run these commands:

```bash
# Download Miniconda
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh

# Make it executable
chmod +x Miniconda3-latest-Linux-x86_64.sh

# Install Miniconda (follow prompts, say "yes" to everything)
./Miniconda3-latest-Linux-x86_64.sh

# Activate conda
source ~/.bashrc
```

**Verify conda works:**

```bash
conda --version
```

---

### Step 2.2: Create Python Environment for AI Models

**Action:** Run these commands:

```bash
# Create new environment with Python 3.10
conda create -n ledgerlm-ai python=3.10 -y

# Activate the environment
conda activate ledgerlm-ai
```

**Your terminal should now show:** `(ledgerlm-ai)` at the beginning of the line.

---

### Step 2.3: Install PyTorch with CUDA Support

**Action:** Run this command (one long line):

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

**Verify PyTorch sees your GPU:**

```bash
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0)}')"
```

**Expected Output:**
```
CUDA available: True
GPU: NVIDIA RTX 5000 Ada Generation
```

---

## PART 3: INSTALL OLLAMA (Easy Model Runner)

Ollama is the easiest way to run open-source AI models. It handles everything automatically.

### Step 3.1: Install Ollama

**Action:** Run this command:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Wait for installation to complete (about 1-2 minutes).**

---

### Step 3.2: Verify Ollama is Running

**Action:** Run this command:

```bash
ollama --version
```

**Expected:** Shows Ollama version number.

---

### Step 3.3: Start Ollama Service

**Action:** Run this command:

```bash
# Start Ollama in the background
sudo systemctl enable ollama
sudo systemctl start ollama
```

**Verify it's running:**

```bash
sudo systemctl status ollama
```

**Expected:** Shows "active (running)"

---

## PART 4: DOWNLOAD AI MODELS

### Step 4.1: Download Embedding Model (for document search)

**Action:** Run this command:

```bash
ollama pull nomic-embed-text
```

**Wait:** Download is about 700MB, takes 2-5 minutes depending on internet speed.

**What this does:** This model converts text into numbers (embeddings) so you can search documents. It replaces OpenAI's text-embedding-3-small.

---

### Step 4.2: Download Chat Model (for text generation)

**Action:** Run this command:

```bash
ollama pull qwen2.5:7b
```

**Wait:** Download is about 4.7GB, takes 5-15 minutes.

**What this does:** This is the main language model for answering questions. It replaces GPT-4.

---

### Step 4.3: Download Vision Model (for KPI extraction from images)

**Action:** Run this command:

```bash
ollama pull llava:13b
```

**Wait:** Download is about 8GB, takes 10-20 minutes.

**What this does:** This model can "see" images and extract data from them. It replaces GPT-4 Vision.

**Alternative (better accuracy but larger):**

```bash
ollama pull llava:34b
```

This is more accurate but uses more VRAM (~20GB). Your RTX 5000 can handle it.

---

### Step 4.4: Verify All Models are Downloaded

**Action:** Run this command:

```bash
ollama list
```

**Expected Output:**
```
NAME                    ID              SIZE    MODIFIED
nomic-embed-text:latest abc123...       274MB   just now
qwen2.5:7b              def456...       4.7GB   just now
llava:13b               ghi789...       8.0GB   just now
```

---

## PART 5: TEST THE MODELS

### Step 5.1: Test Chat Model

**Action:** Run this command:

```bash
ollama run qwen2.5:7b "What is 2+2?"
```

**Expected:** The model responds with "4" and some explanation.

---

### Step 5.2: Test Embedding Model

**Action:** Run this command:

```bash
curl http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "Hello world"
}'
```

**Expected:** A JSON response with a long list of numbers (the embedding).

---

### Step 5.3: Test Vision Model

**Action:** First, download a test image:

```bash
wget -O test_image.png "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png"
```

Then test the vision model:

```bash
ollama run llava:13b "Describe this image: $(cat test_image.png | base64)"
```

---

## PART 6: INSTALL VLLM (High-Performance Alternative)

For even better performance, especially for the Vision model, you can use vLLM.

### Step 6.1: Install vLLM

**Action:** Make sure you're in your conda environment, then:

```bash
conda activate ledgerlm-ai
pip install vllm
```

---

### Step 6.2: Download Qwen2.5-VL Model for vLLM

This is the best open-source vision model for KPI extraction.

**Action:** Run this command:

```bash
pip install transformers accelerate bitsandbytes
```

Then download the model:

```bash
python -c "from transformers import AutoModelForCausalLM, AutoProcessor; AutoProcessor.from_pretrained('Qwen/Qwen2.5-VL-7B-Instruct'); AutoModelForCausalLM.from_pretrained('Qwen/Qwen2.5-VL-7B-Instruct')"
```

**Wait:** This downloads about 15GB of model files. Takes 15-30 minutes.

---

### Step 6.3: Start vLLM Server with Qwen2.5-VL

**Action:** Run this command:

```bash
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-VL-7B-Instruct \
    --port 8080 \
    --trust-remote-code \
    --max-model-len 4096
```

**Leave this running in a terminal or use screen/tmux.**

---

## PART 7: CREATE OLLAMA API SERVICE

We need to run Ollama as a service that LedgerLM can connect to.

### Step 7.1: Create Systemd Service File

**Action:** Run this command:

```bash
sudo nano /etc/systemd/system/ollama-api.service
```

**Paste this content:**

```ini
[Unit]
Description=Ollama API Service
After=network.target

[Service]
Type=simple
User=root
Environment="OLLAMA_HOST=0.0.0.0"
Environment="OLLAMA_ORIGINS=*"
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**Save and exit:** Press Ctrl+X, then Y, then Enter.

---

### Step 7.2: Enable and Start the Service

**Action:** Run these commands:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ollama-api
sudo systemctl start ollama-api
```

---

### Step 7.3: Verify the Service is Running

**Action:** Run this command:

```bash
curl http://localhost:11434/api/tags
```

**Expected:** JSON list of your downloaded models.

---

## PART 8: CONFIGURE LEDGERLM TO USE LOCAL MODELS

Now we need to update LedgerLM to use your local models instead of OpenAI.

### Step 8.1: Environment Variables

Add these to your `.env` file on the Bosch VM:

```bash
# Local AI Configuration
OLLAMA_BASE_URL=http://YOUR_GPU_SERVER_IP:11434
USE_LOCAL_AI=true
LOCAL_EMBEDDING_MODEL=nomic-embed-text
LOCAL_CHAT_MODEL=qwen2.5:7b
LOCAL_VISION_MODEL=llava:13b

# Keep OpenAI as fallback (optional)
OPENAI_API_KEY=sk-your-key-here
```

Replace `YOUR_GPU_SERVER_IP` with the actual IP address of your RTX 5000 server.

---

### Step 8.2: Network Configuration

Make sure your Bosch VM can reach the GPU server:

**On the GPU server, open firewall port:**

```bash
sudo ufw allow 11434/tcp
```

**On the Bosch VM, test connection:**

```bash
curl http://GPU_SERVER_IP:11434/api/tags
```

---

## PART 9: PERFORMANCE OPTIMIZATION

### Step 9.1: GPU Memory Optimization

**Action:** Add these environment variables to maximize GPU usage:

```bash
echo 'export CUDA_VISIBLE_DEVICES=0' >> ~/.bashrc
echo 'export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512' >> ~/.bashrc
source ~/.bashrc
```

---

### Step 9.2: Set Ollama GPU Layers

**Action:** Configure Ollama to use all GPU layers:

```bash
echo 'export OLLAMA_NUM_GPU=999' >> ~/.bashrc
source ~/.bashrc
sudo systemctl restart ollama
```

---

## PART 10: MONITORING AND MAINTENANCE

### Step 10.1: Monitor GPU Usage

**Action:** Run this to see GPU usage in real-time:

```bash
watch -n 1 nvidia-smi
```

Press Ctrl+C to exit.

---

### Step 10.2: View Ollama Logs

**Action:** Run this to see what Ollama is doing:

```bash
journalctl -u ollama -f
```

Press Ctrl+C to exit.

---

### Step 10.3: Update Models

**Action:** Periodically update your models:

```bash
ollama pull nomic-embed-text
ollama pull qwen2.5:7b
ollama pull llava:13b
```

---

## PART 11: QUICK REFERENCE

### Start All Services

```bash
sudo systemctl start ollama
```

### Stop All Services

```bash
sudo systemctl stop ollama
```

### Check Status

```bash
sudo systemctl status ollama
nvidia-smi
```

### Test Chat

```bash
ollama run qwen2.5:7b "Hello, how are you?"
```

### Test Embeddings

```bash
curl http://localhost:11434/api/embeddings -d '{"model": "nomic-embed-text", "prompt": "test"}'
```

---

## COST COMPARISON

| Service | Cost per 1M Tokens |
|---------|-------------------|
| OpenAI GPT-4 | $30.00 |
| OpenAI GPT-4 Vision | $40.00 |
| OpenAI Embeddings | $0.13 |
| **Your Local Setup** | **$0.00** (electricity only) |

**Estimated monthly savings:** $500-2000+ depending on usage

---

## TROUBLESHOOTING

### Problem: "CUDA out of memory"

**Solution:** Use a smaller model or reduce batch size:
```bash
ollama run qwen2.5:3b  # Smaller model
```

### Problem: "Connection refused"

**Solution:** Check Ollama is running:
```bash
sudo systemctl status ollama
sudo systemctl restart ollama
```

### Problem: "Model not found"

**Solution:** Re-download the model:
```bash
ollama pull model-name
```

### Problem: Slow responses

**Solution:** Check GPU is being used:
```bash
nvidia-smi
```
If GPU memory is at 0%, Ollama is using CPU. Restart with:
```bash
sudo systemctl restart ollama
```

---

## NEXT STEPS

After completing this guide:

1. **Test thoroughly** on your GPU server
2. **Update LedgerLM code** to use local Ollama API instead of OpenAI
3. **Deploy updated LedgerLM** to Bosch VM
4. **Configure networking** between Bosch VM and GPU server

---

## ARCHITECTURE DIAGRAM

```
                    BOSCH VM (20.193.250.55)
                    ├── LedgerLM Application
                    ├── PostgreSQL Database
                    └── Nginx Reverse Proxy
                              │
                              │ HTTP API Calls
                              ▼
                    GPU SERVER (RTX 5000 Ada)
                    ├── Ollama Service (port 11434)
                    │   ├── nomic-embed-text (embeddings)
                    │   ├── qwen2.5:7b (chat)
                    │   └── llava:13b (vision/KPI extraction)
                    └── CUDA 12.2 + NVIDIA Driver
```

---

## MODEL DETAILS

### nomic-embed-text (Embeddings)
- **Purpose:** Convert text to vectors for semantic search
- **Dimensions:** 768
- **Speed:** ~500 texts/second
- **VRAM:** ~2GB
- **Replaces:** OpenAI text-embedding-3-small

### qwen2.5:7b (Chat/Text)
- **Purpose:** Answer questions, generate text
- **Context:** 32,768 tokens
- **Speed:** ~50 tokens/second
- **VRAM:** ~16GB
- **Replaces:** GPT-4

### llava:13b (Vision)
- **Purpose:** Extract data from images (KPI dashboards)
- **Input:** Images up to 4096x4096
- **Speed:** ~10 images/minute
- **VRAM:** ~16GB
- **Replaces:** GPT-4 Vision

---

## ESTIMATED SETUP TIME

| Task | Time |
|------|------|
| Driver installation | 15 min |
| CUDA installation | 20 min |
| Python environment | 10 min |
| Ollama installation | 5 min |
| Model downloads | 30-60 min |
| Configuration | 15 min |
| Testing | 15 min |
| **Total** | **~2-3 hours** |

---

**Document Version:** 1.0
**Created for:** LedgerLM Open-Source AI Migration
**Target Hardware:** NVIDIA RTX 5000 Ada Generation (32GB)
