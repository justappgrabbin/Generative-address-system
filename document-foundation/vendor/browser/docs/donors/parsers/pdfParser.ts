/**
 * PDF parser utility for extracting text and metadata from PDF files
 * Uses pdf-parse library for robust PDF handling
 */

export interface PDFContent {
  text: string;
  pageCount: number;
  metadata?: Record<string, any>;
  images?: number;
}

/**
 * Parse PDF content from buffer
 * Note: This is a stub implementation. In production, install pdf-parse:
 * npm install pdf-parse
 */
export async function parsePDF(buffer: Buffer): Promise<PDFContent> {
  try {
    // Dynamic import to avoid hard dependency
    const pdfParse = await import('pdf-parse');
    const data = await (pdfParse as any)(buffer);

    return {
      text: data.text,
      pageCount: data.numpages,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        creationDate: data.info?.CreationDate,
      },
      images: data.version,
    };
  } catch (error) {
    console.warn('[PDF Parser] Failed to parse PDF:', error);
    // Fallback: return basic structure with first 1000 chars
    try {
      const text = buffer.toString('utf-8', 0, Math.min(1000, buffer.length));
      return {
        text,
        pageCount: 0,
        metadata: { error: 'PDF parsing failed, returned raw text' },
      };
    } catch {
      return {
        text: '[PDF parsing error - binary content]',
        pageCount: 0,
        metadata: { error: 'Unable to extract text' },
      };
    }
  }
}

/**
 * Extract text from PDF with page breaks
 */
export async function extractPDFText(buffer: Buffer): Promise<string> {
  const content = await parsePDF(buffer);
  return content.text;
}

/**
 * Extract metadata from PDF
 */
export async function extractPDFMetadata(buffer: Buffer): Promise<Record<string, any>> {
  const content = await parsePDF(buffer);
  return {
    pageCount: content.pageCount,
    ...content.metadata,
  };
}
