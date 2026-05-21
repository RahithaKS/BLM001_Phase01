# 🚀 LedgerLM Deployment - Step-by-Step for Non-Technical Users
## Matasma Laptop → Bosch Azure (Source Code Protected)

**This guide tells you EXACTLY which laptop to use, what to click, and where to go.**

Every step shows:
- 🖥️ **MATASMA LAPTOP** = Use YOUR work laptop
- ☁️ **BOSCH AZURE** = Use web browser to access Bosch's cloud
- ⏱️ **Time:** How long each step takes
- ✅ **Check:** How to verify it worked

---

## 📋 **Before You Start - What You Need**

### Get These from Bosch IT First

**Call or email Bosch IT Support:**

```
Subject: Need Azure Access for LedgerLM Project

Hi IT Team,

I'm deploying LedgerLM application for Matasma.
I need the following from Bosch Azure:

1. Azure Portal login credentials (for me to access Bosch Azure)
2. Azure Container Registry name (e.g., boschledgerlm.azurecr.io)
3. ACR username and password (to push Docker images)
4. Permission to create Virtual Machines in Azure

Please reply with:
- Azure login: [email/username]
- ACR name: [name].azurecr.io  
- ACR username: [username]
- ACR password: [password]

Thank you!
[Your Name]
Matasma
```

**Write down what they give you:**
- ✍️ Azure login email: ________________
- ✍️ Azure password: ________________
- ✍️ ACR name: ________________.azurecr.io
- ✍️ ACR username: ________________
- ✍️ ACR password: ________________

### Get Your API Keys

**You need these for the application to work:**

1. **OpenAI API Key**
   - Open browser
   - Go to: **https://platform.openai.com/api-keys**
   - Login with your OpenAI account
   - Click green **"+ Create new secret key"** button
   - Name: "LedgerLM-Bosch"
   - Click **"Create secret key"**
   - **COPY THE KEY** (starts with sk-proj-...)
   - Save it in Notepad - you can't see it again!
   - ✍️ Write it here: ________________

2. **Anaplan Credentials**
   - Ask your Anaplan admin for:
   - ✍️ Workspace ID: ________________
   - ✍️ Model ID: ________________
   - ✍️ Process ID: ________________
   - ✍️ Username: ________________
   - ✍️ Password: ________________

3. **Email (SMTP) Settings**
   - Ask Bosch IT for email server:
   - ✍️ SMTP Host: ________________ (e.g., smtp.office365.com)
   - ✍️ SMTP Port: ________ (usually 587 or 465)
   - ✍️ Email username: ________________
   - ✍️ Email password: ________________

**Save this page!** You'll need these values later.

---

## 🖥️ **PART 1: SETUP MATASMA LAPTOP**

**Everything in this section happens on YOUR Matasma work laptop.**

---

### Step 1.1: Install Docker Desktop

⏱️ **Time:** 10 minutes  
🖥️ **Where:** Your Matasma laptop

**What is Docker?** It packages your app so Bosch can't see the source code.

#### Download Docker:

1. **Open** your web browser (Chrome, Edge, Firefox)
2. **Go to:** https://www.docker.com/products/docker-desktop/
3. **You'll see:** Blue website with "Docker Desktop" in big letters
4. **Click:** Big blue **"Download for Windows"** button
   - It's in the middle of the screen
5. **File downloads:** Docker Desktop Installer.exe
6. **Wait** for download to complete (2-5 minutes)

#### Install Docker:

7. **Find** the downloaded file (usually in Downloads folder)
8. **Double-click:** "Docker Desktop Installer.exe"
9. **Windows may ask:** "Do you want to allow this app to make changes?"
   - **Click:** "Yes"
10. **You'll see:** Docker installer window with whale logo
11. **Check the box:** "Use WSL 2 instead of Hyper-V" (if shown)
12. **Click:** Blue "OK" button
13. **Wait** for installation (3-5 minutes)
    - You'll see progress bar
14. **When finished, click:** "Close and restart"
15. **Your computer will restart** - this is normal!

#### After Restart:

16. **Docker Desktop will open automatically**
    - You'll see a blue window with whale logo
17. **Accept** the service agreement if asked
18. **Skip** the tutorial (click "Skip tutorial" at bottom)
19. **You should see:** Docker Desktop dashboard

#### ✅ Verify Docker Works:

20. **Click** Windows Start button (bottom-left)
21. **Type:** `cmd`
22. **Click:** "Command Prompt" (black icon)
23. **Black window opens** - this is the Command Prompt
24. **Type:** `docker --version`
25. **Press Enter**
26. **You should see:** `Docker version 24.x.x`

✅ **Success!** Docker is installed!

**If you see an error:**
- Restart your computer
- Open Docker Desktop again
- Try the verification step again

