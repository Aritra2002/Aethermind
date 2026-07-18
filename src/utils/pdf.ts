import * as pdfjsLib from 'pdfjs-dist';

// Point pdfjs to the worker from public or node_modules. We can rely on CDN for simplicity in this frontend app.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export const extractTextFromPDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const typedArray = new Uint8Array(arrayBuffer);
  const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: { str?: string } | unknown) => ('str' in (item as Record<string, unknown>) ? (item as { str: string }).str : '')).join(' ');
    fullText += pageText + '\n\n';
  }
  
  return fullText.trim();
};
