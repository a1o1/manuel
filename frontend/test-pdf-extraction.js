#!/usr/bin/env node

/**
 * Test script for PDF page extraction API
 * This script demonstrates how to authenticate and test the PDF page extraction endpoint
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

// Configuration - update these with your actual values
const CONFIG = {
  API_BASE_URL: 'https://your-api-gateway-url.execute-api.eu-west-1.amazonaws.com/dev',
  PDF_PAGE_ENDPOINT: '/api/pdf-page',
  
  // Test data
  TEST_PDF_URL: 'https://example.com/your-test-manual.pdf',
  TEST_PAGE_NUMBER: 1,
  TEST_HIGHLIGHT_TEXT: 'configuration',
  TEST_HIGHLIGHT_COLOR: 'yellow',
  
  // Auth token (get this from your CLI or app)
  AUTH_TOKEN: 'your-jwt-token-here'
};

/**
 * Get authentication token from CLI storage
 * This reads the same token storage that the CLI uses
 */
async function getAuthTokenFromCLI() {
  try {
    const os = require('os');
    const configPath = path.join(os.homedir(), '.manuel', 'config.json');
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.tokens?.idToken;
    }
    
    console.warn('❌ No CLI config found. Please login with: npm run cli auth login');
    return null;
  } catch (error) {
    console.error('❌ Error reading CLI config:', error.message);
    return null;
  }
}

/**
 * Get authentication token from iOS app storage (if running on device)
 * This is mainly for reference - you'd need to extract this from device storage
 */
function getAuthTokenFromApp() {
  // This would require accessing React Native AsyncStorage
  // For testing purposes, you can extract the token from the app logs
  console.log('ℹ️  To get iOS app token, check app logs for "Retrieved auth token"');
  return null;
}

/**
 * Make authenticated HTTP request
 */
function makeAuthenticatedRequest(url, options, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + (urlObj.search || ''),
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Test the PDF page extraction API
 */
async function testPdfPageExtraction() {
  console.log('🔍 Testing PDF Page Extraction API\n');
  
  // Step 1: Get authentication token
  console.log('1. Getting authentication token...');
  let token = await getAuthTokenFromCLI();
  
  if (!token) {
    token = CONFIG.AUTH_TOKEN;
    if (!token || token === 'your-jwt-token-here') {
      console.error('❌ No authentication token found!');
      console.log('\nTo get a token:');
      console.log('• CLI: Run "npm run cli auth login" then check ~/.manuel/config.json');
      console.log('• iOS App: Check app logs for "Retrieved auth token"');
      console.log('• Manual: Copy token from browser dev tools or app logs');
      return;
    }
  }
  
  console.log('✅ Token found:', token ? `${token.substring(0, 20)}...` : 'null');
  
  // Step 2: Prepare request payload
  console.log('\n2. Preparing request payload...');
  const requestPayload = {
    pdf_url: CONFIG.TEST_PDF_URL,
    page_number: CONFIG.TEST_PAGE_NUMBER,
    highlight_text: CONFIG.TEST_HIGHLIGHT_TEXT,
    highlight_color: CONFIG.TEST_HIGHLIGHT_COLOR
  };
  
  console.log('📋 Request payload:', JSON.stringify(requestPayload, null, 2));
  
  // Step 3: Make API request
  console.log('\n3. Making API request...');
  const url = `${CONFIG.API_BASE_URL}${CONFIG.PDF_PAGE_ENDPOINT}`;
  console.log('🔗 URL:', url);
  
  try {
    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: requestPayload
    }, token);
    
    console.log('\n4. Response received:');
    console.log('📊 Status:', response.status);
    console.log('📋 Headers:', JSON.stringify(response.headers, null, 2));
    console.log('📄 Response data:', JSON.stringify(response.data, null, 2));
    
    // Step 4: Analyze response
    console.log('\n5. Analysis:');
    
    if (response.status === 200) {
      console.log('✅ Success! PDF page extraction worked.');
      
      if (response.data.page_image_url) {
        console.log('🖼️  Page image URL:', response.data.page_image_url);
        console.log('📄 Page number:', response.data.page_number);
        console.log('🔍 Highlight text:', response.data.highlight_text);
        console.log('🎨 Highlight color:', response.data.highlight_color);
        console.log('💾 Cached:', response.data.cached);
        console.log('⏱️  Processing time:', response.data.processing_time_ms + 'ms');
        
        // Check if it's a data URL (base64) or S3 URL
        if (response.data.page_image_url.startsWith('data:image/')) {
          console.log('📊 Image type: Base64 data URL (fallback mode)');
        } else if (response.data.page_image_url.includes('amazonaws.com')) {
          console.log('📊 Image type: S3 signed URL (normal mode)');
        } else {
          console.log('📊 Image type: Unknown');
        }
      } else {
        console.log('❌ No page image URL in response');
      }
    } else if (response.status === 401) {
      console.log('❌ Authentication failed - token may be expired');
      console.log('💡 Try logging in again: npm run cli auth login');
    } else if (response.status === 429) {
      console.log('❌ Rate limit exceeded - wait before retrying');
    } else {
      console.log('❌ Request failed with status:', response.status);
      console.log('💡 Check your API endpoint URL and request payload');
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.log('💡 Check your network connection and API endpoint');
  }
}

/**
 * Test authentication setup
 */
async function testAuthentication() {
  console.log('🔐 Testing Authentication Setup\n');
  
  const token = await getAuthTokenFromCLI();
  
  if (token) {
    console.log('✅ CLI token found');
    
    // Try to decode JWT to check expiration
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const expiration = new Date(payload.exp * 1000);
      const now = new Date();
      
      console.log('⏰ Token expires:', expiration.toISOString());
      console.log('⏰ Current time:', now.toISOString());
      console.log('✅ Token valid:', expiration > now);
    } catch (error) {
      console.log('❌ Could not decode token:', error.message);
    }
  } else {
    console.log('❌ No CLI token found');
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🧪 PDF Page Extraction API Test Tool\n');
  console.log('This tool helps you test the PDF page extraction endpoint.');
  console.log('Make sure you have:\n');
  console.log('• Valid authentication token (login with CLI or app)');
  console.log('• Correct API endpoint URL');
  console.log('• Test PDF URL accessible to the backend\n');
  
  const args = process.argv.slice(2);
  
  if (args.includes('--auth')) {
    await testAuthentication();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage:');
    console.log('  node test-pdf-extraction.js         # Run full test');
    console.log('  node test-pdf-extraction.js --auth  # Test authentication only');
    console.log('  node test-pdf-extraction.js --help  # Show this help');
    console.log('');
    console.log('Configuration:');
    console.log('  Edit CONFIG object in this file to set your API endpoint and test data');
  } else {
    await testPdfPageExtraction();
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testPdfPageExtraction,
  testAuthentication,
  getAuthTokenFromCLI,
  makeAuthenticatedRequest
};