---

### Step 1.2: Install Azure CLI

⏱️ **Time:** 5 minutes  
🖥️ **Where:** Your Matasma laptop

**What is Azure CLI?** It lets you login to Bosch's Azure from your laptop.

#### Download Azure CLI:

1. **Open** web browser
2. **Go to:** https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows
3. **You'll see:** Microsoft documentation page
4. **Scroll down** a little
5. **Find** the section "Install or update"
6. **Click:** Blue link that says **"Download the MSI installer"**
7. **File downloads:** azure-cli-2.x.x.msi
8. **Wait** for download (1-2 minutes)

#### Install Azure CLI:

9. **Find** the downloaded file (Downloads folder)
10. **Double-click:** azure-cli-2.x.x.msi
11. **Click:** "Next"
12. **Click:** Checkbox "I accept the terms..."
13. **Click:** "Next"
14. **Click:** "Install"
15. **Wait** for installation (2-3 minutes)
16. **Click:** "Finish"

#### ✅ Verify Azure CLI Works:

17. **Close** Command Prompt if still open
18. **Open NEW Command Prompt** (Start → cmd)
19. **Type:** `az --version`
20. **Press Enter**
21. **You should see:** Version info (lots of text)

✅ **Success!** Azure CLI is installed!

---

### Step 1.3: Prepare Your LedgerLM Code

⏱️ **Time:** 5 minutes  
🖥️ **Where:** Your Matasma laptop

#### Find Your Project Folder:

1. **Open** File Explorer (Windows key + E)
2. **Navigate to** where you have LedgerLM code
   - Example: `C:\Users\YourName\Projects\LedgerLM`
3. **You should see folders:**
   - client
   - server
   - python_backend
   - package.json

#### Create Configuration File:

4. **In the LedgerLM folder**, find file: `.env.production.example`
   - **Can't see it?** 
     - Click "View" tab at top
     - Check box "Hidden items"
5. **Right-click** `.env.production.example`
6. **Click:** "Copy"
7. **Right-click** in empty space
8. **Click:** "Paste"
9. **A copy appears** - rename it to: `.env.production`

#### Fill in Configuration:

10. **Right-click** `.env.production`
11. **Click:** "Open with"
12. **Click:** "Notepad"
13. **Notepad opens** with the file

**Now fill in YOUR values** (from the page you saved earlier):

Find these lines and replace with your actual values:

```env
# Line says: POSTGRES_PASSWORD=changeme
# Change to: POSTGRES_PASSWORD=CreateAStrongPassword123!
POSTGRES_PASSWORD=CreateAStrongPassword123!

# Line says: OPENAI_API_KEY=
# Change to: OPENAI_API_KEY=sk-proj-YOUR-ACTUAL-KEY-HERE
OPENAI_API_KEY=sk-proj-YOUR-ACTUAL-KEY-HERE

# Line says: SMTP_HOST=
# Change to: SMTP_HOST=smtp.office365.com (or what Bosch IT gave you)
SMTP_HOST=smtp.office365.com

# Continue for all these:
SMTP_PORT=587
SMTP_USER=your-email@matasma.com
SMTP_PASSWORD=your-email-password
SMTP_FROM=ledgerlm@bosch.com

SESSION_SECRET=MakeUpARandomString32CharactersLong

ANAPLAN_WORKSPACE_ID=your-workspace-id
ANAPLAN_MODEL_ID=your-model-id
ANAPLAN_PROCESS_ID=your-process-id
ANAPLAN_USERNAME=your-anaplan-username
ANAPLAN_PASSWORD=your-anaplan-password
```

14. **Replace ALL values** with your actual credentials
15. **Click:** File → Save
16. **Close** Notepad

✅ **Configuration ready!**

---

### Step 1.4: Build Docker Image

⏱️ **Time:** 15-20 minutes  
🖥️ **Where:** Your Matasma laptop

**This compiles your source code into a sealed package.**

1. **Open** Command Prompt (Start → cmd)

2. **Navigate to your project:**
   - **Type:** `cd C:\Users\YourName\Projects\LedgerLM`
   - **Press Enter**
   - **Replace** `C:\Users\YourName\Projects\LedgerLM` with YOUR actual path!

3. **Type this command EXACTLY:**
   ```
   docker build -t ledgerlm-app:latest .
   ```
   - **Don't forget the dot (.) at the end!**
   
4. **Press Enter**

**What happens:**
- Text starts scrolling (lots of it!)
- Says "Sending build context..."
- Shows "Step 1/25", "Step 2/25", etc.
- Downloads things from internet
- Compiles your code
- **This takes 10-20 minutes - be patient!**
- **DON'T CLOSE THE WINDOW!**

