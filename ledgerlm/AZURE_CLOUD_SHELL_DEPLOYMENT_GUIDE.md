# Complete LedgerLM Deployment Guide - Azure Cloud Shell Method

## GitHub + Azure Cloud Shell + Bosch Azure

**No Docker Desktop Required! No Azure DevOps Parallelism Wait!**

This guide uses Azure Cloud Shell - a browser-based terminal with Docker pre-installed.

---

## What This Guide Covers

Every step shows:
- **LAPTOP** = Your Matasma laptop (browser only!)
- **GITHUB** = Code backup (only YOU can access)
- **AZURE CLOUD SHELL** = Browser-based terminal with Docker (FREE!)
- **BOSCH AZURE** = Client's cloud (no source code here!)

---

## The Complete Workflow

```
YOUR MATASMA LAPTOP (Browser)
        |
        |---> GitHub Private Repo (YOUR account, Matasma owns it)
        |         |--- Version control, backup, history
        |         |--- Bosch has NO access
        |
        |---> Azure Cloud Shell (Browser-based terminal)
                  |--- Clone code from GitHub
                  |--- Docker is PRE-INSTALLED!
                  |--- Build Docker image
                  |--- Push to Bosch ACR
                            |
                            v
                  BOSCH AZURE VM
                  |--- Pulls image from ACR
                  |--- Runs containers
                  |--- NO source code ever!
```

---

## Why Azure Cloud Shell?

| Feature | Azure Cloud Shell | Docker Desktop |
|---------|------------------|----------------|
| Installation needed | NO | YES |
| Docker available | YES (pre-installed) | After install |
| Works on restricted laptops | YES | NO (blocked) |
| Cost | FREE | FREE |
| Where it runs | In your browser | On your laptop |

---

## Prerequisites Checklist

Before starting, make sure you have:

- [ ] Matasma Azure account (azure@matasma.com or your Azure login)
- [ ] GitHub account with private repo created
- [ ] Code pushed to GitHub (from previous guide)
- [ ] Bosch ACR credentials (boschledgerlm / password)
- [ ] Web browser (Chrome, Edge, or Firefox)

---

## Total Time: 45-60 minutes

| Part | Description | Time |
|------|-------------|------|
| Part 0 | Setup GitHub (if not done) | 20 min |
| Part 1 | Open Azure Cloud Shell | 5 min |
| Part 2 | Clone Code from GitHub | 10 min |
| Part 3 | Build Docker Image | 15-20 min |
| Part 4 | Push to Bosch ACR | 10 min |
| Part 5 | Verify Deployment | 5 min |

---

# PART 0: SETUP GITHUB (Skip if already done)

**If you already have your code on GitHub, skip to PART 1.**

---

## Step 0.1: Create GitHub Account (Skip if you have one)

Time: 5 minutes
Where: Your browser

1. **Open** your web browser (Chrome, Edge, Firefox)

2. **Go to:** https://github.com

3. **You'll see:** GitHub homepage
   ```
   +--------------------------------------------------+
   |  [GitHub Logo]              [Sign in] [Sign up]  |
   |                                                  |
   |     Let's build from here                        |
   |     The world's leading AI-powered developer     |
   |     platform.                                    |
   |                                                  |
   |     [Email field        ] [Sign up for GitHub]   |
   +--------------------------------------------------+
   ```

4. **Click:** Green "Sign up" button (top right corner)

5. **Enter your email:**
   - Type: `your-name@matasma.com` (your work email)
   - **Click:** "Continue"

6. **Create a password:**
   - Type a strong password (at least 15 characters, or 8 with a number and lowercase letter)
   - **Click:** "Continue"

7. **Enter a username:**
   - Type: `matasma2025` (or your preferred username)
   - **Click:** "Continue"

8. **Email preferences:**
   - Type: `n` (or leave unchecked)
   - **Click:** "Continue"

9. **Verify you're human:**
   - Complete the puzzle (usually click on images)

10. **Click:** "Create account"

11. **Check your email:**
    - Open your email inbox
    - Find email from GitHub
    - **Copy** the 6-digit code

12. **Enter the code** on GitHub page

13. **Skip personalization** (or fill in if you want)

**GitHub account created!**

---

## Step 0.2: Create a Personal Access Token (For Git)

Time: 5 minutes
Where: GitHub.com (browser)

**You need this to clone your private repo in Cloud Shell.**

1. **Click:** Your profile picture (top right corner)

2. **Click:** "Settings" (in dropdown menu)
   ```
   +------------------+
   | Your profile     |
   | Your repositories|
   | Your projects    |
   | Your stars       |
   | Your gists       |
   | Settings    <--- |
   +------------------+
   ```

3. **Scroll down** in the left sidebar

4. **Click:** "Developer settings" (at the very bottom)

5. **Click:** "Personal access tokens" (left sidebar)

6. **Click:** "Tokens (classic)"

7. **Click:** "Generate new token" (dropdown appears)

8. **Click:** "Generate new token (classic)"

9. **GitHub asks for password** - enter it

10. **Fill in the form:**
    ```
    Note: cloud-shell-access
    Expiration: 90 days (or "No expiration" if you prefer)
    ```

11. **Select scopes (checkboxes):**
    - [x] **repo** (check the whole "repo" section)
      - This gives access to private repositories

12. **Scroll down**

13. **Click:** Green "Generate token" button

