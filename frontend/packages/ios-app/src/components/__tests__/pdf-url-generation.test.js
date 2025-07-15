// Simple test to validate PDF URL generation logic
// This can be run with Node.js directly

// Helper function to extract meaningful search terms from chunk text
function extractSearchTerms(text) {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
  
  // Extract words that are likely to be important for search
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .filter(word => !/^\d+$/.test(word)); // Remove pure numbers
  
  // Return unique terms, prioritizing longer words
  const uniqueWords = [...new Set(words)];
  return uniqueWords.sort((a, b) => b.length - a.length);
}

// Function to generate enhanced PDF URL
function generateEnhancedPDFUrl(pdfUrl, pageNumber, chunkText) {
  let enhancedPdfUrl = pdfUrl;
  const urlParams = [];
  
  // Add page navigation if page number is available
  if (pageNumber) {
    urlParams.push(`page=${pageNumber}`);
  }
  
  // Add text search for highlighting
  if (chunkText) {
    const searchTerms = extractSearchTerms(chunkText);
    if (searchTerms.length > 0) {
      const searchQuery = searchTerms.slice(0, 2).join(' ');
      urlParams.push(`search=${encodeURIComponent(searchQuery)}`);
    }
  }
  
  // Append URL parameters
  if (urlParams.length > 0) {
    const separator = pdfUrl.includes('#') ? '&' : '#';
    enhancedPdfUrl = `${pdfUrl}${separator}${urlParams.join('&')}`;
  }
  
  return enhancedPdfUrl;
}

// Test cases
console.log('Testing PDF URL generation...\n');

// Test 1: Basic PDF URL with page number
const testUrl1 = generateEnhancedPDFUrl(
  'https://example.com/manual.pdf',
  15,
  'This is a sample text about configuration settings and password reset procedures.'
);
console.log('Test 1 - Basic URL with page and search:');
console.log(testUrl1);
console.log('✓ Contains page=15:', testUrl1.includes('page=15'));
console.log('✓ Contains search parameter:', testUrl1.includes('search='));
console.log('✓ Contains configuration:', testUrl1.includes('configuration'));
console.log('');

// Test 2: PDF URL without page number
const testUrl2 = generateEnhancedPDFUrl(
  'https://example.com/manual.pdf',
  null,
  'WiFi connection troubleshooting guide'
);
console.log('Test 2 - URL without page number:');
console.log(testUrl2);
console.log('✓ No page parameter:', !testUrl2.includes('page='));
console.log('✓ Contains search parameter:', testUrl2.includes('search='));
console.log('✓ Contains troubleshooting:', testUrl2.includes('troubleshooting'));
console.log('');

// Test 3: PDF URL without chunk text
const testUrl3 = generateEnhancedPDFUrl(
  'https://example.com/manual.pdf',
  10,
  ''
);
console.log('Test 3 - URL without chunk text:');
console.log(testUrl3);
console.log('✓ Contains page=10:', testUrl3.includes('page=10'));
console.log('✓ No search parameter:', !testUrl3.includes('search='));
console.log('');

// Test 4: Extract search terms functionality
const sampleText = 'This is a sample text about configuration settings and password reset procedures.';
const searchTerms = extractSearchTerms(sampleText);
console.log('Test 4 - Search terms extraction:');
console.log('Original text:', sampleText);
console.log('Extracted terms:', searchTerms);
console.log('✓ Contains configuration:', searchTerms.includes('configuration'));
console.log('✓ Contains password:', searchTerms.includes('password'));
console.log('✓ Contains procedures:', searchTerms.includes('procedures'));
console.log('✓ No stop words:', !searchTerms.some(term => ['the', 'is', 'a', 'about', 'and'].includes(term)));
console.log('');

// Test 5: PDF URL with existing fragment
const testUrl5 = generateEnhancedPDFUrl(
  'https://example.com/manual.pdf#existing=param',
  5,
  'user manual installation guide'
);
console.log('Test 5 - URL with existing fragment:');
console.log(testUrl5);
console.log('✓ Contains existing fragment:', testUrl5.includes('existing=param'));
console.log('✓ Contains page=5:', testUrl5.includes('page=5'));
console.log('✓ Uses & separator:', testUrl5.includes('&page=5'));
console.log('');

// Test 6: PDF.js URL generation
function generatePDFJsUrl(pdfUrl, pageNumber, chunkText) {
  const baseUrl = 'https://mozilla.github.io/pdf.js/web/viewer.html';
  const params = new URLSearchParams({
    file: pdfUrl,
  });
  
  if (pageNumber) {
    params.append('page', pageNumber.toString());
  }
  
  if (chunkText) {
    const searchTerms = extractSearchTerms(chunkText);
    if (searchTerms.length > 0) {
      const searchQuery = searchTerms.slice(0, 2).join(' ');
      params.append('search', searchQuery);
    }
  }
  
  return `${baseUrl}?${params.toString()}`;
}

const testPDFJsUrl = generatePDFJsUrl(
  'https://example.com/manual.pdf',
  10,
  'configuration settings troubleshooting'
);
console.log('Test 6 - PDF.js URL generation:');
console.log(testPDFJsUrl);
console.log('✓ Uses PDF.js viewer:', testPDFJsUrl.includes('mozilla.github.io/pdf.js'));
console.log('✓ Contains file parameter:', testPDFJsUrl.includes('file='));
console.log('✓ Contains page parameter:', testPDFJsUrl.includes('page=10'));
console.log('✓ Contains search parameter:', testPDFJsUrl.includes('search='));
console.log('');

console.log('All tests completed! ✅');