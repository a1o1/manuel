"""
Manuel - PDF Page Extraction Function
Extracts specific pages from PDFs and highlights relevant text sections
"""

import base64
import hashlib
import io
import json
import os
import sys
import time
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse

import boto3


def get_pdf_from_s3(s3_url: str) -> bytes:
    """Download PDF from S3 URL"""
    try:
        # Parse S3 URL to extract bucket and key
        parsed = urlparse(s3_url)

        # Handle both signed URLs and direct URLs
        if "amazonaws.com" in parsed.netloc:
            # Extract bucket name from hostname
            if ".s3." in parsed.netloc:
                bucket_name = parsed.netloc.split(".s3.")[0]
            elif ".s3-" in parsed.netloc:
                bucket_name = parsed.netloc.split(".s3-")[0]
            else:
                # Format: bucket.s3.amazonaws.com
                bucket_name = parsed.netloc.split(".")[0]

            # Extract key from path
            key = parsed.path.lstrip("/")

            print(f"Downloading from S3: bucket={bucket_name}, key={key}")

            s3_client = boto3.client("s3")
            response = s3_client.get_object(Bucket=bucket_name, Key=key)
            pdf_bytes = response["Body"].read()

            print(f"Downloaded PDF: {len(pdf_bytes)} bytes")
            return pdf_bytes
        else:
            raise ValueError(f"Unsupported URL format: {s3_url}")

    except Exception as e:
        print(f"Error downloading PDF from S3: {str(e)}")
        raise


def extract_pdf_page(pdf_bytes: bytes, page_number: int):
    """Extract specific page from PDF as PIL Image"""
    try:
        print(f"Extracting page {page_number} from PDF ({len(pdf_bytes)} bytes)")

        # Try PyMuPDF (fitz) first
        try:
            import io

            import fitz  # PyMuPDF
            from PIL import Image

            print("Using PyMuPDF for extraction")

            # Open PDF from bytes
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")

            # Check if page exists
            if page_number < 1 or page_number > pdf_document.page_count:
                raise ValueError(
                    f"Page {page_number} does not exist. PDF has {pdf_document.page_count} pages."
                )

            # Get the page (0-indexed in PyMuPDF)
            page = pdf_document[page_number - 1]

            # Render page to pixmap with high quality
            mat = fitz.Matrix(
                2.0, 2.0
            )  # 2x scale for high quality (equivalent to 144 DPI)
            pix = page.get_pixmap(matrix=mat)

            # Convert pixmap to PIL Image
            img_data = pix.tobytes("png")
            extracted_image = Image.open(io.BytesIO(img_data))

            print(f"Successfully extracted page {page_number}: {extracted_image.size}")

            # Clean up
            pdf_document.close()

            return extracted_image

        except ImportError as e:
            print(f"PyMuPDF not available: {e}")
            # Fallback: create a placeholder image with error message
            from PIL import Image, ImageDraw, ImageFont

            # Create a larger placeholder image
            img = Image.new("RGB", (600, 800), color="white")
            draw = ImageDraw.Draw(img)

            # Try to use a default font, fallback to basic if not available
            try:
                font = ImageFont.load_default()
            except:
                font = None

            # Draw error message
            message = f"PDF Processing Unavailable\nPage {page_number}\n\nPDF libraries not installed.\nPlease install PyMuPDF."
            draw.multiline_text(
                (50, 200), message, fill="black", font=font, align="center"
            )

            return img

    except Exception as e:
        print(f"Error extracting PDF page: {str(e)}")
        # Create error image
        try:
            from PIL import Image, ImageDraw, ImageFont

            img = Image.new("RGB", (600, 800), color="#ffeeee")
            draw = ImageDraw.Draw(img)

            try:
                font = ImageFont.load_default()
            except:
                font = None

            error_message = f"Error Extracting Page {page_number}\n\n{str(e)[:200]}..."
            draw.multiline_text(
                (50, 200), error_message, fill="red", font=font, align="center"
            )

            return img
        except:
            # Last resort: raise the original error
            raise


