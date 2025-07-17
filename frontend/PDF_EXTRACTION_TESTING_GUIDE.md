# PDF Page Extraction Testing Guide

This guide explains how to test the PDF page extraction functionality in the Manuel application, including authentication and API testing.

## Overview

The PDF page extraction system allows users to extract specific pages from PDF manuals with text highlighting. The system:

1. Takes a PDF URL, page number, and optional highlight text
2. Extracts the specified page using PyMuPDF
3. Highlights the specified text (if provided)
4. Returns either an S3 signed URL or a base64 image
5. Caches processed pages for performance

## API Endpoint

**Endpoint:** `POST /api/pdf-page`

**Request Body:**
```json
{
  "pdf_url": "https://example.com/manual.pdf",
  "page_number": 1,
  "highlight_text": "configuration",
  "highlight_color": "yellow"
}
```

**Response:**
```json
{
  "page_image_url": "https://s3.amazonaws.com/...",
  "page_number": 1,
  "highlight_text": "configuration",
  "highlight_color": "yellow",
  "cached": false,
  "processing_time_ms": 1250
}
```

## Authentication Requirements

The PDF extraction endpoint requires authentication. You need a valid JWT token from either:

1. **CLI Authentication:** Login with `npm run cli auth login`
2. **iOS App:** Extract token from app logs or AsyncStorage
3. **Manual Token:** Get from browser dev tools or direct API calls

## Testing Methods

### 1. iOS App Testing

The iOS app has built-in PDF extraction testing through the query interface:

**Location:** `frontend/packages/ios-app/src/components/EnhancedSourceCard.tsx`

**How to test:**
1. Open the iOS app
2. Go to the Query screen
3. Ask a question about your manuals
4. In the results, tap on a source card
5. Select "View Page X (Highlighted)"
6. The app will call the PDF extraction API

**Code Example:**
```typescript
// From EnhancedSourceCard.tsx
const response = await pdfService.extractPage({
  pdf_url: pdfUrl,
  page_number: pageNumber,
  highlight_text: highlightText,
  highlight_color: 'yellow'
});
```

### 2. Node.js Test Script

I've created a comprehensive test script: `test-pdf-extraction.js`

**Usage:**
```bash
# Run full test
node test-pdf-extraction.js

# Test authentication only
node test-pdf-extraction.js --auth

# Show help
node test-pdf-extraction.js --help
```

**Features:**
- Automatic CLI token detection
- JWT token validation
- Full API request/response logging
- Error handling and debugging tips

### 3. CLI Testing (No Direct Command)

Currently, there's no direct CLI command for PDF extraction testing, but you can:

1. Use the Node.js test script above
2. Check CLI authentication: `npm run cli auth status`
3. List manuals to get PDF URLs: `npm run cli manuals list`

### 4. Manual API Testing

You can test the API directly using curl or any HTTP client:

```bash
# Get your auth token first
TOKEN=$(cat ~/.manuel/config.json | jq -r '.tokens.idToken')

# Test the endpoint
curl -X POST "https://your-api-gateway-url/api/pdf-page" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "pdf_url": "https://example.com/manual.pdf",
    "page_number": 1,
    "highlight_text": "configuration",
    "highlight_color": "yellow"
  }'
```

## Authentication Flow

### CLI Authentication
1. Login: `npm run cli auth login`
2. Token stored in: `~/.manuel/config.json`
3. Token includes: `idToken`, `accessToken`, `refreshToken`

### iOS App Authentication
1. Token stored in: AsyncStorage `@manuel/auth_tokens`
2. Format: `{ idToken, accessToken, refreshToken, expiresAt }`
3. Auto-refresh on 401 errors

### Authentication Code Examples

**CLI Token Retrieval:**
```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');

function getCliToken() {
  const configPath = path.join(os.homedir(), '.manuel', 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.tokens?.idToken;
  }
  return null;
}
```

**iOS App Token Retrieval:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

