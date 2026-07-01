import { useState, useCallback } from 'react';

/**
 * Extracts plain text from an uploaded PDF or DOCX file, entirely
 * client-side — no file leaves the browser until the extracted text is
 * sent to the existing /api/ai/import endpoint (which already accepts
 * raw text). This is the piece that was previously missing: the backend
 * AI parser existed, but nothing in the frontend ever produced a
 * `rawText` string from an uploaded file to send it.
 *
 * pdfjs-dist requires a worker script. We point it at the version-matched
 * CDN build rather than bundling the worker file ourselves, which avoids
 * Vite asset-handling configuration for a binary that's only needed for
 * this one feature.
 */

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — generous for a resume, guards against accidental huge uploads

export type ParseStatus = 'idle' | 'reading' | 'done' | 'error';

interface UseResumeFileParserResult {
  status: ParseStatus;
  error: string | null;
  parseFile: (file: File) => Promise<string | null>;
  reset: () => void;
}

async function extractPdfText(file: File): Promise<string> {
  // Dynamic import keeps pdfjs-dist (sizeable) out of the main bundle —
  // it only loads when someone actually uploads a PDF.
  //
  // Worker loading: the ?url import approach is unreliable with pdfjs-dist
  // v4 + Vite — Vite may inline the worker as base64 or fail to resolve it
  // entirely depending on config. The stable approach is pointing workerSrc
  // at a static file in the public/ directory, copied there by the
  // postinstall script in package.json. The path '/pdf.worker.min.mjs' is
  // always available at the server root regardless of environment.
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pageTexts.push(pageText);
  }

  const text = pageTexts.join('\n\n').trim();
  if (!text) {
    throw new Error(
      'No selectable text found in this PDF. It may be a scanned image — try pasting the text directly instead.',
    );
  }
  return text;
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value.trim();
  if (!text) {
    throw new Error('No text found in this document.');
  }
  return text;
}

export function useResumeFileParser(): UseResumeFileParserResult {
  const [status, setStatus] = useState<ParseStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  const parseFile = useCallback(async (file: File): Promise<string | null> => {
    setError(null);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('File is too large. Please upload a file under 8MB.');
      setStatus('error');
      return null;
    }

    setStatus('reading');

    try {
      let text: string;

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractPdfText(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.toLowerCase().endsWith('.docx')
      ) {
        text = await extractDocxText(file);
      } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
        text = (await file.text()).trim();
      } else {
        throw new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
      }

      setStatus('done');
      return text;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read this file.';
      setError(message);
      setStatus('error');
      return null;
    }
  }, []);

  return { status, error, parseFile, reset };
}
