import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import type { Message } from '@shared/schema';

interface ExportOptions {
  chatTitle: string;
  messages: Message[];
  chartImages?: Map<string, string[]>;
}

function cleanTextForExport(text: string): string {
  let cleaned = text.replace(/```chart[\s\S]*?```/g, '__CHART_BLOCK__');
  cleaned = cleaned.replace(/\[(\d+)\]/g, '[$1]');
  return cleaned;
}

interface TextSegment {
  text: string;
  type: 'h1' | 'h2' | 'h3' | 'normal' | 'bullet' | 'numbered' | 'empty' | 'table' | 'table-placeholder' | 'chart-placeholder';
  indent?: number;
  parts?: Array<{ text: string; bold: boolean }>;
  tableData?: { headers: string[]; rows: string[][] };
}

function parseInlineBold(text: string): Array<{ text: string; bold: boolean }> {
  const parts: Array<{ text: string; bold: boolean }> = [];
  const regex = /(\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), bold: false });
    parts.push({ text: match[1].replace(/\*\*/g, ''), bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), bold: false });
  return parts.length > 0 ? parts : [{ text, bold: false }];
}

function parsePipeLines(pipeLines: string[]): TextSegment | null {
  const filtered = pipeLines.filter(l => l.trim().startsWith('|'));
  if (filtered.length < 2) return null;

  const headers: string[] = [];
  const rows: string[][] = [];
  let headerParsed = false;

  for (const line of filtered) {
    const cells = line
      .split('|')
      .map(c => c.trim().replace(/\[(?:SQL\d*|SQL)\d*\]/gi, '').trim())
      .filter((_, i, arr) => i > 0 && i < arr.length);

    const isSeparator = cells.every(c => /^:?-+:?$/.test(c));
    if (isSeparator) continue;

    if (!headerParsed) {
      headers.push(...cells);
      headerParsed = true;
    } else {
      rows.push(cells);
    }
  }

  if (headers.length === 0) return null;
  return { text: '', type: 'table', tableData: { headers, rows } };
}

