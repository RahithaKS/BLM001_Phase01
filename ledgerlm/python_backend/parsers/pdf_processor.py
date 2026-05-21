import os
import PyPDF2
from pdf2image import convert_from_path
import pytesseract
from PIL import Image
import tempfile
import io
import logging

# Increase PIL's max image size limit to handle large PDFs (like scanned documents)
# Default is ~89 million pixels, we increase to 300 million to handle large scanned PDFs
Image.MAX_IMAGE_PIXELS = 300000000

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def extract_text_from_pdf(pdf_path):
    """
    Extract text from a PDF file using PyPDF2.
    Returns a list of dictionaries with text content and page numbers.
    """
    text_contents = []
    
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text = page.extract_text()
                
                if text.strip():  # If there's actual text content
                    text_contents.append({
                        'text': text,
                        'page': page_num + 1  # Pages start at 1
                    })
                else:
                    # If no text found, this might be a scanned page
                    logger.info(f"No text found on page {page_num + 1}, might be a scanned page")
                    
            return text_contents
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        return []

def perform_ocr(pdf_path):
    """
    Perform OCR on a PDF file using pdf2image and pytesseract.
    Returns a list of dictionaries with text content and page numbers.
    Uses lower DPI for large files and processes ONE PAGE AT A TIME to prevent memory exhaustion.
    """
    text_contents = []
    
    try:
        # Check file size to determine DPI (lower for large files)
        file_size_mb = os.path.getsize(pdf_path) / (1024 * 1024)
        
        # Use lower DPI for large files to prevent memory issues
        if file_size_mb > 10:
            dpi = 150  # Lower DPI for large files
            logger.info(f"Large PDF ({file_size_mb:.1f}MB), using DPI={dpi} for OCR")
        else:
            dpi = 200  # Standard DPI for smaller files
        
        # Get total page count first (without loading images)
        with open(pdf_path, 'rb') as f:
            pdf_reader = PyPDF2.PdfReader(f)
            total_pages = len(pdf_reader.pages)
        
        logger.info(f"Starting OCR for {total_pages} pages (processing one at a time)")
        
        # Process ONE PAGE AT A TIME to prevent memory exhaustion
        for page_num in range(1, total_pages + 1):
            logger.info(f"Processing page {page_num}/{total_pages} with OCR")
            
            try:
                # Convert only THIS page to image
                images = convert_from_path(
                    pdf_path, 
                    dpi=dpi,
                    first_page=page_num,
                    last_page=page_num
                )
                
                if images:
                    image = images[0]
                    
                    # Perform OCR on the image
                    text = pytesseract.image_to_string(image)
                    
                    if text.strip():  # If there's actual text content
                        text_contents.append({
                            'text': text,
                            'page': page_num
                        })
                    else:
                        logger.warning(f"OCR extracted no text from page {page_num}")
                    
                    # Free memory immediately
                    image.close()
                    del images
                    
            except Exception as page_error:
                logger.error(f"Error OCR processing page {page_num}: {str(page_error)}")
                continue  # Continue with next page even if one fails
                
        logger.info(f"OCR completed: extracted text from {len(text_contents)}/{total_pages} pages")
        return text_contents
        
    except Exception as e:
        logger.error(f"Error performing OCR: {str(e)}")
        return []

def process_pdf(pdf_path):
    """
    Process a PDF file using HYBRID approach: text extraction + OCR for sparse pages.
    This ensures financial tables/charts in images are captured even when most pages have text.
    Returns a list of text content from the PDF with page numbers.
    Enhanced to handle large documents better with progress updates.
    """
    # Get file size for logging and better user feedback
    file_size_mb = os.path.getsize(pdf_path) / (1024 * 1024)
    logger.info(f"Processing PDF: {pdf_path} ({file_size_mb:.2f} MB)")
    
    # First, try extracting text directly from the PDF
    text_contents = extract_text_from_pdf(pdf_path)
    
    # Calculate useful statistics
    total_pages = len(text_contents)
    empty_pages = sum(1 for content in text_contents if len(content.get('text', '').strip()) <= 50)
    
    # Check if we got anything meaningful
    if not text_contents or empty_pages > total_pages * 0.3:  # If 30% or more pages have minimal text
        logger.info(f"Insufficient text extracted directly from PDF ({empty_pages}/{total_pages} pages with minimal text), falling back to full OCR")
        # If not enough text was extracted, try OCR
        text_contents = perform_ocr(pdf_path)
    else:
        # HYBRID APPROACH: Even if most pages have text, run OCR on sparse pages
        # This catches financial tables/charts that are images on specific pages
        sparse_page_threshold = 200  # Pages with less than 200 chars might have image content
        sparse_pages = []
        
        for i, content in enumerate(text_contents):
            page_text = content.get('text', '').strip()
            page_num = content.get('page', i + 1)
            
            # Check if page is sparse (might have image-based tables/charts)
            if len(page_text) < sparse_page_threshold:
                sparse_pages.append(page_num)
        
        if sparse_pages:
            logger.info(f"Found {len(sparse_pages)} sparse pages that may contain image-based content: {sparse_pages[:10]}...")
            
            try:
                # Process sparse pages ONE AT A TIME to prevent memory exhaustion
                for page_num in sparse_pages:
                    try:
                        logger.info(f"Running OCR on sparse page {page_num} to capture potential image content")
                        
                        # Convert only THIS page to image
                        images = convert_from_path(
                            pdf_path,
                            dpi=150,  # Lower DPI for memory efficiency
                            first_page=page_num,
                            last_page=page_num
                        )
                        
                        if images:
                            image = images[0]
                            ocr_text = pytesseract.image_to_string(image)
                            
                            if ocr_text.strip():
                                # Find the corresponding page in text_contents and enhance it
                                for content in text_contents:
                                    if content.get('page') == page_num:
                                        original_text = content.get('text', '')
                                        # Use OCR text if it's longer
                                        if len(ocr_text.strip()) > len(original_text.strip()):
                                            content['text'] = ocr_text
                                            logger.info(f"Enhanced page {page_num} with OCR: {len(original_text)} -> {len(ocr_text)} chars")
                                        break
                                else:
                                    # Page wasn't in text_contents, add it
                                    text_contents.append({
                                        'text': ocr_text,
                                        'page': page_num
                                    })
                                    logger.info(f"Added OCR content for page {page_num}: {len(ocr_text)} chars")
                            
                            # Free memory immediately
                            image.close()
                            del images
                            
                    except Exception as page_error:
                        logger.warning(f"Could not OCR sparse page {page_num}: {str(page_error)}")
                        continue
                
                # Sort by page number after adding OCR pages
                text_contents.sort(key=lambda x: x.get('page', 0))
                
            except Exception as e:
                logger.warning(f"Could not run hybrid OCR on sparse pages: {str(e)}")
    
    # Calculate total content extracted
    total_chars = sum(len(content.get('text', '')) for content in text_contents)
    avg_chars_per_page = total_chars / len(text_contents) if text_contents else 0
    
    logger.info(f"Successfully processed PDF with {len(text_contents)} pages of content")
    logger.info(f"Extracted {total_chars:,} characters (avg {avg_chars_per_page:.1f} per page)")
    
    return text_contents
