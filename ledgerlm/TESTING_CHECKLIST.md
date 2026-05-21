# ✅ LedgerLM - Simple Testing Checklist

Use this checklist to verify all features are working on your system.

---

## 🔐 Authentication (2 minutes)

- [ ] 1. Open `http://localhost:5000` in your browser
- [ ] 2. Enter your email address (e.g., `test@example.com`)
- [ ] 3. Click "Get Started"
- [ ] 4. You should be redirected to Dashboard
- [ ] 5. Your name should appear in the top-right corner

**✅ Expected:** Auto-login works, no password needed

---

## 💬 Chat System (3 minutes)

- [ ] 1. Click "+ New Chat" button on Dashboard
- [ ] 2. Type a message like "What can you help me with?"
- [ ] 3. Click Send or press Enter
- [ ] 4. Wait for AI response (should appear within 5-10 seconds)
- [ ] 5. Check that response makes sense

**✅ Expected:** AI responds with helpful information

---

## 📄 Document Upload (5 minutes)

### Test 1: Upload a PDF or Excel file

- [ ] 1. Click "Vault" in the sidebar
- [ ] 2. Click "Upload Documents" button
- [ ] 3. Select a PDF, Excel, or Word file from your computer
- [ ] 4. Click "Upload"
- [ ] 5. File should appear in the list
- [ ] 6. Check that file name, size, and type are correct

**✅ Expected:** File uploads successfully

### Test 2: Process a document

- [ ] 1. Click the "Process" button (or similar) on the uploaded document
- [ ] 2. Wait 10-30 seconds (depending on file size)
- [ ] 3. Status should change to "Processed" or "Complete"

**✅ Expected:** Document is analyzed and ready for AI queries

### Test 3: Ask question about document

- [ ] 1. Go back to Dashboard (or create new chat)
- [ ] 2. Type: "What's in the document I just uploaded?"
- [ ] 3. Send the message
- [ ] 4. AI should respond with information from your document

**✅ Expected:** AI reads and understands your document

---

## 🌐 Cloud Import (3 minutes)

### If you have a Google Drive/OneDrive public link:

- [ ] 1. Go to Vault
- [ ] 2. Click "Import from Cloud"
- [ ] 3. Select cloud provider (Google Drive, OneDrive, or Dropbox)
- [ ] 4. Paste a public/shared link to a document
- [ ] 5. Click "Import"
- [ ] 6. Document should appear in your vault

**✅ Expected:** Document imported from cloud successfully

**Note:** Link must be a direct download link or public sharing link

---

## 🎯 Boards (2 minutes)

- [ ] 1. Click "Boards" in sidebar
- [ ] 2. Click "New Board" or "Create Board"
- [ ] 3. Enter title: "Test Board"
- [ ] 4. Enter description: "Testing board creation"
- [ ] 5. Click "Create"
- [ ] 6. Board should appear in the list

**✅ Expected:** Board created successfully

---

## 🏢 Enterprise System (Admin Only) (5 minutes)

**Note:** You need admin role to test this

- [ ] 1. Click "Admin" in sidebar (or navigate to `/admin/enterprise`)
- [ ] 2. You should see "Enterprise Document Management"
- [ ] 3. Click "Upload Documents"
- [ ] 4. Select 1-3 financial documents (can be same as before)
- [ ] 5. Click "Upload"
- [ ] 6. Documents should appear in enterprise list
- [ ] 7. Click "Process" on each document
- [ ] 8. Wait for processing to complete

**✅ Expected:** Enterprise documents uploaded and processed

### Test Enterprise Query:

- [ ] 1. Go to Dashboard → Create new chat
- [ ] 2. Open "Data Sources" panel (if available)
- [ ] 3. Enable "Include Enterprise Data" toggle
- [ ] 4. Ask: "What financial data is available?"
- [ ] 5. AI should respond with info from enterprise documents
- [ ] 6. Look for `[Enterprise]` tags in the response

**✅ Expected:** AI accesses both personal and enterprise documents

---

## 🔍 Multi-Source Intelligence (5 minutes)

### Test 1: Google Search Integration

- [ ] 1. Create new chat
- [ ] 2. Open "Data Sources" panel
- [ ] 3. Enable "Google Search" (if not already enabled)
- [ ] 4. Ask: "What is the current price of gold?"
- [ ] 5. AI should provide current information from the web

**✅ Expected:** AI uses Google to answer real-time questions

### Test 2: Combined Sources

- [ ] 1. Make sure you have:
     - At least 1 processed document
     - Google Search enabled
- [ ] 2. Ask: "Based on my documents and current market data, what should I know?"
- [ ] 3. AI should combine information from both sources

**✅ Expected:** AI merges document data with web search results

---

## 🎨 User Interface (2 minutes)

### Check Theme:

- [ ] 1. Look for theme toggle (sun/moon icon)
- [ ] 2. Click to switch between light and dark mode
- [ ] 3. Both modes should look good
- [ ] 4. Theme should persist after page reload

**✅ Expected:** Both themes work and look professional

### Check Sidebar:

- [ ] 1. Click sidebar toggle (hamburger menu)
- [ ] 2. Sidebar should collapse/expand
- [ ] 3. All menu items should be visible
- [ ] 4. Navigation should work

**✅ Expected:** Smooth navigation experience

---

## 🔧 Backend Health (1 minute)

### Test in Browser:

1. **Node.js Backend:**
   - [ ] Open: `http://localhost:5000`
   - [ ] You should see the app interface

2. **Python Backend:**
   - [ ] Open: `http://localhost:8000/health`
   - [ ] You should see:
     ```json
     {
       "status": "healthy",
       "database": "connected",
       "openai": "configured"
     }
     ```

**✅ Expected:** Both backends responding

---

## 📊 Quick Test Results

After completing all tests, fill this out:

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ⬜ Pass / ⬜ Fail | |
| Chat System | ⬜ Pass / ⬜ Fail | |
| Document Upload | ⬜ Pass / ⬜ Fail | |
| Document Processing | ⬜ Pass / ⬜ Fail | |
| Cloud Import | ⬜ Pass / ⬜ Fail | |
| Boards | ⬜ Pass / ⬜ Fail | |
| Enterprise Upload | ⬜ Pass / ⬜ Fail | |
| Enterprise Query | ⬜ Pass / ⬜ Fail | |
| Google Search | ⬜ Pass / ⬜ Fail | |
| Theme Toggle | ⬜ Pass / ⬜ Fail | |

---

## 🐛 If Something Doesn't Work

### Backend Not Running:

```bash
# Check if services are running
# In VS Code terminal:
npm run dev
```

### Database Connection Error:

```bash
# Test database connection
psql -U postgres -d revamp_LedgerLM_1
```

### Python Backend Error:

```bash
# Restart Python backend
cd python_backend
python -m uvicorn main:app --reload --port 8000
```

### Document Processing Stuck:

1. Check Python backend is running
2. Check file is uploaded to `local/uploads/` folder
3. Check Python backend logs for errors

---

## ✅ Success Criteria

**All tests pass if:**

- ✅ You can sign in
- ✅ You can chat with AI
- ✅ You can upload and process documents
- ✅ AI can answer questions about your documents
- ✅ You can create boards
- ✅ Enterprise system works (if admin)
- ✅ Google Search integration works
- ✅ Theme switching works
- ✅ Both backends are healthy

---

## 🎉 All Done!

If all tests pass, your app is **100% working**!

You're ready to deploy to your Linux server. 🚀

---

*Estimated total testing time: 20-30 minutes*