function parseMarkdownForPDF(text: string): TextSegment[] {
  const cleaned = cleanTextForExport(text);
  const lines = cleaned.split('\n');
  const segments: TextSegment[] = [];
  let pipeBuffer: string[] = [];

  function flushPipeBuffer() {
    if (pipeBuffer.length === 0) return;
    const seg = parsePipeLines(pipeBuffer);
    if (seg) segments.push(seg);
    pipeBuffer = [];
  }

  for (const line of lines) {
    if (line.includes('[Full data table attached')) {
      flushPipeBuffer();
      segments.push({ text: '', type: 'table-placeholder' });
      continue;
    }

    if (line.trim() === '__CHART_BLOCK__') {
      flushPipeBuffer();
      segments.push({ text: '', type: 'chart-placeholder' });
      continue;
    }

    if (line.trim().startsWith('|')) {
      pipeBuffer.push(line);
      continue;
    }

    flushPipeBuffer();

    if (line.trim() === '') {
      segments.push({ text: '', type: 'empty' });
      continue;
    }

    if (line.match(/^# /)) {
      segments.push({ text: line.replace(/^# /, ''), type: 'h1' });
    } else if (line.match(/^## /)) {
      segments.push({ text: line.replace(/^## /, ''), type: 'h2' });
    } else if (line.match(/^### /)) {
      segments.push({ text: line.replace(/^### /, ''), type: 'h3' });
    } else if (line.trim().match(/^[-*+]\s/)) {
      const content = line.replace(/^\s*[-*+]\s/, '');
      segments.push({ text: content, type: 'bullet', indent: (line.length - line.trim().length) / 2, parts: parseInlineBold(content) });
    } else if (line.trim().match(/^\d+\.\s/)) {
      const m = line.match(/^(\s*)(\d+)\.\s(.+)$/);
      if (m) {
        const content = `${m[2]}. ${m[3]}`;
        segments.push({ text: content, type: 'numbered', indent: m[1].length / 2, parts: parseInlineBold(content) });
      }
    } else {
      segments.push({ text: line, type: 'normal', parts: parseInlineBold(line) });
    }
  }

  flushPipeBuffer();
  return segments;
}

const PDF_TABLE_MAX_ROWS = 30;

function renderPDFTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  x: number,
  startY: number,
  maxWidth: number,
  pageHeight: number,
  margin: number
): number {
  const displayRows = rows.slice(0, PDF_TABLE_MAX_ROWS);
  const hasMore = rows.length > PDF_TABLE_MAX_ROWS;
  const colCount = headers.length;
  const colWidth = maxWidth / colCount;
  const rowH = 7;
  let y = startY;

  doc.setFontSize(7.5);

  function truncate(text: string, maxLen: number) {
    const t = (text || '').replace(/\[(?:SQL\d*)\]/gi, '').trim();
    return t.length > maxLen ? t.substring(0, maxLen - 1) + '…' : t;
  }

  function drawRow(cells: string[], bold: boolean, fillRgb?: [number, number, number]) {
    if (y + rowH > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    cells.forEach((cell, i) => {
      const cx = x + i * colWidth;
      if (fillRgb) {
        doc.setFillColor(...fillRgb);
        doc.rect(cx, y, colWidth, rowH, 'FD');
      } else {
        doc.rect(cx, y, colWidth, rowH, 'S');
      }
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const maxChars = Math.max(6, Math.floor((colWidth - 4) / 1.9));
      doc.text(truncate(cell, maxChars), cx + 2, y + rowH - 2);
    });
    y += rowH;
  }

  drawRow(headers, true, [232, 232, 242]);

  for (const row of displayRows) {
    const paddedRow = headers.map((_, i) => row[i] || '');
    drawRow(paddedRow, false);
  }

  if (hasMore) {
    if (y + 8 > pageHeight - margin) { doc.addPage(); y = margin; }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text(`… and ${rows.length - PDF_TABLE_MAX_ROWS} more rows — download CSV/Excel from the table for full data`, x + 2, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 9;
  }

  return y + 3;
}

export async function exportChatToPDF(options: ExportOptions): Promise<void> {
  const { chatTitle, messages, chartImages } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let yPosition = margin;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(chatTitle, margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Exported: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, yPosition);
  yPosition += 12;
  doc.setTextColor(0, 0, 0);

  const renderInlineBoldText = (
    parts: Array<{ text: string; bold: boolean }>,
    startX: number,
    startY: number,
    width: number,
    fontSize: number
  ): number => {
    doc.setFontSize(fontSize);
    let cx = startX;
    let cy = startY;

    for (const part of parts) {
      if (!part.text) continue;
      doc.setFont('helvetica', part.bold ? 'bold' : 'normal');
      const words = part.text.split(' ');
      for (let i = 0; i < words.length; i++) {
        const word = i === 0 ? words[i] : ' ' + words[i];
        const wordWidth = doc.getTextWidth(word);
        if (cx + wordWidth > startX + width && cx > startX) {
          cy += 5;
          cx = startX;
          if (cy > pageHeight - margin - 10) { doc.addPage(); cy = margin; }
        }
        doc.text(word, cx, cy);
        cx += wordWidth;
      }
    }
    return cy - startY + 5;
  };

  for (const message of messages) {
    if (yPosition > pageHeight - margin - 30) { doc.addPage(); yPosition = margin; }

    doc.setFillColor(message.role === 'user' ? 240 : 230, 245, 255);
    doc.rect(margin, yPosition - 5, maxWidth, 8, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(message.role === 'user' ? 'You' : 'LedgerLM', margin + 2, yPosition);
    yPosition += 10;

    const metadata = message.metadata as { citations?: string[]; tableData?: { headers: string[]; rows: string[][] } } | null;
    const segments = parseMarkdownForPDF(message.content);
    let chartPlaceholderIndex = 0;

    for (const segment of segments) {
      if (yPosition > pageHeight - margin - 10) { doc.addPage(); yPosition = margin; }

      if (segment.type === 'empty') { yPosition += 3; continue; }

      const baseIndent = (segment.indent || 0) * 5;
      const leftMargin = margin + 2 + baseIndent;

      switch (segment.type) {
        case 'h1':
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(segment.text, leftMargin, yPosition);
          yPosition += 8;
          break;

        case 'h2':
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(segment.text, leftMargin, yPosition);
          yPosition += 7;
          break;

        case 'h3':
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(segment.text, leftMargin, yPosition);
          yPosition += 6;
          break;

        case 'bullet':
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text('•', leftMargin, yPosition);
          if (segment.parts && segment.parts.length > 0) {
            const lh = renderInlineBoldText(segment.parts, leftMargin + 5, yPosition, maxWidth - baseIndent - 5, 10);
            yPosition += lh + 1;
          } else {
            yPosition += 6;
          }
          break;

        case 'numbered':
          if (segment.parts && segment.parts.length > 0) {
            const lh = renderInlineBoldText(segment.parts, leftMargin, yPosition, maxWidth - baseIndent, 10);
            yPosition += lh + 1;
          } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(segment.text, leftMargin, yPosition);
            yPosition += 6;
          }
          break;

        case 'table-placeholder':
          if (metadata?.tableData && metadata.tableData.headers.length > 0) {
            if (yPosition > pageHeight - margin - 20) { doc.addPage(); yPosition = margin; }
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Detailed Analysis', margin, yPosition);
            yPosition += 5;
            yPosition = renderPDFTable(
              doc,
              metadata.tableData.headers,
              metadata.tableData.rows,
              margin, yPosition, maxWidth, pageHeight, margin
            );
          }
          break;

        case 'table':
          if (segment.tableData && segment.tableData.headers.length > 0) {
            yPosition = renderPDFTable(
              doc,
              segment.tableData.headers,
              segment.tableData.rows,
              margin, yPosition, maxWidth, pageHeight, margin
            );
          }
          break;

        case 'chart-placeholder': {
          const msgCharts = chartImages?.get(String(message.id));
          const imgData = msgCharts?.[chartPlaceholderIndex];
          if (imgData) {
            const imgH = 70;
            if (yPosition + imgH > pageHeight - margin) { doc.addPage(); yPosition = margin; }
            doc.addImage(imgData, 'PNG', margin, yPosition, maxWidth, imgH);
            yPosition += imgH + 5;
            chartPlaceholderIndex++;
          }
          break;
        }

        case 'normal':
        default:
          if (segment.parts && segment.parts.length > 0) {
            const lh = renderInlineBoldText(segment.parts, leftMargin, yPosition, maxWidth - baseIndent, 10);
            yPosition += lh;
          } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(segment.text, leftMargin, yPosition);
            yPosition += 5;
          }
          break;
      }
    }

    // Charts that weren't inline (fallback — add remaining captured images at the end of message)
    const msgCharts = chartImages?.get(String(message.id));
    if (msgCharts && chartPlaceholderIndex === 0 && msgCharts.length > 0) {
      for (const imgData of msgCharts) {
        const imgH = 70;
        if (yPosition + imgH > pageHeight - margin) { doc.addPage(); yPosition = margin; }
        doc.addImage(imgData, 'PNG', margin, yPosition, maxWidth, imgH);
        yPosition += imgH + 5;
      }
    }

    if (metadata?.citations && metadata.citations.length > 0) {
      yPosition += 3;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Sources:', margin + 2, yPosition);
      yPosition += 4;
      for (let i = 0; i < metadata.citations.length; i++) {
        const citLines = doc.splitTextToSize(`[${i + 1}] ${metadata.citations[i]}`, maxWidth - 4);
        for (const cl of citLines) {
          if (yPosition > pageHeight - margin - 10) { doc.addPage(); yPosition = margin; }
          doc.text(cl, margin + 4, yPosition);
          yPosition += 4;
        }
      }
      doc.setTextColor(0, 0, 0);
    }

    yPosition += 8;
  }

  const fileName = `${chatTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.pdf`;
  doc.save(fileName);
}

export async function exportChatToWord(options: ExportOptions): Promise<void> {
  const { chatTitle, messages } = options;
  const documentChildren: Paragraph[] = [];

  documentChildren.push(
    new Paragraph({ text: chatTitle, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } })
  );
  documentChildren.push(
    new Paragraph({
      children: [new TextRun({ text: `Exported: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, italics: true, color: '666666', size: 20 })],
      spacing: { after: 400 },
    })
  );

  for (const message of messages) {
    documentChildren.push(
      new Paragraph({
        children: [new TextRun({ text: message.role === 'user' ? 'You' : 'LedgerLM', bold: true, size: 24, color: message.role === 'user' ? '0066CC' : '6B21A8' })],
        spacing: { before: 300, after: 100 },
      })
    );

    const content = cleanTextForExport(message.content);
    const lines = content.split('\n');
    let inList = false;

    for (const line of lines) {
      if (line.trim() === '' || line.trim() === '__CHART_BLOCK__') {
        documentChildren.push(new Paragraph({ text: '' }));
        inList = false;
        continue;
      }
      if (line.startsWith('### ')) {
        documentChildren.push(new Paragraph({ text: line.replace('### ', ''), heading: HeadingLevel.HEADING_3, spacing: { before: 150, after: 100 } }));
        inList = false; continue;
      }
      if (line.startsWith('## ')) {
        documentChildren.push(new Paragraph({ text: line.replace('## ', ''), heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
        inList = false; continue;
      }
      if (line.startsWith('# ')) {
        documentChildren.push(new Paragraph({ text: line.replace('# ', ''), heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
        inList = false; continue;
      }
      if (line.trim().match(/^[-*+]\s/)) {
        documentChildren.push(new Paragraph({ text: line.replace(/^\s*[-*+]\s/, ''), bullet: { level: 0 }, spacing: { after: 50 } }));
        inList = true; continue;
      }
      if (line.trim().match(/^\d+\.\s/)) {
        documentChildren.push(new Paragraph({ text: line.replace(/^\s*\d+\.\s/, ''), numbering: { reference: 'default-numbering', level: 0 }, spacing: { after: 50 } }));
        inList = true; continue;
      }
      if (line.trim().startsWith('|')) continue;
      if (line.includes('[Full data table attached')) {
        documentChildren.push(new Paragraph({ children: [new TextRun({ text: '[See full data table in application]', italics: true, color: '666666' })], spacing: { after: 100 } }));
        continue;
      }

      const textRuns: TextRun[] = [];
      const parts = line.split(/(\*\*[^*]+\*\*)/);
      for (const part of parts) {
        if (part.startsWith('**') && part.endsWith('**')) {
          textRuns.push(new TextRun({ text: part.replace(/\*\*/g, ''), bold: true }));
        } else if (part.trim()) {
          textRuns.push(new TextRun({ text: part }));
        }
      }
      if (textRuns.length > 0) {
        documentChildren.push(new Paragraph({ children: textRuns, spacing: { after: inList ? 50 : 100 } }));
      }
      inList = false;
    }

    const metadata = message.metadata as { citations?: string[] } | null;
    if (metadata?.citations && metadata.citations.length > 0) {
      documentChildren.push(new Paragraph({ children: [new TextRun({ text: 'Sources:', italics: true, size: 20, color: '666666' })], spacing: { before: 200, after: 100 } }));
      for (let i = 0; i < metadata.citations.length; i++) {
        documentChildren.push(new Paragraph({ children: [new TextRun({ text: `[${i + 1}] ${metadata.citations[i]}`, size: 18, color: '666666' })], spacing: { after: 50 } }));
      }
    }
    documentChildren.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  }

  const doc = new Document({
    sections: [{ properties: {}, children: documentChildren }],
    numbering: {
      config: [{ reference: 'default-numbering', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }] }],
    },
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${chatTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.docx`);
}