async function getAppToken(): Promise<string | null> {
  const authData = await AsyncStorage.getItem('@manuel/auth_tokens');
  if (authData) {
    const tokens = JSON.parse(authData);
    return tokens.idToken;
  }
  return null;
}
```

## PDF Service Implementation

The PDF service is implemented in: `frontend/packages/ios-app/src/services/real/pdfService.ts`

**Key Features:**
- 30-second timeout for processing
- Error handling with user-friendly messages
- Response validation and transformation
- Integration with base API authentication

**Usage Example:**
```typescript
import { RealPDFService } from './services/real/pdfService';

const pdfService = new RealPDFService();

const response = await pdfService.extractPage({
  pdf_url: "https://example.com/manual.pdf",
  page_number: 1,
  highlight_text: "configuration",
  highlight_color: "yellow"
});
```

## Backend Implementation

The backend PDF extraction is handled by the `pdf-page` Lambda function:

**Location:** `backend/src/functions/pdf-page/`
**Technology:** PyMuPDF (via Lambda Layer)
**Features:**
- Real PDF processing with text extraction
- Text highlighting with coordinate positioning
- High-quality rendering (144 DPI)
- S3 caching with MD5-based keys
- Graceful fallback to base64 for compatibility

## Testing Checklist

When testing PDF extraction, verify:

### ✅ Authentication
- [ ] Valid JWT token obtained
- [ ] Token not expired (check `exp` claim)
- [ ] Token includes required scopes
- [ ] API returns 401 for invalid/expired tokens

### ✅ Request Validation
- [ ] PDF URL is accessible to backend
- [ ] Page number is within document range
- [ ] Highlight text is reasonable length
- [ ] Highlight color is valid (yellow, blue, green, red)

### ✅ Response Validation
- [ ] Status code 200 for success
- [ ] Response includes `page_image_url`
- [ ] Response includes processing metadata
- [ ] Image URL is accessible (if S3 URL)
- [ ] Image contains expected content

### ✅ Error Handling
- [ ] Invalid PDF URL returns proper error
- [ ] Invalid page number returns proper error
- [ ] Network issues handled gracefully
- [ ] Rate limiting respected (429 responses)

### ✅ Performance
- [ ] First request completes within 30 seconds
- [ ] Cached requests complete quickly (<1 second)
- [ ] Large PDFs handled correctly
- [ ] Memory usage remains reasonable

## Common Issues and Solutions

### 1. Authentication Errors (401)
**Problem:** Token expired or invalid
**Solution:** 
- Re-login with CLI: `npm run cli auth login`
- Check token expiration in JWT payload
- Verify token format (should be JWT with 3 parts)

### 2. PDF Not Found (404)
**Problem:** PDF URL not accessible to backend
**Solution:**
- Verify PDF URL is publicly accessible
- Check if PDF requires authentication
- Try with a different PDF URL

### 3. Page Out of Range
**Problem:** Requested page doesn't exist
**Solution:**
- Check PDF page count first
- Use page numbers starting from 1
- Verify PDF isn't corrupted

### 4. Timeout Errors
**Problem:** Processing takes too long
**Solution:**
- Try with smaller PDF files
- Check Lambda timeout settings
- Consider using cached version

### 5. Rate Limiting (429)
**Problem:** Too many requests
**Solution:**
- Wait for rate limit reset
- Implement exponential backoff
- Check quotas with `npm run cli quotas`

## Environment Configuration

Make sure your environment is configured correctly:

```bash
# Check CLI configuration
npm run cli config get

# Check authentication status
npm run cli auth status

# Check quotas and limits
npm run cli quotas
```

## Debugging Tips

1. **Enable Verbose Logging:** Set `NODE_ENV=development` in iOS app
2. **Check Lambda Logs:** Look for PDF extraction logs in CloudWatch
3. **Verify PDF Accessibility:** Test PDF URL in browser
4. **Test with Simple PDFs:** Start with single-page PDFs
5. **Monitor Performance:** Check `processing_time_ms` in responses

## Support

If you encounter issues:

1. Check the test script output for detailed error messages
2. Verify your authentication setup
3. Test with known working PDF URLs
4. Check CloudWatch logs for backend errors
5. Ensure your API endpoint URL is correct

## Test Data

For testing, you can use these sample PDFs:
- Simple PDF: `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`
- Multi-page PDF: Upload your own manual via CLI or app

Remember to replace the test PDF URLs with actual manuals from your system for realistic testing.