def find_text_positions(
    pdf_bytes: bytes, page_number: int, search_text: str
) -> List[Tuple[int, int, int, int]]:
    """Find positions of text on the page for highlighting using PyMuPDF"""
    try:
        import fitz  # PyMuPDF

        # Open PDF from bytes
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")

        # Get the page (0-indexed in PyMuPDF)
        page = pdf_document[page_number - 1]

        # Search for text (case-insensitive)
        text_instances = page.search_for(search_text)

        # Convert rectangles to tuples
        positions = []
        scale = 2.0  # Match the scale used in extraction
        for rect in text_instances:
            # Scale the coordinates to match the rendered image
            x1 = int(rect.x0 * scale)
            y1 = int(rect.y0 * scale)
            x2 = int(rect.x1 * scale)
            y2 = int(rect.y1 * scale)
            positions.append((x1, y1, x2, y2))

        print(
            f"Found {len(positions)} instances of '{search_text}' on page {page_number}"
        )

        # Clean up
        pdf_document.close()

        return positions

    except Exception as e:
        print(f"Error searching for text: {e}")
        return []


def highlight_text_on_image(
    image, positions: List[Tuple[int, int, int, int]], highlight_color: str = "yellow"
):
    """Add highlight rectangles to image based on text positions"""
    if not positions:
        return image

    try:
        from PIL import ImageDraw

        # Create a copy of the image
        highlighted_image = image.copy()

        # Create drawing context
        draw = ImageDraw.Draw(highlighted_image, "RGBA")

        # Convert color name to RGBA
        color_map = {
            "yellow": (255, 255, 0, 100),  # Semi-transparent yellow
            "blue": (0, 0, 255, 100),
            "green": (0, 255, 0, 100),
            "red": (255, 0, 0, 100),
        }

        rgba_color = color_map.get(highlight_color, (255, 255, 0, 100))

        # Draw highlight rectangles
        for x1, y1, x2, y2 in positions:
            draw.rectangle([x1, y1, x2, y2], fill=rgba_color)

        return highlighted_image

    except ImportError:
        print("PIL not available for highlighting")
        return image


def cache_processed_page(bucket_name: str, cache_key: str, image) -> str:
    """Cache processed page image to S3"""
    try:
        print(f"Caching processed page to S3: {cache_key}")

        # Convert image to PNG bytes
        img_buffer = io.BytesIO()
        image.save(img_buffer, format="PNG", optimize=True, quality=85)
        img_bytes = img_buffer.getvalue()

        print(f"Image size: {len(img_bytes)} bytes")

        # Upload to S3
        s3_client = boto3.client("s3")
        cache_path = f"processed-pages/{cache_key}.png"

        s3_client.put_object(
            Bucket=bucket_name,
            Key=cache_path,
            Body=img_bytes,
            ContentType="image/png",
            CacheControl="max-age=3600",  # 1 hour cache
            Metadata={"processed-at": str(int(time.time())), "cache-key": cache_key},
        )

        # Generate signed URL for access
        signed_url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket_name, "Key": cache_path},
            ExpiresIn=3600,  # 1 hour
        )

        print(f"Cached image at: {signed_url}")
        return signed_url

    except Exception as e:
        print(f"Error caching processed page: {str(e)}")
        raise


