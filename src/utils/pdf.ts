/**
 * @file pdf.ts
 * @description Client-side PDF text extraction utility for AetherMind.
 * Configures the PDF.js Web Worker and parses uploaded PDF binary files directly in the browser,
 * extracting plain text across all document pages for note creation or RAG ingestion.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure the PDF.js background worker script source from the bundled package distribution
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

/**
 * Extracts concatenated plain text content across all pages of an uploaded PDF file.
 *
 * Reads the input {@link File} as an ArrayBuffer, passes it to the PDF.js engine,
 * and iterates through every page to extract and join textual content tokens.
 *
 * @param file - The browser {@link File} object representing the PDF document to parse.
 *
 * @returns A promise resolving to the trimmed plain text extracted from all pages of the PDF.
 *
 * @throws {Error} If the PDF file is corrupted, password-protected, or fails during parsing.
 *
 * @example
 * ```ts
 * const fileInput = document.querySelector('input[type="file"]');
 * const file = fileInput.files[0];
 * const extractedText = await extractTextFromPDF(file);
 * console.log('Extracted PDF Content:', extractedText);
 * ```
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
  // Convert the File blob into an ArrayBuffer for PDF.js binary loading
  const arrayBuffer = await file.arrayBuffer();
  const typedArray = new Uint8Array(arrayBuffer);

  // Initialize and load the PDF document proxy
  const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
  let fullText = '';
  
  // Iterate sequentially through all pages (1-indexed in PDF.js)
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Extract textual strings from each text content token and join with spaces
    const pageText = textContent.items
      .map((item: { str?: string } | unknown) => ('str' in (item as Record<string, unknown>) ? (item as { str: string }).str : ''))
      .join(' ');
      
    fullText += pageText + '\n\n';
  }
  
  return fullText.trim();
};