**What you should see at the end:**
```
Successfully built abc123def456
Successfully tagged ledgerlm-app:latest
```

✅ **Success!** Docker image is built!

**If you see errors:**
- Make sure Docker Desktop is running (check system tray)
- Make sure you're in the right folder (cd command)
- Make sure there's a file called "Dockerfile" in the folder

---

### Step 1.5: Login to Bosch's Azure Container Registry

⏱️ **Time:** 2 minutes  
🖥️ **Where:** Your Matasma laptop, Command Prompt

**This connects your laptop to Bosch's Azure.**

1. **In Command Prompt** (same window from previous step)

2. **Type:**
   ```
   az acr login --name boschledgerlm
   ```
   - **Replace** `boschledgerlm` with the ACR name Bosch gave you
   - Example: If they said "mycompany.azurecr.io", use: `az acr login --name mycompany`

3. **Press Enter**

4. **You might see:** "A web browser has been opened..."
   - **A browser window opens**
   - **Login** with the credentials Bosch IT gave you
   - **Close browser** when it says "You have signed in"

**What you should see in Command Prompt:**
```
Login Succeeded
```

✅ **Success!** You're connected to Bosch Azure!

**If you see "unauthorized":**
- Check the ACR name is correct
- Check your internet connection
- Contact Bosch IT - they may need to grant you access

---

### Step 1.6: Tag the Image for Bosch

⏱️ **Time:** 10 seconds  
🖥️ **Where:** Your Matasma laptop, Command Prompt

**This prepares the image for upload.**

1. **Type this command:**
   ```
   docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```
   - **Replace** `boschledgerlm` with YOUR ACR name

2. **Press Enter**

3. **Type this command:**
   ```
   docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
   ```
   - **Replace** `boschledgerlm` with YOUR ACR name

4. **Press Enter**

**No output is normal!** It just goes to next line.

✅ **Tagged!**

---

### Step 1.7: Push Image to Bosch Azure

⏱️ **Time:** 10-20 minutes  
🖥️ **Where:** Your Matasma laptop, Command Prompt

**This uploads the compiled image to Bosch (NO source code!).**

1. **Type:**
   ```
   docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```
   - **Replace** `boschledgerlm` with YOUR ACR name

2. **Press Enter**

**What happens:**
- Shows "Pushing to boschledgerlm.azurecr.io..."
- Shows upload progress with bars
- Multiple layers uploading
- **Takes 10-20 minutes** depending on internet speed
- **DON'T CLOSE THE WINDOW!**

**What you should see at the end:**
```
latest: digest: sha256:abc123... size: 5678
```

3. **Now push the versioned tag:**
   ```
   docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.0
   ```

4. **Press Enter**
5. **Wait** for upload (faster this time, 2-3 minutes)

✅ **Success! Image is now in Bosch's Azure!**

**Your source code is still ONLY on your Matasma laptop!**

---

## ☁️ **PART 2: BOSCH AZURE SETUP**

**Everything in this section happens in Bosch's Azure Portal (web browser).**

---

### Step 2.1: Login to Azure Portal

⏱️ **Time:** 2 minutes  
☁️ **Where:** Web browser

1. **Open** web browser (Chrome, Edge, Firefox)

2. **Go to:** https://portal.azure.com

3. **You'll see:** Microsoft login page
   - Blue background
   - "Sign in" text at top

4. **Enter** the Azure email Bosch IT gave you

5. **Click:** Blue "Next" button

6. **Enter** the password Bosch IT gave you

7. **Click:** "Sign in"

8. **If asked "Stay signed in?"**
   - **Click:** "Yes" (makes it easier next time)

**What you should see:**
- **Azure Portal home page**
- Blue bar at top
- Search box in middle
- Various service icons

✅ **You're logged in to Bosch Azure!**

---

### Step 2.2: Verify ACR Has Your Image

⏱️ **Time:** 2 minutes  
☁️ **Where:** Azure Portal

**Let's verify your image uploaded successfully.**

1. **At the TOP of the screen**, find the **search bar**
   - It's a white box with magnifying glass icon
   - Says "Search resources, services, and docs"

2. **Click** in the search bar

3. **Type:** `container registries`

4. **You'll see** a dropdown with results

5. **Click:** "Container registries" (has a container icon)

6. **You'll see** a list of container registries

7. **Click** on your ACR (name like: boschledgerlm)

8. **On the left sidebar**, find and **click:** "Repositories"
   - Under "Services" section

9. **You should see:** `ledgerlm-app`

10. **Click:** `ledgerlm-app`

11. **You should see tags:**
    - latest
    - v1.0.0

✅ **Perfect! Your image is in Bosch Azure!**

---

### Step 2.3: Create Virtual Machine

⏱️ **Time:** 15 minutes  
☁️ **Where:** Azure Portal