def create_cache_key(pdf_url: str, page_number: int, highlight_text: str = "") -> str:
    """Create unique cache key for processed page"""
    # Create a hash based on PDF URL, page number, and highlight text
    cache_input = f"{pdf_url}|{page_number}|{highlight_text}".encode()
    return hashlib.md5(cache_input).hexdigest()


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handle PDF page extraction requests"""

    try:
        print(f"Received event: {json.dumps(event, default=str)}")

        # CORS handling
        if event.get("httpMethod") == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
                },
                "body": "",
            }

        # Parse request body
        body = event.get("body", "{}")
        if isinstance(body, str):
            try:
                body_data = json.loads(body)
            except json.JSONDecodeError:
                return {
                    "statusCode": 400,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                    "body": json.dumps({"error": "Invalid JSON in request body"}),
                }
        else:
            body_data = body

        print(f"Request body: {body_data}")

        # Extract and validate parameters
        pdf_url = body_data.get("pdf_url")
        page_number = body_data.get("page_number")
        highlight_text = body_data.get("highlight_text", "")
        highlight_color = body_data.get("highlight_color", "yellow")

        print(
            f"Parameters: pdf_url={pdf_url}, page_number={page_number}, highlight_text={highlight_text}"
        )

        # Validate inputs
        if not pdf_url or not page_number:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "pdf_url and page_number are required"}),
            }

        # Convert page number to integer
        try:
            page_num = int(page_number)
            if page_num < 1:
                raise ValueError("Page number must be positive")
        except ValueError:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "Invalid page number"}),
            }

        # Create cache key
        cache_key = create_cache_key(pdf_url, page_num, highlight_text)
        bucket_name = os.environ.get("MANUALS_BUCKET")

        # Check if processed page is already cached
        if bucket_name:
            try:
                s3_client = boto3.client("s3")
                cache_path = f"processed-pages/{cache_key}.png"

                # Check if cache exists
                s3_client.head_object(Bucket=bucket_name, Key=cache_path)

                # Generate signed URL for cached result
                cached_url = s3_client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": bucket_name, "Key": cache_path},
                    ExpiresIn=3600,  # 1 hour
                )

                print(f"Cache hit: {cached_url}")

                return {
                    "statusCode": 200,
                    "headers": {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                    "body": json.dumps(
                        {
                            "page_image_url": cached_url,
                            "page_number": page_num,
                            "highlight_text": highlight_text,
                            "highlight_color": highlight_color,
                            "cached": True,
                            "processing_time_ms": 0,
                        }
                    ),
                }

            except Exception:
                print("Cache miss, proceeding with processing")
                pass

        # Process the PDF page
        start_time = time.time()

        print(f"Processing PDF page - URL: {pdf_url}, Page: {page_num}")

        # Download PDF from S3
        pdf_bytes = get_pdf_from_s3(pdf_url)

        # Extract specific page
        page_image = extract_pdf_page(pdf_bytes, page_num)

        # Find text positions for highlighting (if highlight text is provided)
        if highlight_text:
            print(f"Searching for text to highlight: '{highlight_text}'")
            text_positions = find_text_positions(pdf_bytes, page_num, highlight_text)

            # Highlight text on image
            if text_positions:
                print(f"Highlighting {len(text_positions)} text instances")
                page_image = highlight_text_on_image(
                    page_image, text_positions, highlight_color
                )
            else:
                print("No text positions found for highlighting")

        # Cache processed page
        if bucket_name:
            page_image_url = cache_processed_page(bucket_name, cache_key, page_image)
        else:
            # Fallback: return base64 encoded image if no bucket
            img_buffer = io.BytesIO()
            page_image.save(img_buffer, format="PNG")
            img_base64 = base64.b64encode(img_buffer.getvalue()).decode()
            page_image_url = f"data:image/png;base64,{img_base64}"

        processing_time = round((time.time() - start_time) * 1000, 2)

        print(f"Processing completed in {processing_time}ms")

        response_data = {
            "page_image_url": page_image_url,
            "page_number": page_num,
            "highlight_text": highlight_text,
            "highlight_color": highlight_color,
            "cached": False,
            "processing_time_ms": processing_time,
        }

        print(f"Returning successful response: {response_data}")

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(response_data),
        }

    except Exception as e:
        print(f"Error processing PDF page: {str(e)}")
        import traceback

        traceback.print_exc()

        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "error": "Failed to process PDF page",
                    "details": str(e),
                    "timestamp": int(time.time()),
                }
            ),
        }
