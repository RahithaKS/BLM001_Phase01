/**
 * End-to-end test script for LedgerLM
 * Tests authentication, document upload, processing, and RAG chat
 */

const API_URL = 'http://localhost:5000';
const PYTHON_API_URL = 'http://localhost:8000';

// Helper to make authenticated requests
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return response;
}

// Test 1: Authentication
async function testAuthentication() {
  console.log('\n📝 Testing Authentication...');
  
  try {
    // Sign in with test user (passwordless email-based signin)
    const response = await apiRequest('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test-e2e@ledgerlm.com',
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Authentication successful:', data.user.username);
      return data.user.id;
    } else {
      const error = await response.text();
      console.error('❌ Authentication failed:', response.status, error);
      return null;
    }
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    return null;
  }
}

// Test 2: Create Chat
async function testCreateChat(userId) {
  console.log('\n💬 Testing Chat Creation...');
  
  try {
    const response = await apiRequest('/api/chats', {
      method: 'POST',
      headers: {
        'x-user-id': userId,
      },
      body: JSON.stringify({
        title: 'E2E Test Chat',
      }),
    });
    
    if (response.ok) {
      const chat = await response.json();
      console.log('✅ Chat created:', chat.id);
      return chat.id;
    } else {
      console.error('❌ Chat creation failed:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Chat creation error:', error.message);
    return null;
  }
}

// Test 3: Upload Test Document
async function testDocumentUpload(userId) {
  console.log('\n📄 Testing Document Upload...');
  
  try {
    // Create a test CSV file
    const fs = await import('fs');
    const path = await import('path');
    
    const testData = `Company,Revenue,Expenses,Profit
Acme Corp,1000000,750000,250000
Tech Solutions,500000,400000,100000
Global Trade,2000000,1800000,200000`;
    
    const testFilePath = '/tmp/test-financial-data.csv';
    fs.writeFileSync(testFilePath, testData);
    
    // Upload document
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    
    const response = await fetch(`${API_URL}/api/documents`, {
      method: 'POST',
      headers: {
        'x-user-id': userId,
        ...form.getHeaders(),
      },
      body: form,
    });
    
    if (response.ok) {
      const document = await response.json();
      console.log('✅ Document uploaded:', document.name);
      return document.id;
    } else {
      console.error('❌ Document upload failed:', response.status);
      const error = await response.text();
      console.error('Error:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Document upload error:', error.message);
    return null;
  }
}

// Test 4: Check Document Processing Status
async function testDocumentProcessing(documentId) {
  console.log('\n⚙️  Testing Document Processing...');
  
  try {
    // Wait a bit for processing to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const response = await fetch(`${PYTHON_API_URL}/api/v2/documents/${documentId}/status`);
    
    if (response.ok) {
      const status = await response.json();
      console.log('✅ Processing status:', status.status);
      console.log('   Total chunks:', status.total_chunks || 0);
      console.log('   Processed chunks:', status.processed_chunks || 0);
      return status;
    } else {
      console.error('❌ Status check failed:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Processing status error:', error.message);
    return null;
  }
}

// Test 5: Attach Document to Chat
async function testAttachDocument(userId, chatId, documentId) {
  console.log('\n🔗 Testing Document Attachment to Chat...');
  
  try {
    const response = await apiRequest(`/api/chats/${chatId}/documents`, {
      method: 'POST',
      headers: {
        'x-user-id': userId,
      },
      body: JSON.stringify({
        documentId: documentId,
      }),
    });
    
    if (response.ok) {
      console.log('✅ Document attached to chat');
      return true;
    } else {
      console.error('❌ Document attachment failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Document attachment error:', error.message);
    return false;
  }
}

// Test 6: RAG Query Endpoint
async function testRAGQuery(documentId) {
  console.log('\n🔍 Testing RAG Query Endpoint...');
  
  try {
    const response = await fetch(`${PYTHON_API_URL}/api/v2/rag/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'What is the total revenue?',
        document_ids: [documentId],
        top_k: 5,
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ RAG query successful');
      console.log('   Found chunks:', result.found_chunks || 0);
      console.log('   Context length:', result.context?.length || 0, 'chars');
      return result;
    } else {
      console.error('❌ RAG query failed:', response.status);
      const error = await response.text();
      console.error('Error:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ RAG query error:', error.message);
    return null;
  }
}

// Test 7: Chat with Document Context
async function testChatWithRAG(userId, chatId) {
  console.log('\n🤖 Testing AI Chat with RAG...');
  
  try {
    const response = await apiRequest(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'x-user-id': userId,
      },
      body: JSON.stringify({
        content: 'What companies are in the uploaded document and what are their revenues?',
        role: 'user',
      }),
    });
    
    if (response.ok) {
      const messages = await response.json();
      console.log('✅ Chat message sent and AI responded');
      console.log('   User message:', messages[0]?.content.substring(0, 50) + '...');
      console.log('   AI response:', messages[1]?.content.substring(0, 100) + '...');
      return messages;
    } else {
      console.error('❌ Chat failed:', response.status);
      const error = await response.text();
      console.error('Error:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Chat error:', error.message);
    return null;
  }
}

// Test 8: Regular Chat without Documents
async function testRegularChat(userId, chatId) {
  console.log('\n💭 Testing Regular AI Chat (no documents)...');
  
  try {
    const response = await apiRequest(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'x-user-id': userId,
      },
      body: JSON.stringify({
        content: 'What is financial analysis?',
        role: 'user',
      }),
    });
    
    if (response.ok) {
      const messages = await response.json();
      console.log('✅ Regular chat successful');
      console.log('   AI response:', messages[1]?.content.substring(0, 100) + '...');
      return messages;
    } else {
      console.error('❌ Regular chat failed:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Regular chat error:', error.message);
    return null;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting End-to-End Tests for LedgerLM\n');
  console.log('=' .repeat(50));
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Authentication
  const userId = await testAuthentication();
  if (userId) passed++; else failed++;
  
  if (!userId) {
    console.log('\n❌ Cannot continue without authentication');
    return;
  }
  
  // Test 2: Create Chat
  const chatId = await testCreateChat(userId);
  if (chatId) passed++; else failed++;
  
  // Test 3: Upload Document
  const documentId = await testDocumentUpload(userId);
  if (documentId) passed++; else failed++;
  
  if (documentId) {
    // Test 4: Check Processing
    const status = await testDocumentProcessing(documentId);
    if (status) passed++; else failed++;
    
    // Test 5: Attach to Chat
    if (chatId) {
      const attached = await testAttachDocument(userId, chatId, documentId);
      if (attached) passed++; else failed++;
      
      // Wait for processing to complete
      console.log('\n⏳ Waiting for document processing to complete...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test 6: RAG Query
      const ragResult = await testRAGQuery(documentId);
      if (ragResult && ragResult.found_chunks > 0) passed++; else failed++;
      
      // Test 7: Chat with RAG
      const ragChat = await testChatWithRAG(userId, chatId);
      if (ragChat) passed++; else failed++;
    }
  }
  
  // Test 8: Create new chat for regular test
  const chatId2 = await testCreateChat(userId);
  if (chatId2) {
    const regularChat = await testRegularChat(userId, chatId2);
    if (regularChat) passed++; else failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('='.repeat(50));
}

// Run tests
runTests().catch(console.error);