**This creates the server that will run your application.**

#### Start Creating VM:

1. **At the TOP**, **click** in the search bar again

2. **Type:** `virtual machines`

3. **Click:** "Virtual machines" (computer icon)

4. **You'll see:** "Virtual machines" page

5. **At the top-left**, **click:** Blue **"+ Create"** button

6. **Click:** "Azure virtual machine" from dropdown

#### Fill in Basics Tab:

**You'll see a long form. Fill it in carefully:**

**Project details section:**

7. **Subscription:** 
   - **Click** the dropdown
   - **Select** your Bosch subscription (probably only one option)

8. **Resource group:**
   - **Click** "Create new" (below the dropdown)
   - **Type:** `ledgerlm-rg`
   - **Click:** "OK"

**Instance details section:**

9. **Virtual machine name:**
   - **Click** in the box
   - **Type:** `ledgerlm-vm`

10. **Region:**
    - **Click** dropdown
    - **Select** location closest to Bosch:
      - If in Europe: `(Europe) West Europe`
      - If in US: `(US) East US`
      - If in Asia: `(Asia Pacific) Southeast Asia`

11. **Availability options:**
    - **Keep:** "No infrastructure redundancy required"

12. **Security type:**
    - **Keep:** "Standard"

13. **Image:**
    - **Click** the dropdown (says "Select an image")
    - **Click** "See all images"
    - **In search box at top**, type: `ubuntu 22.04`
    - **Find:** "Ubuntu Server 22.04 LTS - x64 Gen2"
    - **Click** on it
    - **Click:** Blue "Select" button at bottom

14. **Size:**
    - **Click:** "See all sizes"
    - **In search box**, type: `D4s_v3`
    - **Find:** "Standard_D4s_v3" (4 vCPUs, 16 GB RAM)
    - **Click** the radio button next to it
    - **If you want GPU**, search for: `NC4as_T4_v3` instead
    - **Click:** Blue "Select" button at bottom

**Administrator account section:**

15. **Authentication type:**
    - **Click:** "SSH public key" (circle next to it)

16. **Username:**
    - **Keep:** `azureuser` (or type it if empty)

17. **SSH public key source:**
    - **Click** dropdown
    - **Select:** "Generate new key pair"

18. **Key pair name:**
    - **Type:** `ledgerlm-ssh-key`

**Inbound port rules section:**

19. **Public inbound ports:**
    - **Click:** "Allow selected ports" (circle next to it)

20. **Select inbound ports:**
    - **Click** the dropdown
    - **Check these boxes:**
      - ✅ HTTP (80)
      - ✅ HTTPS (443)
      - ✅ SSH (22)
    - **Click** outside dropdown to close it

#### Continue to Disks:

21. **At the BOTTOM**, **click:** Blue "Next: Disks >" button

**Disks page:**

22. **OS disk type:**
    - **Click** dropdown
    - **Select:** "Standard SSD"

23. **Click:** "Next: Networking >"

**Networking page:**

24. **Keep all defaults** (they look good)

25. **Click:** "Review + create" (blue button at bottom)

#### Create VM:

26. **You'll see:** "Validation passed" with green checkmark

27. **Review** the summary (verify name is ledgerlm-vm)

28. **Click:** Big blue "Create" button at bottom

**IMPORTANT POPUP:**

29. **A popup appears:** "Generate new key pair"
    - **Click:** "Download private key and create resource"

