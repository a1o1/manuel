# PDF Page Extraction & Highlighting Implementation

## Overview

The Manuel system now includes a comprehensive PDF page extraction feature that
allows users to:

- Extract specific pages from PDF documents
- Search and highlight text on those pages
- Cache processed pages for instant retrieval
- View pages with highlighted search terms from query results

## Architecture

### Lambda Function: `manuel-pdf-page-{stage}`

- **Purpose**: Extract and process specific PDF pages with text highlighting
- **Runtime**: Python 3.11
- **Memory**: 1024 MB
- **Timeout**: 60 seconds
- **Layer**: PDFProcessingLayer (PyMuPDF + Pillow)

### Key Components

1. **PyMuPDF Integration**

   - Self-contained PDF processing library
   - No external system dependencies (unlike pdf2image)
   - Built-in text search capabilities
   - High-quality rendering support

2. **Lambda Layer Structure**

   ```
   layers/pdf-processing/
   ├── requirements.txt
   └── python/
       ├── fitz/            # PyMuPDF
       ├── PIL/             # Pillow
       └── *.dist-info/     # Package metadata
   ```

3. **Caching Strategy**
   - MD5-based cache keys: `{pdf_url}|{page_number}|{highlight_text}`
   - Processed pages stored in S3: `processed-pages/{cache_key}.png`
   - 1-hour cache expiry for signed URLs
   - Instant retrieval for cached pages

## API Endpoint

### POST `/api/pdf-page`

**Request Body:**

```json
{
  "pdf_url": "https://s3-url-to-pdf",
  "page_number": 39,
  "highlight_text": "optional search text",
  "highlight_color": "yellow"
}
```

**Response:**

```json
{
  "page_image_url": "https://signed-s3-url-to-png",
  "page_number": 39,
  "highlight_text": "search text",
  "highlight_color": "yellow",
  "cached": false,
  "processing_time_ms": 1234.56
}
```

## Implementation Details

### Page Extraction Process

1. Download PDF from S3 using presigned URL
2. Open PDF with PyMuPDF
3. Validate page number exists
4. Render page at 2x scale (144 DPI equivalent)
5. Convert to PNG format

### Text Search & Highlighting

1. Use PyMuPDF's `search_for()` method
2. Get text rectangle coordinates
3. Scale coordinates to match rendered image
4. Draw semi-transparent highlight rectangles
5. Support multiple highlight instances

### Error Handling

- Invalid page numbers return descriptive errors
- Missing dependencies create fallback placeholder images
- S3 access errors are properly caught and reported
- Graceful degradation for all error scenarios

## Building the Lambda Layer

### Requirements

- PyMuPDF==1.24.0
- Pillow==10.4.0

### Build Process

1. Download Linux-compatible wheels:

   ```bash
   python3 -m pip download \
     --platform manylinux2014_x86_64 \
     --python-version 3.11 \
     --only-binary=:all: \
     PyMuPDF==1.24.0 Pillow==10.4.0
   ```

2. Extract into layer structure:

   ```bash
   mkdir -p python
   unzip PyMuPDF-*.whl -d python/
   unzip Pillow-*.whl -d python/
   unzip PyMuPDFb-*.whl -d python/  # PyMuPDF dependency
   ```

3. Deploy with SAM:
   ```yaml
   PDFProcessingLayer:
     Type: AWS::Serverless::LayerVersion
     Properties:
       LayerName: !Sub manuel-pdf-processing-layer-${Stage}
       ContentUri: layers/pdf-processing/
       CompatibleRuntimes:
         - python3.11
   ```

## Frontend Integration

### iOS App

- Enhanced source cards with PDF page extraction options
- "View Page X (Highlighted)" button on each source
- Automatic text extraction from source chunks
- Fallback to full PDF viewing if extraction fails

### User Experience

1. User queries the system
2. Views source cards with page references
3. Taps "View Page X (Highlighted)"
4. Page extracted with search terms highlighted
5. Opens in native viewer or shows success message

## Performance Considerations

- **Caching**: Dramatically reduces repeated processing
- **Image Quality**: 2x scale provides good readability
- **File Size**: PNG optimization reduces bandwidth
- **Lambda Memory**: 1GB allocation handles large PDFs
- **Timeout**: 60s accommodates complex processing

## Security

- S3 presigned URLs with 1-hour expiry
- User authentication required via Cognito
- Processed pages inherit source PDF permissions
- Cache keys include user context for isolation

## Monitoring

- CloudWatch logs for all operations
- Processing time metrics
- Cache hit/miss tracking
- Error rate monitoring
- Cost tracking per operation

## Future Enhancements

1. **OCR Support**: For scanned PDFs without text layers
2. **Multi-Page Export**: Extract page ranges
3. **Annotation Support**: User-added highlights
4. **Format Options**: Export as PDF, not just images
5. **Resolution Settings**: User-configurable quality

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure Lambda layer is properly attached
2. **Page Not Found**: Validate page numbers before extraction
3. **Memory Issues**: Increase Lambda memory for huge PDFs
4. **Timeout**: Consider chunking for very large files

### Debug Commands

```bash
# Check Lambda logs
aws logs tail /aws/lambda/manuel-pdf-page-dev --since 5m

# Test layer locally
docker run -v "$PWD":/var/task public.ecr.aws/lambda/python:3.11 \
  python -c "import fitz; print(fitz.__version__)"
```

## Cost Analysis

- **Lambda Invocations**: ~$0.0000002 per request
- **Lambda Duration**: ~$0.00001667 per GB-second
- **S3 Storage**: Minimal for cached pages
- **S3 Requests**: GET/PUT for cache operations
- **Data Transfer**: Depends on page image sizes

Typical cost per page extraction: < $0.001

## Version History

- **v1.2.0**: Initial implementation with PyMuPDF
- Replaced pdf2image with PyMuPDF for better Lambda compatibility
- Added text search and highlighting
- Implemented intelligent caching system
