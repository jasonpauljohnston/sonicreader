import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set worker source for pdfjs-dist using Vite's asset loader
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface PDFDocument {
  id: string;
  name: string;
  author: string;
  totalPages: number;
  content: string[]; // Content per page
  fullText: string; // Combined text for continuous reading
  addedAt: number;
}

export async function extractTextFromPDF(file: File): Promise<PDFDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const content: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    content.push(pageText);
  }

  const fullText = content.join('\n\n');

  return {
    id: crypto.randomUUID(),
    name: file.name,
    author: 'Unknown Author',
    totalPages: pdf.numPages,
    content,
    fullText,
    addedAt: Date.now(),
  };
}