30. **A file downloads:** `ledgerlm-ssh-key.pem`
    - **SAVE THIS FILE!** You need it to connect!
    - **Move it to:** `C:\Users\YourName\Documents\LedgerLM\`

**Deployment starts:**

31. **You'll see:** "Deployment is in progress"
    - Blue spinning circle
    - Progress bar
    - **Wait 3-5 minutes**

32. **When done, you'll see:** "Your deployment is complete" ✅

33. **Click:** "Go to resource" button

#### Get VM IP Address:

34. **You're now on VM overview page**

35. **On the RIGHT side**, find: **"Public IP address"**

36. **Copy the IP** (looks like: 20.123.45.67)

37. **Write it down:** ________________

✅ **VM Created! Write down that IP address!**

---

### Step 2.4: Install PostgreSQL Database

⏱️ **Time:** 10 minutes  
☁️ **Where:** Azure Portal (or we'll install on VM later)

**Option 1: Create Azure PostgreSQL (Managed)**

1. **Search bar at top**, type: `azure database for postgresql`

2. **Click:** "Azure Database for PostgreSQL servers"

3. **Click:** "+ Create"

4. **Choose:** "Flexible server"

5. **Fill in:**
   - **Name:** `ledgerlm-db`
   - **Region:** Same as VM
   - **Version:** 16
   - **Compute + storage:** Click "Configure server"
     - **Select:** Burstable, B2s (2 vCPUs, 4GB RAM)
     - **Click:** "Save"

6. **Administrator username:** `ledgerlm`

7. **Password:** (create a strong password, WRITE IT DOWN!)

8. **Click:** "Review + create"

9. **Click:** "Create"

10. **Wait** 5-10 minutes for creation

**OR Option 2: Install on VM Later (Easier)**

We'll install PostgreSQL directly on the VM in the next section.  
**Choose this if you're not familiar with Azure.**

---

## 🔌 **PART 3: CONNECT TO VM AND SETUP**

**This section: You connect to the VM from your Matasma laptop.**

---

### Step 3.1: Install PuTTY (To Connect to VM)

⏱️ **Time:** 5 minutes  
🖥️ **Where:** Your Matasma laptop

**What is PuTTY?** It lets you connect to the Linux server.

#### Download PuTTY:

1. **Open** browser

2. **Go to:** https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html

3. **You'll see:** PuTTY download page

4. **Under "Package files"**, find: **"64-bit x86"**

5. **Click:** `putty-64bit-0.xx-installer.msi`

6. **File downloads** (3-5 MB)

#### Install PuTTY:

7. **Double-click** the downloaded installer

8. **Click:** "Next"

9. **Click:** "Next" (keep default location)

10. **Click:** "Install"

11. **Click:** "Finish"

✅ **PuTTY installed!**

---

### Step 3.2: Convert SSH Key for PuTTY

⏱️ **Time:** 2 minutes  
🖥️ **Where:** Your Matasma laptop

**Azure gives .pem file, but PuTTY needs .ppk file.**

1. **Open** Windows Start

2. **Type:** `PuTTYgen`

3. **Click:** "PuTTYgen"

4. **PuTTYgen window opens**

5. **Click:** "Load" button

6. **Bottom-right**, change dropdown from "PuTTY Private Key Files" to **"All Files (*.*)"**

7. **Navigate to:** `C:\Users\YourName\Documents\LedgerLM\`

8. **Select:** `ledgerlm-ssh-key.pem`

9. **Click:** "Open"

10. **Popup says:** "Successfully imported foreign key"

11. **Click:** "OK"

12. **Click:** "Save private key" button

13. **Popup asks:** "Are you sure you want to save without a passphrase?"

14. **Click:** "Yes"

15. **Save as:** `ledgerlm-ssh-key.ppk` (same folder)

16. **Click:** "Save"

17. **Close** PuTTYgen

✅ **Key converted!**

---

### Step 3.3: Connect to VM with PuTTY

⏱️ **Time:** 3 minutes  
🖥️ **Where:** Your Matasma laptop

1. **Open** Windows Start

2. **Type:** `PuTTY`

3. **Click:** "PuTTY"

**PuTTY Configuration window opens:**

4. **In "Host Name" box** (near top), **type:**
   ```
   azureuser@20.123.45.67
   ```
   - **Replace** `20.123.45.67` with YOUR VM IP!

5. **Port:** Keep as `22`

6. **Connection type:** Keep "SSH" selected

7. **On LEFT sidebar**, **click:** "Connection"
   - **Click the + next to it** to expand

8. **Click:** "SSH" (under Connection)
   - **Click the + next to it** to expand

9. **Click:** "Auth" (under SSH)
   - **Click the + next to it** to expand

10. **Click:** "Credentials" (under Auth)

11. **Find:** "Private key file for authentication"

12. **Click:** "Browse" button next to it

13. **Navigate to:** `C:\Users\YourName\Documents\LedgerLM\`

14. **Select:** `ledgerlm-ssh-key.ppk`

15. **Click:** "Open"

16. **On LEFT sidebar**, **click:** "Session" (back to top)

17. **In "Saved Sessions" box**, **type:** `LedgerLM-Bosch`

18. **Click:** "Save" button (to save these settings)

19. **Click:** "Open" button (at bottom)

**What happens:**

20. **Black window opens**

21. **First time:** "PuTTY Security Alert" appears
    - **Click:** "Accept"

22. **You should see:**
    ```
    Welcome to Ubuntu 22.04.x LTS
    ...
    azureuser@ledgerlm-vm:~$
    ```

✅ **You're connected to the VM!**

**This black window is the VM terminal. Keep it open!**

---

### Step 3.4: Install Docker on VM

⏱️ **Time:** 10 minutes  
☁️ **Where:** Inside PuTTY terminal (connected to Bosch VM)

**Now we'll install Docker on the VM.**

**In the PuTTY black window, copy and paste these commands one by one:**

**TIP:** To paste in PuTTY, just RIGHT-CLICK!

1. **Update system:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
   - **Type or paste this**
   - **Press Enter**
   - **Wait 2-5 minutes** (lots of text scrolls)

2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   ```
   - **Press Enter**