14. **IMPORTANT - COPY THE TOKEN NOW!**
    ```
    +--------------------------------------------------+
    |  ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx        |
    |                                    [Copy icon]   |
    +--------------------------------------------------+
    ```
    - **Click** the copy icon
    - **Save** this somewhere safe (you won't see it again!)
    - Paste it in Notepad temporarily

**Token created! Keep this safe - you'll need it later.**

---

## Step 0.3: Create Private Repository

Time: 3 minutes
Where: GitHub.com (browser)

1. **Go to:** https://github.com

2. **Click:** The "+" icon (top right, next to your profile)
   ```
   [ + v ]  <-- Click this
   ```

3. **Click:** "New repository"

4. **Fill in the form:**

   **Repository name:**
   ```
   ledgerlm-private
   ```

   **Description (optional):**
   ```
   LedgerLM - AI Financial Analysis Platform
   ```

5. **IMPORTANT - Select visibility:**
   ```
   ( ) Public   <-- DO NOT SELECT
   (o) Private  <-- SELECT THIS ONE
   ```

6. **Leave these UNCHECKED:**
   - [ ] Add a README file
   - [ ] Add .gitignore
   - [ ] Choose a license

7. **Click:** Green "Create repository" button

8. **You'll see:** Instructions page with repository URL
   ```
   Quick setup - if you've done this kind of thing before
   
   https://github.com/matasma2025/ledgerlm-private.git
                                                   ^
                                          Copy this URL!
   ```

9. **Copy the URL** (you'll need it later)

**Private repository created!**

---

## Step 0.4: Push Your Code to GitHub (From Your Laptop)

Time: 10 minutes
Where: Your Matasma laptop, Command Prompt

**This uploads your code to GitHub for backup and for Cloud Shell to access.**

### Open Command Prompt:

1. **Press:** Windows key on keyboard

2. **Type:** `cmd`

3. **Click:** "Command Prompt" (black icon)

### Navigate to your project:

4. **Type this command:**
   ```cmd
   cd C:\path\to\your\LedgerLM
   ```
   - **Replace** with YOUR actual project path!
   - **Example:** `cd C:\Users\John\Documents\LedgerLM`

5. **Press Enter**

### Initialize Git (if not done):

6. **Type:**
   ```cmd
   git init
   ```

7. **Press Enter**
   - If it says "Reinitialized", that's OK - it was already initialized

### Create .gitignore file:

8. **Type:**
   ```cmd
   notepad .gitignore
   ```

9. **Press Enter** - Notepad opens

10. **If asked "Create new file?"** - Click "Yes"

11. **Paste this content:**
    ```
    # Dependencies
    node_modules/
    
    # Environment files (NEVER commit these!)
    .env
    .env.local
    .env.production
    .env.*.local
    
    # Build output
    dist/
    build/
    
    # Logs
    *.log
    npm-debug.log*
    
    # IDE
    .vscode/
    .idea/
    
    # OS
    .DS_Store
    Thumbs.db
    
    # Uploads
    uploads/
    
    # Python
    __pycache__/
    *.pyc
    venv/
    ```

12. **Save:** Press Ctrl+S

13. **Close** Notepad

### Add and commit files:

14. **Type:**
    ```cmd
    git add .
    ```

15. **Press Enter** (may take 30 seconds)

16. **Type:**
    ```cmd
    git commit -m "Initial commit - LedgerLM"
    ```

17. **Press Enter**

### Connect to GitHub:

18. **Type:**
    ```cmd
    git branch -M main
    ```

19. **Press Enter**

20. **Type:**
    ```cmd
    git remote add origin https://github.com/matasma2025/ledgerlm-private.git
    ```
    - **Replace** `matasma2025` with YOUR GitHub username!

21. **Press Enter**

### Push to GitHub:

22. **Type:**
    ```cmd
    git push -u origin main
    ```

23. **Press Enter**

24. **A popup appears asking for credentials:**
    
    **For Username:**
    - Enter your GitHub username (e.g., `matasma2025`)
    
    **For Password:**
    - **DO NOT enter your GitHub password!**
    - Enter your **Personal Access Token** (from Step 0.2)
    - The one that starts with `ghp_`

25. **Wait** for upload (1-5 minutes)

26. **Success message:**
    ```
    Branch 'main' set up to track remote branch 'main' from 'origin'.
    ```

**Code uploaded to GitHub!**

---

## Step 0.5: Verify Code is on GitHub

Time: 1 minute
Where: Browser

1. **Go to:** https://github.com/matasma2025/ledgerlm-private
   - Replace `matasma2025` with YOUR username

2. **You should see:**
   - Your folders: client/, server/, python_backend/
   - Files: package.json, Dockerfile, docker-compose.yml
   - **NO .env files** (they were excluded by .gitignore)

3. **Check the "Private" label** next to repository name:
   ```
   [Lock icon] matasma2025/ledgerlm-private  [Private]
   ```

**Your code is safely on GitHub!**

---

# PART 1: OPEN AZURE CLOUD SHELL

**Now we'll use Azure's browser-based terminal to build Docker images.**

---

## Step 1.1: Login to Azure Portal

Time: 2 minutes
Where: Your browser

1. **Open** a NEW browser tab

2. **Go to:** https://portal.azure.com

3. **You'll see:** Microsoft login page
   ```
   +------------------------------------------+
   |                                          |
   |         [Microsoft Logo]                 |
   |                                          |
   |    Sign in                               |
   |                                          |
   |    [Email or phone            ]          |
   |                                          |
   |    [Next]                                |
   |                                          |
   +------------------------------------------+
   ```

4. **Enter your email:**
   - Type: `azure@matasma.com` (or your Matasma Azure account)

5. **Click:** "Next"

6. **Enter your password**

7. **Click:** "Sign in"

8. **If asked "Stay signed in?":**
   - Click "Yes" (recommended)

9. **You'll see:** Azure Portal Dashboard
   ```
   +----------------------------------------------------------+
   | [Azure] [Search resources...]      [>_] [Bell] [?] [AS]  |
   +----------------------------------------------------------+
   |                                                          |
   |   Welcome to Azure                                       |
   |                                                          |
   |   [Azure services]                                       |
   |   [Create a resource] [Resource groups] [Subscriptions]  |
   |                                                          |
   +----------------------------------------------------------+
   ```

**Logged into Azure Portal!**

---

## Step 1.2: Open Azure Cloud Shell

Time: 3 minutes
Where: Azure Portal (browser)

1. **Look at the TOP MENU BAR** of Azure Portal

2. **Find the Cloud Shell icon:**
   ```
   +----------------------------------------------------------+
   | [Search resources...]      [>_] [Bell] [Settings] [?]    |
   |                             ^^^                          |
   |                          This icon!                      |
   |                    (looks like >_ in a box)              |
   +----------------------------------------------------------+
   ```

3. **Click:** The `[>_]` icon

4. **First time only - Welcome screen appears:**
   ```
   +------------------------------------------+
   |                                          |
   |    Welcome to Azure Cloud Shell          |
   |                                          |
   |    Select: (o) Bash  ( ) PowerShell      |
   |                                          |
   |    [Create storage]                      |
   |                                          |
   +------------------------------------------+
   ```

5. **Make sure "Bash" is selected** (not PowerShell)

6. **Click:** "Create storage"

7. **Wait 30-60 seconds** - Azure creates storage for your shell
   ```
   Requesting a Cloud Shell...
   Connecting terminal...
   ```

8. **Cloud Shell opens** at the bottom of your screen:
   ```
   +----------------------------------------------------------+
   | Azure Cloud Shell                    [Bash v] [X]        |
   +----------------------------------------------------------+
   | yourname@Azure:~$                                        |
   | _                                                        |
   |                                                          |
   |                                                          |
   +----------------------------------------------------------+
   ```

**Cloud Shell is open!**

---

## Step 1.3: Maximize Cloud Shell (Optional but Recommended)

Time: 10 seconds
Where: Azure Portal

1. **Look at the Cloud Shell window** (bottom of screen)

2. **Find the maximize button:**
   ```
   +----------------------------------------------------------+
   | Azure Cloud Shell                [^] [Settings] [X]      |
   |                                   ^                      |
   |                           Maximize button                |
   +----------------------------------------------------------+
   ```

3. **Click:** The maximize button `[^]` (up arrow)

4. **Cloud Shell now fills** the whole browser window

**Larger terminal = easier to work!**

---

## Step 1.4: Verify Docker is Available

Time: 1 minute
Where: Azure Cloud Shell

1. **In Cloud Shell, type:**
   ```bash
   docker --version
   ```

2. **Press Enter**

3. **You should see:**
   ```
   Docker version 20.10.xx, build xxxxxxx
   ```

4. **Also check Git:**
   ```bash
   git --version
   ```

5. **Press Enter**

6. **You should see:**
   ```
   git version 2.x.x
   ```

**Docker and Git are ready!**

---

# PART 2: CLONE CODE FROM GITHUB

**Now we'll download your code from GitHub into Cloud Shell.**

---

## Step 2.1: Configure Git in Cloud Shell

Time: 2 minutes
Where: Azure Cloud Shell

1. **Set your name:**
   ```bash
   git config --global user.name "Your Name"
   ```
   - Replace "Your Name" with your actual name
   - **Press Enter**

2. **Set your email:**
   ```bash
   git config --global user.email "your-name@matasma.com"
   ```
   - Replace with your actual email
   - **Press Enter**

3. **Store credentials temporarily:**
   ```bash
   git config --global credential.helper cache
   ```
   - **Press Enter**

**Git configured!**

---

## Step 2.2: Clone Your Repository

Time: 3 minutes
Where: Azure Cloud Shell

1. **Type this command:**
   ```bash
   git clone https://github.com/matasma2025/ledgerlm-private.git
   ```
   - **Replace** `matasma2025` with YOUR GitHub username!

2. **Press Enter**

3. **When prompted for Username:**
   ```
   Username for 'https://github.com': 
   ```
   - Type your GitHub username (e.g., `matasma2025`)
   - **Press Enter**

4. **When prompted for Password:**
   ```
   Password for 'https://matasma2025@github.com':
   ```
   - **DO NOT type your GitHub password!**
   - Type your **Personal Access Token** (starts with `ghp_`)
   - **Note:** Password won't show as you type - this is normal!
   - **Press Enter**

5. **Wait** for clone to complete:
   ```
   Cloning into 'ledgerlm-private'...
   remote: Enumerating objects: 150, done.
   remote: Counting objects: 100% (150/150), done.
   remote: Compressing objects: 100% (100/100), done.
   remote: Total 150 (delta 50), reused 150 (delta 50)
   Receiving objects: 100% (150/150), 5.00 MiB | 10.00 MiB/s, done.
   Resolving deltas: 100% (50/50), done.
   ```

6. **Navigate into the folder:**
   ```bash
   cd ledgerlm-private
   ```

7. **Press Enter**

**Code cloned!**

---

## Step 2.3: Verify Files are Present

Time: 1 minute
Where: Azure Cloud Shell

1. **List all files:**
   ```bash
   ls -la
   ```

2. **Press Enter**

3. **You should see your project files:**
   ```
   total 100
   drwxr-xr-x  10 user user  4096 Nov 28 10:00 .
   drwxr-xr-x   5 user user  4096 Nov 28 10:00 ..
   drwxr-xr-x   8 user user  4096 Nov 28 10:00 .git
   -rw-r--r--   1 user user   500 Nov 28 10:00 .gitignore
   -rw-r--r--   1 user user  2000 Nov 28 10:00 Dockerfile
   -rw-r--r--   1 user user  1500 Nov 28 10:00 docker-compose.yml
   -rw-r--r--   1 user user  3000 Nov 28 10:00 package.json
   drwxr-xr-x   5 user user  4096 Nov 28 10:00 client
   drwxr-xr-x   5 user user  4096 Nov 28 10:00 server
   drwxr-xr-x   5 user user  4096 Nov 28 10:00 python_backend
   drwxr-xr-x   2 user user  4096 Nov 28 10:00 shared
   ```

4. **Verify Dockerfile exists:**
   ```bash
   cat Dockerfile | head -20
   ```

5. **Press Enter**

6. **You should see** the beginning of your Dockerfile

**All files are present!**

---

## Step 2.4: Create Environment File (If Needed)

Time: 5 minutes
Where: Azure Cloud Shell

**The .env files are NOT in Git (for security). Create one if needed for the build.**

1. **Check if .env.example exists:**
   ```bash
   ls -la .env*
   ```

2. **If you see `.env.example` or `.env.production.example`:**
   ```bash
   cp .env.production.example .env.production
   ```

3. **Edit the file (using nano editor):**
   ```bash
   nano .env.production
   ```

4. **Nano editor opens:**
   ```
   +----------------------------------------------------------+
   |  GNU nano 5.4            .env.production                 |
   +----------------------------------------------------------+
   | # Database                                               |
   | POSTGRES_PASSWORD=                                       |
   | ...                                                      |
   +----------------------------------------------------------+
   | ^G Help  ^O Write Out  ^W Where Is  ^K Cut  ^U Paste     |
   +----------------------------------------------------------+
   ```

5. **Edit the values** using arrow keys to move around

6. **Fill in your values:**
   ```
   POSTGRES_PASSWORD=YourSecurePassword123!
   SESSION_SECRET=SomeRandom32CharacterString
   ```

7. **Save and exit:**
   - Press: **Ctrl + O** (Write Out)
   - Press: **Enter** (confirm filename)
   - Press: **Ctrl + X** (Exit)

**Environment file ready!**

---

# PART 3: BUILD DOCKER IMAGE

**Now we'll build the Docker image in Cloud Shell.**

---

## Step 3.1: Verify You're in the Right Directory

Time: 30 seconds
Where: Azure Cloud Shell

1. **Check current directory:**
   ```bash
   pwd
   ```

2. **Press Enter**

3. **Should show:**
   ```
   /home/yourname/ledgerlm-private
   ```

4. **If NOT in the right folder:**
   ```bash
   cd ~/ledgerlm-private
   ```

**Ready to build!**

---

## Step 3.2: Build the Docker Image

Time: 15-20 minutes
Where: Azure Cloud Shell

**This is the main build step - it compiles your code into a Docker image.**

1. **Start the build:**
   ```bash
   docker build -t ledgerlm-app:latest .
   ```
   - **IMPORTANT:** Don't forget the `.` at the end!

2. **Press Enter**

3. **You'll see build output:**
   ```
   Sending build context to Docker daemon  50MB
   Step 1/25 : FROM node:20-alpine AS builder
   20-alpine: Pulling from library/node
   ...
   Step 5/25 : COPY package*.json ./
   ...
   Step 10/25 : RUN npm ci
   ...
   Step 15/25 : COPY . .
   ...
   Step 20/25 : RUN npm run build
   ...
   Step 25/25 : CMD ["npm", "start"]
   Successfully built a1b2c3d4e5f6
   Successfully tagged ledgerlm-app:latest
   ```

4. **Wait 15-20 minutes** for the build to complete
   - **DO NOT close the browser!**
   - You can watch the progress

5. **Build is complete when you see:**
   ```
   Successfully built abc123def456
   Successfully tagged ledgerlm-app:latest
   ```

**Docker image built!**

---

## Step 3.3: Verify the Image was Created

Time: 30 seconds
Where: Azure Cloud Shell

1. **List Docker images:**
   ```bash
   docker images
   ```

2. **Press Enter**

3. **You should see:**
   ```
   REPOSITORY      TAG       IMAGE ID       CREATED          SIZE
   ledgerlm-app    latest    abc123def456   2 minutes ago    500MB
   node            20-alpine ...            ...              ...
   ```

4. **Note the SIZE** - this is how big your compiled app is

**Image confirmed!**

---

## Step 3.4: Create Version Tag

Time: 30 seconds
Where: Azure Cloud Shell

**Best practice: Create a version tag in addition to 'latest'.**

1. **Create version tag:**
   ```bash
   docker tag ledgerlm-app:latest ledgerlm-app:v1.0.0
   ```

2. **Press Enter**

3. **Verify:**
   ```bash
   docker images
   ```

4. **You should see BOTH tags:**
   ```
   REPOSITORY      TAG       IMAGE ID       SIZE
   ledgerlm-app    latest    abc123def456   500MB
   ledgerlm-app    v1.0.0    abc123def456   500MB
   ```

**Version tag created!**

---

# PART 4: PUSH TO BOSCH ACR

**Now we'll push the image to Bosch's Azure Container Registry.**

---

## Step 4.1: Login to Bosch ACR

Time: 2 minutes
Where: Azure Cloud Shell

1. **Login to Bosch ACR:**
   ```bash
   docker login boschledgerlm.azurecr.io
   ```

2. **Press Enter**

3. **When prompted for Username:**
   ```
   Username: boschledgerlm
   ```
   - Type: `boschledgerlm`
   - **Press Enter**

4. **When prompted for Password:**
   ```
   Password:
   ```
   - Type your Bosch ACR password (it won't show as you type)
   - The password Bosch gave you
   - **Press Enter**

5. **Success message:**
   ```
   WARNING! Your password will be stored unencrypted in /home/user/.docker/config.json.
   Login Succeeded
   ```
   - The warning is OK for Cloud Shell (it's temporary)

**Logged into Bosch ACR!**

---

## Step 4.2: Tag Images for Bosch ACR

Time: 1 minute
Where: Azure Cloud Shell

**We need to tag images with the Bosch registry URL.**

1. **Tag 'latest':**
   ```bash
   docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

2. **Press Enter**

3. **Tag version:**
   ```bash
   docker tag ledgerlm-app:v1.0.0 boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
   ```

4. **Press Enter**

5. **Verify tags:**
   ```bash
   docker images | grep bosch
   ```

6. **You should see:**
   ```
   boschledgerlm.azurecr.io/ledgerlm-app   latest   abc123   500MB
   boschledgerlm.azurecr.io/ledgerlm-app   v1.0.0   abc123   500MB
   ```

**Images tagged for Bosch!**

---

## Step 4.3: Push Images to Bosch ACR

Time: 5-15 minutes
Where: Azure Cloud Shell

**This uploads the image to Bosch's container registry.**

1. **Push 'latest' tag:**
   ```bash
   docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

2. **Press Enter**

3. **You'll see upload progress:**
   ```
   The push refers to repository [boschledgerlm.azurecr.io/ledgerlm-app]
   a1b2c3d4: Pushing [=====>                  ]  50MB/200MB
   e5f6g7h8: Pushing [===========>            ] 100MB/200MB
   ...
   ```

4. **Wait 5-15 minutes** for upload to complete

5. **Success message:**
   ```
   latest: digest: sha256:abc123... size: 1234
   ```

6. **Push version tag:**
   ```bash
   docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
   ```

7. **Press Enter**

8. **This is faster** (shares layers with 'latest'):
   ```
   v1.0.0: digest: sha256:abc123... size: 1234
   ```

**Images pushed to Bosch ACR!**

---

## Step 4.4: Verify Push was Successful

Time: 1 minute
Where: Azure Cloud Shell

1. **List images in Bosch ACR:**
   ```bash
   az acr repository list --name boschledgerlm --output table
   ```

2. **Press Enter**

3. **You should see:**
   ```
   Result
   ------------
   ledgerlm-app
   ```

4. **Check the tags:**
   ```bash
   az acr repository show-tags --name boschledgerlm --repository ledgerlm-app --output table
   ```

5. **You should see:**
   ```
   Result
   --------
   latest
   v1.0.0
   ```

**Push verified!**

---

# PART 5: VERIFY IN AZURE PORTAL

**Let's confirm the image is in Bosch's Azure.**

---

## Step 5.1: View Image in Azure Portal

Time: 3 minutes
Where: Azure Portal (browser)

1. **Go back to Azure Portal tab** (or open https://portal.azure.com)

2. **In the search bar at top**, type:
   ```
   boschledgerlm
   ```

3. **Click:** "boschledgerlm" under "Container registries"
   ```
   +------------------------------------------+
   | Search results                           |
   |------------------------------------------|
   | Container registries                     |
   |   [icon] boschledgerlm   <-- Click this  |
   +------------------------------------------+
   ```

4. **You're now in the Container Registry page**

5. **In the left sidebar**, click: "Repositories"
   ```
   +------------------+
   | Overview         |
   | Activity log     |
   | Access control   |
   | Tags             |
   | ...              |
   | Services         |
   |   Repositories   | <-- Click
   |   Webhooks       |
   +------------------+
   ```

6. **You should see:** `ledgerlm-app`
   ```
   +------------------------------------------+
   | Repositories                             |
   |------------------------------------------|
   | Name              Last updated           |
   | ledgerlm-app      Just now        <--    |
   +------------------------------------------+
   ```

7. **Click:** "ledgerlm-app"

8. **You should see your tags:**
   ```
   +------------------------------------------+
   | ledgerlm-app                             |
   |------------------------------------------|
   | Tag        Digest          Created       |
   | latest     sha256:abc...   Just now      |
   | v1.0.0     sha256:abc...   Just now      |
   +------------------------------------------+
   ```

**Image confirmed in Bosch ACR!**

---

## Step 5.2: Get the Full Image Path

Time: 30 seconds
Where: Azure Portal

**You'll need this path for deploying to the VM.**

1. **The full image path is:**
   ```
   boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```
   or
   ```
   boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
   ```

2. **Copy this** - you'll use it when deploying to Bosch VM

**Deployment complete!**

---

# PART 6: CLEANUP (Optional)

**Clean up Cloud Shell resources after deployment.**

---

## Step 6.1: Remove Local Images (Optional)

Time: 1 minute
Where: Azure Cloud Shell

**Free up Cloud Shell storage by removing local images.**

1. **Remove local images:**
   ```bash
   docker rmi ledgerlm-app:latest ledgerlm-app:v1.0.0
   docker rmi boschledgerlm.azurecr.io/ledgerlm-app:latest
   docker rmi boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
   ```

2. **Remove source code folder (optional):**
   ```bash
   cd ~
   rm -rf ledgerlm-private
   ```

**Cleanup complete!**

---

## Step 6.2: Close Cloud Shell

Time: 10 seconds
Where: Azure Portal

1. **Click:** The "X" button on Cloud Shell window

2. **Or type:**
   ```bash
   exit
   ```

**Cloud Shell closed!**

---

# PART 7: DEPLOY ON BOSCH VM

**Now we'll deploy the app on the Bosch VM (ledger-llm-VM).**

**Who does this:** You OR Bosch IT (whoever has SSH access to the VM)

---

## Step 7.1: Connect to Bosch VM

Time: 2 minutes
Where: Your laptop OR Bosch IT's computer

### Option A: Using SSH from Command Prompt (Windows)

1. **Open Command Prompt:**
   - Press Windows key
   - Type: `cmd`
   - Press Enter

2. **Connect via SSH:**
   ```cmd
   ssh adminuser@<BOSCH-VM-STATIC-IP>
   ```
   - Replace `adminuser` with the actual username
   - Replace `<BOSCH-VM-STATIC-IP>` with the actual IP (e.g., `20.193.xxx.xxx`)

3. **Enter password when prompted**

4. **You're now connected to the VM:**
   ```
   adminuser@ledger-llm-VM:~$
   ```

### Option B: Using Azure Portal (Browser)

1. **Go to:** https://portal.azure.com

2. **Search for:** `ledger-llm-VM`

3. **Click:** The VM in search results

4. **In left sidebar**, click: "Connect" → "SSH"

5. **Follow the on-screen instructions**

**Connected to Bosch VM!**

---

## Step 7.2: Verify Docker is Installed on VM

Time: 1 minute
Where: Bosch VM (SSH session)

1. **Check Docker version:**
   ```bash
   docker --version
   ```

2. **Should show:**
   ```
   Docker version 20.10.xx, build xxxxxxx
   ```

3. **Check Docker Compose:**
   ```bash
   docker-compose --version
   ```

4. **Should show:**
   ```
   docker-compose version 1.29.x, build xxxxxxx
   ```

**If Docker is NOT installed:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get install docker-compose -y

# Add user to docker group (so you don't need sudo)
sudo usermod -aG docker $USER

# Log out and log back in for group change to take effect
exit
# Then SSH back in
```

**Docker is ready!**

---

## Step 7.3: Login to Bosch ACR from VM

Time: 2 minutes
Where: Bosch VM (SSH session)

1. **Login to the container registry:**
   ```bash
   docker login boschledgerlm.azurecr.io
   ```

2. **Enter Username when prompted:**
   ```
   Username: boschledgerlm
   ```

3. **Enter Password when prompted:**
   ```
   Password: (the ACR password from Bosch IT)
   ```

4. **Success message:**
   ```
   Login Succeeded
   ```

**Logged into Bosch ACR!**

---

## Step 7.4: Pull the Docker Image

Time: 5-10 minutes
Where: Bosch VM (SSH session)

1. **Pull the latest image:**
   ```bash
   docker pull boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

2. **Wait for download:**
   ```
   latest: Pulling from ledgerlm-app
   a1b2c3d4: Pull complete
   e5f6g7h8: Pull complete
   ...
   Status: Downloaded newer image for boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

3. **Verify image is downloaded:**
   ```bash
   docker images | grep ledgerlm
   ```

4. **You should see:**
   ```
   boschledgerlm.azurecr.io/ledgerlm-app   latest   abc123   500MB
   ```

**Image downloaded!**

---

## Step 7.5: Create Application Directory

Time: 1 minute
Where: Bosch VM (SSH session)

1. **Create directory for the app:**
   ```bash
   sudo mkdir -p /opt/ledgerlm
   ```

2. **Set ownership:**
   ```bash
   sudo chown $USER:$USER /opt/ledgerlm
   ```

3. **Navigate to the directory:**
   ```bash
   cd /opt/ledgerlm
   ```

**Directory created!**

---

## Step 7.6: Create docker-compose.yml on VM

Time: 5 minutes
Where: Bosch VM (SSH session)

1. **Create the docker-compose file:**
   ```bash
   nano docker-compose.yml
   ```

2. **Paste this content:**
   ```yaml
   version: '3.8'

   services:
     app:
       image: boschledgerlm.azurecr.io/ledgerlm-app:latest
       container_name: ledgerlm-app
       restart: always
       ports:
         - "80:80"
       environment:
         DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
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
         NEMKO_ADMIN_OTP: ${NEMKO_ADMIN_OTP}
       volumes:
         - app_uploads:/app/uploads
       extra_hosts:
         - "host.docker.internal:host-gateway"

   volumes:
     app_uploads:
       driver: local
   ```

3. **Save and exit:**
   - Press: **Ctrl + O** (Write Out)
   - Press: **Enter** (confirm)
   - Press: **Ctrl + X** (Exit)

**docker-compose.yml created!**

---

## Step 7.7: Create Environment File (.env)

Time: 5 minutes
Where: Bosch VM (SSH session)

1. **Create .env file:**
   ```bash
   nano .env
   ```

2. **Add your configuration:**
   ```bash
   # PostgreSQL (running on this VM)
   POSTGRES_HOST=172.17.0.1
   POSTGRES_PORT=5432
   POSTGRES_DB=ledgerlm
   POSTGRES_USER=ledgerlm
   POSTGRES_PASSWORD=YOUR_POSTGRES_PASSWORD_HERE

   # Application
   SESSION_SECRET=GenerateA32CharRandomStringHere123!

   # OpenAI
   OPENAI_API_KEY=sk-your-openai-api-key-here

   # Email (SMTP)
   SMTP_HOST=your-smtp-server.com
   SMTP_PORT=465
   SMTP_USER=your-email@domain.com
   SMTP_PASSWORD=your-smtp-password
   SMTP_FROM=noreply@ledgerlm.com

   # Admin OTP (hardcoded login for nemkomatasma@nemko.com)
   NEMKO_ADMIN_OTP=123456
   ```

3. **Replace the placeholder values** with your actual values!

4. **Save and exit:**
   - Press: **Ctrl + O**
   - Press: **Enter**
   - Press: **Ctrl + X**

**Environment file created!**

---

## Step 7.8: Start the Application

Time: 2 minutes
Where: Bosch VM (SSH session)

1. **Start the containers:**
   ```bash
   docker-compose up -d
   ```

2. **You should see:**
   ```
   Creating network "ledgerlm_default" with the default driver
   Creating volume "ledgerlm_app_uploads" with local driver
   Creating ledgerlm-app ... done
   ```

3. **Check if running:**
   ```bash
   docker ps
   ```

4. **You should see:**
   ```
   CONTAINER ID   IMAGE                                       STATUS         PORTS
   abc123def456   boschledgerlm.azurecr.io/ledgerlm-app:...   Up 1 minute    0.0.0.0:80->80/tcp
   ```

**Application started!**

---

## Step 7.9: Check Application Logs

Time: 1 minute
Where: Bosch VM (SSH session)

1. **View logs:**
   ```bash
   docker logs ledgerlm-app
   ```

2. **For continuous logs:**
   ```bash
   docker logs -f ledgerlm-app
   ```
   - Press **Ctrl + C** to stop watching

3. **Look for success messages:**
   ```
   [nginx] Starting nginx...
   [node] Server running on port 5000
   [python] Uvicorn running on http://0.0.0.0:8000
   ```

**Logs look good!**

---

## Step 7.10: Seed the Admin User

Time: 2 minutes
Where: Bosch VM (SSH session)

**Add the admin user to the database:**

1. **Connect to PostgreSQL:**
   ```bash
   sudo -u postgres psql -d ledgerlm
   ```

2. **Insert admin user:**
   ```sql
   INSERT INTO users (id, username, display_name, role)
   VALUES (
       gen_random_uuid(),
       'nemkomatasma@nemko.com',
       'Nemko Admin (Matasma)',
       'admin'
   )
   ON CONFLICT (username) DO UPDATE SET
       role = 'admin',
       display_name = 'Nemko Admin (Matasma)';
   ```

3. **Verify:**
   ```sql
   SELECT id, username, display_name, role FROM users;
   ```

4. **Exit psql:**
   ```sql
   \q
   ```

**Admin user created!**

---

## Step 7.11: Test the Application

Time: 2 minutes
Where: Your browser

1. **Open your web browser**

2. **Go to:** `http://<BOSCH-VM-STATIC-IP>`
   - Replace with the actual static IP (e.g., `http://20.193.xxx.xxx`)

3. **You should see:** The LedgerLM login page!
   ```
   +------------------------------------------+
   |                                          |
   |         [LedgerLM Logo]                  |
   |                                          |
   |    Sign in to your account               |
   |                                          |
   |    Email: [________________]             |
   |                                          |
   |    [Send Login Code]                     |
   |                                          |
   +------------------------------------------+
   ```

4. **Test login:**
   - Enter: `nemkomatasma@nemko.com`
   - Enter OTP: `123456` (the hardcoded one from .env)
   - Click: Sign In

5. **You should be logged in!**

**Application is working!**

---

## Step 7.12: Summary - What's Running Where

```
+------------------------------------------------------------------+
|                        BOSCH VM                                  |
|                    (ledger-llm-VM)                               |
|                    Static IP: xx.xx.xx.xx                        |
|                                                                  |
|  +-----------------------------+  +---------------------------+  |
|  |      PostgreSQL             |  |    Docker Container       |  |
|  |      (on VM directly)       |  |    (ledgerlm-app)         |  |
|  |      Port: 5432             |  |    Port: 80               |  |
|  |                             |  |                           |  |
|  |      Database: ledgerlm     |◄─|  - Node.js backend        |  |
|  |      User: ledgerlm         |  |  - Python backend         |  |
|  |                             |  |  - Nginx                  |  |
|  +-----------------------------+  +---------------------------+  |
|                                              |                   |
|                                              |                   |
+----------------------------------------------│-------------------+
                                               |
                                               ▼
                                   Users access via browser
                                   http://xx.xx.xx.xx
```

**Deployment complete!**

---

# QUICK REFERENCE: COMMANDS SUMMARY

## Clone and Build
```bash
# Clone from GitHub
git clone https://github.com/matasma2025/ledgerlm-private.git
cd ledgerlm-private

# Build Docker image
docker build -t ledgerlm-app:latest .
docker tag ledgerlm-app:latest ledgerlm-app:v1.0.0
```

## Push to Bosch ACR
```bash
# Login to Bosch ACR
docker login boschledgerlm.azurecr.io

# Tag for Bosch
docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:latest
docker tag ledgerlm-app:v1.0.0 boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0

# Push to Bosch
docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
```

## Verify
```bash
# List images in Bosch ACR
az acr repository list --name boschledgerlm --output table
az acr repository show-tags --name boschledgerlm --repository ledgerlm-app --output table
```

---

# TROUBLESHOOTING

## Problem: "git clone" asks for password and fails

**Solution:** Use Personal Access Token, not password!

1. Create token at: GitHub → Settings → Developer settings → Personal access tokens
2. Use the token (starts with `ghp_`) as the password

---

## Problem: "docker build" fails with "no space left"

**Solution:** Clean up Cloud Shell storage

```bash
# Remove unused Docker resources
docker system prune -a

# Check disk space
df -h
```

---

## Problem: "docker login" fails with "unauthorized"

**Solution:** Check credentials

1. Username should be: `boschledgerlm` (the ACR name)
2. Password should be the one from Bosch IT
3. Make sure there are no extra spaces

---

## Problem: "docker push" is very slow

**Solution:** This is normal for first push

- First push: 10-20 minutes (uploads all layers)
- Later pushes: 2-5 minutes (only uploads changed layers)

---

## Problem: Cloud Shell times out

**Solution:** Keep the shell active

- Cloud Shell times out after 20 minutes of inactivity
- If it times out during build, you may need to restart
- Consider using the "tmux" command to keep session alive:
  ```bash
  tmux new -s build
  # Run your commands here
  # If disconnected, reconnect with: tmux attach -t build
  ```

---

## Problem: Build fails with npm errors

**Solution:** Check package.json and node version

```bash
# Check Node version
node --version

# Should be Node 18 or 20
# If issues persist, check your Dockerfile uses correct base image
```

---

# SUCCESS CHECKLIST

After completing this guide, verify:

- [ ] Code is on GitHub (private repo)
- [ ] Docker image built successfully in Cloud Shell
- [ ] Image tagged with both `latest` and `v1.0.0`
- [ ] Logged into Bosch ACR successfully
- [ ] Images pushed to Bosch ACR
- [ ] Images visible in Azure Portal under boschledgerlm → Repositories
- [ ] Both tags (latest, v1.0.0) appear in the repository

**If all boxes are checked, your deployment is successful!**

---

# UPDATING THE APP (Future Deployments)

When you make changes to your code:

1. **Push to GitHub** (from your laptop):
   ```bash
   git add .
   git commit -m "Update: description of changes"
   git push
   ```

2. **Open Azure Cloud Shell**

3. **Pull latest code:**
   ```bash
   cd ~/ledgerlm-private
   git pull
   ```

4. **Rebuild and push:**
   ```bash
   docker build -t ledgerlm-app:v1.1.0 .
   docker tag ledgerlm-app:v1.1.0 boschledgerlm.azurecr.io/ledgerlm-app:v1.1.0
   docker tag ledgerlm-app:v1.1.0 boschledgerlm.azurecr.io/ledgerlm-app:latest
   docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.1.0
   docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

5. **On Bosch VM, pull and restart:**
   ```bash
   docker pull boschledgerlm.azurecr.io/ledgerlm-app:latest
   docker-compose down
   docker-compose up -d
   ```

---

**Congratulations! You've successfully deployed using Azure Cloud Shell!**

---

# APPENDIX A: USING EXISTING POSTGRESQL ON BOSCH VM

**Use this section if PostgreSQL is ALREADY installed on the Bosch VM (not in Docker).**

---

## A.1: Understanding the Setup

```
+--------------------------------------------------+
|                  BOSCH VM                        |
|                                                  |
|   +-----------------+    +-------------------+   |
|   | PostgreSQL      |    | Docker Container  |   |
|   | (on VM directly)|<---|  (LedgerLM App)   |   |
|   | Port 5432       |    |  Port 80          |   |
|   +-----------------+    +-------------------+   |
|          ^                        |              |
|          |                        |              |
|          +---- 172.17.0.1 --------+              |
|          (Docker's gateway to host)              |
+--------------------------------------------------+
```

**Key Point:** Docker containers use `172.17.0.1` to connect to services on the host VM.

---

## A.2: Get PostgreSQL Credentials from Bosch VM

**SSH into the Bosch VM and run these commands:**

### Step 1: Check if PostgreSQL is running

```bash
# Check PostgreSQL service status
sudo systemctl status postgresql
```

**Expected output:**
```
● postgresql.service - PostgreSQL RDBMS
     Active: active (running) since Mon 2024-11-28 10:00:00 UTC
```

### Step 2: Find PostgreSQL version and config location

```bash
# Find PostgreSQL version
psql --version

# Find config file location
sudo -u postgres psql -c "SHOW config_file;"
```

### Step 3: Check existing databases

```bash
# List all databases
sudo -u postgres psql -c "\l"
```

**Look for a database called `ledgerlm` or similar.**

### Step 4: Check existing users

```bash
# List all users
sudo -u postgres psql -c "\du"
```

### Step 5: Create database and user (if they don't exist)

```bash
# Connect as postgres superuser
sudo -u postgres psql

# Inside psql, run these commands:
```

```sql
-- Create database
CREATE DATABASE ledgerlm;

-- Create user with password
CREATE USER ledgerlm WITH ENCRYPTED PASSWORD 'YourSecurePassword123!';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE ledgerlm TO ledgerlm;

-- Enable pgvector extension
\c ledgerlm
CREATE EXTENSION IF NOT EXISTS vector;

-- Exit psql
\q
```

### Step 6: Enable network connections to PostgreSQL

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/*/main/postgresql.conf
```

**Find and change this line:**
```
#listen_addresses = 'localhost'
```

**To:**
```
listen_addresses = '*'
```

**Save and exit (Ctrl+O, Enter, Ctrl+X)**

### Step 7: Allow Docker connections

```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

**Add this line at the end:**
```
# Allow Docker containers to connect
host    ledgerlm    ledgerlm    172.17.0.0/16    md5
```

**Save and exit (Ctrl+O, Enter, Ctrl+X)**

### Step 8: Restart PostgreSQL

```bash
sudo systemctl restart postgresql
```

### Step 9: Test the connection

```bash
# Test from the VM itself
psql -h 127.0.0.1 -U ledgerlm -d ledgerlm
# Enter password when prompted
# Type \q to exit
```

---

## A.3: Your PostgreSQL Credentials

After completing A.2, write down these values:

| Setting | Your Value |
|---------|------------|
| POSTGRES_HOST | `172.17.0.1` |
| POSTGRES_PORT | `5432` |
| POSTGRES_DB | `ledgerlm` |
| POSTGRES_USER | `ledgerlm` |
| POSTGRES_PASSWORD | `(the password you created)` |

---

## A.4: Use the VM PostgreSQL Docker Compose File

**On the Bosch VM**, use the special docker-compose file:

### Step 1: Create the .env file

```bash
# Go to the app directory
cd /opt/ledgerlm

# Create .env file
nano .env
```

### Step 2: Add your configuration

```bash
# ================================
# PostgreSQL (Existing on VM)
# ================================
POSTGRES_HOST=172.17.0.1
POSTGRES_PORT=5432
POSTGRES_DB=ledgerlm
POSTGRES_USER=ledgerlm
POSTGRES_PASSWORD=YourSecurePassword123!

# ================================
# Application
# ================================
APP_PORT=80
SESSION_SECRET=GenerateA32CharRandomString123!

# ================================
# OpenAI
# ================================
OPENAI_API_KEY=sk-your-key-here

# ================================
# Email (SMTP)
# ================================
SMTP_HOST=your-smtp-server
SMTP_PORT=465
SMTP_USER=your-email
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@ledgerlm.com

# ================================
# Admin OTP
# ================================
NEMKO_ADMIN_OTP=123456

# ================================
# Docker Image
# ================================
DOCKER_IMAGE=boschledgerlm.azurecr.io/ledgerlm:latest
```

**Save and exit (Ctrl+O, Enter, Ctrl+X)**

### Step 3: Run with VM PostgreSQL config

```bash
# Use the special docker-compose file
docker-compose -f docker-compose.vm-postgres.yml up -d
```

### Step 4: Check if running

```bash
# Check container status
docker ps

# Check logs
docker logs ledgerlm-app
```

---

## A.5: Seed the Admin User

After the app starts, add the admin user to the database:

```bash
# Connect to PostgreSQL
sudo -u postgres psql -d ledgerlm

# Insert admin user
INSERT INTO users (id, username, display_name, role)
VALUES (
    gen_random_uuid(),
    'nemkomatasma@nemko.com',
    'Nemko Admin (Matasma)',
    'admin'
)
ON CONFLICT (username) DO UPDATE SET
    role = 'admin',
    display_name = 'Nemko Admin (Matasma)';

# Verify
SELECT id, username, display_name, role FROM users;

# Exit
\q
```

---

## A.6: Troubleshooting VM PostgreSQL Connection

### Problem: "connection refused"

**Check PostgreSQL is listening:**
```bash
sudo netstat -tlnp | grep 5432
```

**Should show:**
```
tcp   0   0   0.0.0.0:5432   0.0.0.0:*   LISTEN   1234/postgres
```

If it shows `127.0.0.1:5432`, go back to Step 6 in A.2.

### Problem: "password authentication failed"

**Check pg_hba.conf has the Docker network:**
```bash
sudo cat /etc/postgresql/*/main/pg_hba.conf | grep 172.17
```

**Should show:**
```
host    ledgerlm    ledgerlm    172.17.0.0/16    md5
```

### Problem: "database does not exist"

**Create it:**
```bash
sudo -u postgres createdb ledgerlm
```

### Problem: Container can't reach 172.17.0.1

**Check Docker network:**
```bash
docker network inspect bridge | grep Gateway
```

**If gateway is different (e.g., 172.18.0.1), use that IP instead.**

---

## A.7: Quick Reference - VM PostgreSQL Commands

```bash
# Start app (VM PostgreSQL)
docker-compose -f docker-compose.vm-postgres.yml up -d

# Stop app
docker-compose -f docker-compose.vm-postgres.yml down

# View logs
docker logs -f ledgerlm-app

# Restart app
docker-compose -f docker-compose.vm-postgres.yml restart

# Check PostgreSQL from VM
sudo -u postgres psql -d ledgerlm

# Check PostgreSQL from Docker container
docker exec -it ledgerlm-app sh -c 'curl -v telnet://172.17.0.1:5432'
```

---

# APPENDIX B: WHICH DOCKER COMPOSE TO USE?

| Scenario | File to Use | Command |
|----------|-------------|---------|
| PostgreSQL in Docker (fresh install) | `docker-compose.yml` | `docker-compose up -d` |
| PostgreSQL on VM (existing) | `docker-compose.vm-postgres.yml` | `docker-compose -f docker-compose.vm-postgres.yml up -d` |

---

**End of Guide**