3. **Run installer:**
   ```bash
   sudo sh get-docker.sh
   ```
   - **Press Enter**
   - **Wait 2-3 minutes**

4. **Add yourself to docker group:**
   ```bash
   sudo usermod -aG docker $USER
   ```
   - **Press Enter**

5. **Install Docker Compose:**
   ```bash
   sudo apt install -y docker-compose
   ```
   - **Press Enter**
   - If asked "Do you want to continue? [Y/n]", **type:** `Y`
   - **Press Enter**

6. **Install Azure CLI on VM:**
   ```bash
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   ```
   - **Press Enter**
   - **Wait 3-5 minutes**

7. **Exit and reconnect** (for group changes to take effect):
   ```bash
   exit
   ```
   - **Press Enter**
   - **Window closes**

8. **Open PuTTY again** (from Windows Start)

9. **Click:** "LedgerLM-Bosch" in Saved Sessions

10. **Click:** "Load"

11. **Click:** "Open"

**You're reconnected!**

12. **Verify Docker works:**
    ```bash
    docker --version
    ```
    - **Press Enter**
    - Should show: `Docker version 24.x.x`

✅ **Docker is installed on VM!**

---

### Step 3.5: Install PostgreSQL on VM

⏱️ **Time:** 8 minutes  
☁️ **Where:** PuTTY terminal (Bosch VM)

**Install PostgreSQL with pgvector extension:**

1. **Add PostgreSQL repository:**
   ```bash
   sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
   ```
   - **Paste** (right-click)
   - **Press Enter**

2. **Add repository key:**
   ```bash
   wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
   ```
   - **Press Enter**

3. **Update package list:**
   ```bash
   sudo apt update
   ```
   - **Press Enter**

4. **Install PostgreSQL 16 and pgvector:**
   ```bash
   sudo apt install -y postgresql-16 postgresql-16-pgvector
   ```
   - **Press Enter**
   - **Wait 3-5 minutes**

5. **Start PostgreSQL:**
   ```bash
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```
   - **Press Enter** after each

6. **Create database:**
   ```bash
   sudo -u postgres psql
   ```
   - **Press Enter**
   - **Prompt changes to:** `postgres=#`

7. **Create database and user** (paste these one by one):
   ```sql
   CREATE DATABASE ledgerlm;
   ```
   - **Press Enter**
   - Should say: `CREATE DATABASE`

8. **Create user** (CHANGE THE PASSWORD!):
   ```sql
   CREATE USER ledgerlm_app WITH PASSWORD 'ChangeThisPassword123!';
   ```
   - **Replace** `ChangeThisPassword123!` with a strong password
   - **WRITE DOWN THIS PASSWORD!** ________________
   - **Press Enter**

9. **Grant permissions:**
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE ledgerlm TO ledgerlm_app;
   ```
   - **Press Enter**

10. **Connect to database:**
    ```sql
    \c ledgerlm
    ```
    - **Press Enter**
    - Should say: `You are now connected to database "ledgerlm"`

11. **Enable pgvector:**
    ```sql
    CREATE EXTENSION vector;
    ```
    - **Press Enter**

12. **Grant schema permissions:**
    ```sql
    GRANT ALL ON SCHEMA public TO ledgerlm_app;
    ```
    - **Press Enter**

13. **Exit PostgreSQL:**
    ```sql
    \q
    ```
    - **Press Enter**
    - **Back to:** `azureuser@ledgerlm-vm:~$`

✅ **PostgreSQL database created!**

---

### Step 3.6: Login to ACR from VM

⏱️ **Time:** 2 minutes  
☁️ **Where:** PuTTY terminal (Bosch VM)

**Now VM needs to access the Docker image you uploaded.**

1. **Login to Azure:**
   ```bash
   az login
   ```
   - **Press Enter**

2. **You'll see:** A long URL and code
   ```
   To sign in, use a web browser to open the page https://microsoft.com/devicelogin
   and enter the code ABC12DEF3 to authenticate.
   ```

3. **Copy the code** (ABC12DEF3 or similar)

4. **On your Matasma laptop**, **open browser**

5. **Go to:** https://microsoft.com/devicelogin

6. **Paste the code**

7. **Click:** "Next"

8. **Login** with Bosch Azure credentials

9. **Click:** "Continue"

10. **Close browser** when it says "You have signed in"

11. **Back in PuTTY**, after a few seconds:
    ```
    You have logged in.
    ```

12. **Login to ACR:**
    ```bash
    az acr login --name boschledgerlm
    ```
    - **Replace** `boschledgerlm` with YOUR ACR name
    - **Press Enter**

**Should say:** `Login Succeeded`

✅ **VM can now access your Docker images!**

---

### Step 3.7: Create docker-compose.yml on VM

⏱️ **Time:** 5 minutes  
☁️ **Where:** PuTTY terminal (Bosch VM)

**Create configuration file for running the app:**

1. **Create directory:**
   ```bash
   mkdir ~/ledgerlm
   cd ~/ledgerlm
   ```
   - **Press Enter** after each

2. **Create docker-compose.yml file:**
   ```bash
   nano docker-compose.yml
   ```
   - **Press Enter**
   - **Text editor opens** (nano)

3. **Copy this ENTIRE text** (replace boschledgerlm with YOUR ACR name):

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
      DATABASE_URL: postgresql://ledgerlm_app:${DB_PASSWORD}@localhost:5432/ledgerlm
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

4. **In PuTTY window, right-click to paste**

5. **Save the file:**
   - **Press:** `Ctrl + X`
   - **Press:** `Y`
   - **Press:** `Enter`

✅ **docker-compose.yml created!**

---

### Step 3.8: Create .env File with Secrets

⏱️ **Time:** 5 minutes  
☁️ **Where:** PuTTY terminal (Bosch VM)

**Create file with all your API keys and passwords:**

1. **Create .env file:**
   ```bash
   nano .env
   ```
   - **Press Enter**

2. **Copy this template** and **fill in YOUR actual values**:

```env
DB_PASSWORD=YourPostgreSQLPassword
OPENAI_API_KEY=sk-proj-your-openai-key
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=your-email-password
SMTP_FROM=ledgerlm@bosch.com
SESSION_SECRET=CreateRandomString32CharactersLong
ANAPLAN_WORKSPACE_ID=your-workspace-id
ANAPLAN_MODEL_ID=your-model-id
ANAPLAN_PROCESS_ID=your-process-id
ANAPLAN_USERNAME=your-anaplan-username
ANAPLAN_PASSWORD=your-anaplan-password
```

3. **Right-click to paste** (after filling in your values)

4. **Save:**
   - **Press:** `Ctrl + X`
   - **Press:** `Y`
   - **Press:** `Enter`

✅ **.env file created!**

---

### Step 3.9: Pull Docker Image and Start Application

⏱️ **Time:** 10 minutes  
☁️ **Where:** PuTTY terminal (Bosch VM)

**Pull the image you uploaded earlier:**

1. **Pull image from ACR:**
   ```bash
   docker-compose pull
   ```
   - **Press Enter**
   - **Wait 5-10 minutes** (downloading image)

**You should see:**
```
Pulling app ... done
```

2. **Start the application:**
   ```bash
   docker-compose up -d
   ```
   - **Press Enter**

**You should see:**
```
Creating ledgerlm-app ... done
```

3. **Check if running:**
   ```bash
   docker-compose ps
   ```
   - **Press Enter**

**You should see:**
```
Name              State    Ports
ledgerlm-app      Up       0.0.0.0:80->80/tcp
```

✅ **Application is running!**

---

### Step 3.10: Test the Application

⏱️ **Time:** 2 minutes  
🖥️ **Where:** Your Matasma laptop, web browser

1. **Open** web browser

2. **Go to:** `http://YOUR-VM-IP`
   - Replace YOUR-VM-IP with the IP you wrote down
   - Example: `http://20.123.45.67`

**What you should see:**
- **LedgerLM Login Page!** 🎉

✅ **SUCCESS! Application is live!**

---

## 🔒 **PART 4: VERIFY SOURCE CODE IS PROTECTED**

⏱️ **Time:** 2 minutes  
☁️ **Where:** PuTTY terminal (Bosch VM)

**Let's verify Bosch can't see your source code:**

1. **In PuTTY, type:**
   ```bash
   docker exec -it ledgerlm-app ls -la /app
   ```
   - **Press Enter**

**What you see:**
```
dist/           (compiled JavaScript)
node_modules/   (dependencies)
uploads/        (user uploads)
```

**What you DON'T see:**
```
client/src/     (source code) ❌
server/*.ts     (TypeScript files) ❌
```

2. **Try to find TypeScript files:**
   ```bash
   docker exec -it ledgerlm-app find /app -name "*.ts" | head -20
   ```
   - **Press Enter**

**Should find NO .ts files** (or only type definition files)

✅ **Source code is protected!**

**Bosch Azure VM only has:**
- ✅ Compiled JavaScript (minified)
- ✅ Docker container
- ❌ NO TypeScript source code
- ❌ NO way to see original code

---

## 🔄 **PART 5: HOW TO UPDATE THE APPLICATION**

**When you make code changes, here's how to update:**

### On Your Matasma Laptop:

⏱️ **Time:** 20 minutes  
🖥️ **Where:** Your Matasma laptop

1. **Make your code changes**
2. **Save all files**

3. **Open Command Prompt**

4. **Navigate to project:**
   ```
   cd C:\path\to\LedgerLM
   ```

5. **Build new image:**
   ```
   docker build -t ledgerlm-app:latest .
   ```
   - **Wait 10-15 minutes**

6. **Tag with new version:**
   ```
   docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1
   docker tag ledgerlm-app:latest boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```

7. **Push to ACR:**
   ```
   docker push boschledgerlm.azurecr.io/ledgerlm-app:v1.0.1
   docker push boschledgerlm.azurecr.io/ledgerlm-app:latest
   ```
   - **Wait 10-15 minutes**

### On Bosch VM:

⏱️ **Time:** 5 minutes  
☁️ **Where:** PuTTY terminal

1. **Connect with PuTTY**

2. **Navigate to folder:**
   ```bash
   cd ~/ledgerlm
   ```

3. **Pull new image:**
   ```bash
   docker-compose pull
   ```

4. **Restart application:**
   ```bash
   docker-compose up -d
   ```

✅ **New version is live!**

---

## 🆘 **TROUBLESHOOTING**

### Problem: Can't connect with PuTTY

**Error:** "Connection refused"

**Solutions:**
1. **Check VM is running:**
   - Go to: https://portal.azure.com
   - Search: "virtual machines"
   - Click your VM
   - Status should say "Running"
   - If "Stopped", click "Start" button

2. **Check IP address is correct**
   - In Azure Portal, verify Public IP

3. **Check firewall:**
   - Azure Portal → Your VM → Networking
   - Make sure port 22 is allowed

### Problem: docker-compose pull fails

**Error:** "unauthorized" or "access denied"

**Solution:**
```bash
az acr login --name boschledgerlm
docker-compose pull
```

### Problem: Application won't start

**Check logs:**
```bash
docker-compose logs -f app
```

**Common issues:**
1. **Database password wrong:** Check .env file
2. **Missing env variable:** Check all values in .env
3. **Port in use:** Restart VM

### Problem: Website shows 502 Bad Gateway

**Means app isn't running. Check:**
```bash
docker-compose ps
```

**Should say "Up". If not:**
```bash
docker-compose logs app
docker-compose restart
```

---

## ✅ **FINAL CHECKLIST**

### On Matasma Laptop:
- [ ] Docker Desktop installed and running
- [ ] Azure CLI installed
- [ ] Code built into Docker image
- [ ] Image pushed to Bosch ACR
- [ ] Can see image in Azure Portal → Container Registries

### On Bosch Azure:
- [ ] VM created and running
- [ ] Can connect with PuTTY
- [ ] Docker installed on VM
- [ ] PostgreSQL database created
- [ ] docker-compose.yml created
- [ ] .env file with all secrets created
- [ ] Image pulled from ACR
- [ ] Application running (docker-compose ps shows "Up")

### Testing:
- [ ] Can access http://VM-IP in browser
- [ ] See LedgerLM login page
- [ ] Source code verified NOT on VM

### For Bosch Employees:
- [ ] Setup domain name (ledgerlm.bosch.com)
- [ ] Setup SSL certificate (HTTPS)
- [ ] Tell employees the URL
- [ ] They can access and login

---

## 📞 **WHO DOES WHAT**

### You (Matasma):
- ✅ Build Docker images on YOUR laptop
- ✅ Push to Bosch ACR
- ✅ Help with setup (via screen share if needed)
- ✅ Provide .env template
- ✅ Build updates when needed

### Bosch IT:
- ✅ Provide Azure credentials
- ✅ Provide ACR access
- ✅ Create/maintain VM
- ✅ Setup domain name
- ✅ Setup SSL certificate

### Bosch Employees:
- ✅ Use the application via browser
- ✅ No technical work

---

## 🎉 **YOU'RE DONE!**

**Summary of what you did:**

1. ✅ **Matasma Laptop:** Built Docker image (source code compiled)
2. ✅ **Pushed to ACR:** Only compiled image uploaded (NO source code)
3. ✅ **Bosch VM:** Pulled and ran image
4. ✅ **Verified:** Bosch can't access source code
5. ✅ **Tested:** Application works!

**Source code locations:**
- ✅ **Your Matasma laptop:** YES (safe!)
- ❌ **Bosch ACR:** NO (only compiled images)
- ❌ **Bosch VM:** NO (only compiled images)
- ❌ **Bosch employees:** NO (only web interface)

**Application is live at:**  
`http://YOUR-VM-IP`

**Next step:** Setup HTTPS and domain name with Bosch IT!

---

**END OF GUIDE** 🎊

*Version 1.0 - Ultra-Detailed for Non-Technical Users*  
*Last Updated: November 2025*
