const PAGE_SIZE = [595.28, 841.89]; // A4 points
const FOOTER_RESERVE = 26;

/**
 * Build and download a tender PDF package.
 *
 * matchedRequirements: requirement objects with a `fileId` matching an
 * uploadedFiles entry's `id`. Each uploadedFiles entry must include its
 * original browser File at `file`.
 */
export async function generatePackage(tender, matchedRequirements, uploadedFiles, { download = true } = {}) {
  if (!tender?.tender_id) throw new Error('Tender ID is required to generate the package.');
  if (!Array.isArray(matchedRequirements) || !Array.isArray(uploadedFiles)) {
    throw new Error('Requirements and uploaded files must be arrays.');
  }

  const filesById = new Map(uploadedFiles.map((item) => [item.id, item]));
  const orderedRequirements = [...matchedRequirements].sort(
    (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
  );
  
  const included = orderedRequirements.flatMap((requirement) => {
    const fileId = requirement.fileId ?? requirement.matchedFileId;
    const uploaded = fileId ? filesById.get(fileId) : null;
    if (!uploaded) {
      if (requirement.mandatory) {
        throw new Error(`Cannot generate package: mandatory document “${requirement.title_en || requirement.id}” is missing.`);
      }
      return []; // Skip optional documents with no file
    }
    if (!(uploaded.file instanceof Blob)) {
      throw new Error(`Cannot read “${uploaded.name || 'uploaded file'}”: its File object is missing.`);
    }
    return [{ requirement, uploaded }];
  });
  const includedHashes = new Set();
  for (const { uploaded } of included) {
    if (includedHashes.has(uploaded.hash)) {
      throw new Error('Identical PDF contents cannot be included for different requirements.');
    }
    includedHashes.add(uploaded.hash);
  }

  try {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const packagePdf = await PDFDocument.create();
    const cover = packagePdf.addPage(PAGE_SIZE);
    const font = await packagePdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await packagePdf.embedFont(StandardFonts.HelveticaBold);
    const [pageWidth, pageHeight] = PAGE_SIZE;
    const margin = 52;
    const ink = rgb(0.12, 0.16, 0.24);
    const muted = rgb(0.38, 0.42, 0.49);
    const accent = rgb(0.25, 0.29, 0.78);

    // --- 6.1 Cover Page (in English) ---
    cover.drawText('TENDER DOCUMENT PACKAGE', {
      x: margin,
      y: pageHeight - 74,
      size: 11,
      font: boldFont,
      color: accent,
      characterSpacing: 1.2,
    });
    
    const tenderTitleLines = wrapText(String(tender.title || 'Tender Submission'), 48);
    tenderTitleLines.forEach((line, index) => {
      cover.drawText(line, {
        x: margin,
        y: pageHeight - 116 - index * 28,
        size: 23,
        font: boldFont,
        color: ink,
        maxWidth: pageWidth - margin * 2,
      });
    });

    const detailRows = [
      ['Tender ID', tender.tender_id],
      ['Procuring Entity', tender.procuring_entity],
      ['Bidder', tender.bidder],
      ['Submission Deadline', tender.submission_deadline],
      ['Current Date', new Date().toISOString().slice(0, 10)],
    ];
    
    let y = pageHeight - 116 - tenderTitleLines.length * 28 - 18;
    for (const [label, value] of detailRows) {
      cover.drawText(`${label}:`, { x: margin, y, size: 10, font: boldFont, color: muted });
      cover.drawText(String(value || '—'), {
        x: margin + 142,
        y,
        size: 11,
        font,
        color: ink,
        maxWidth: pageWidth - margin * 2 - 142,
      });
      y -= 25;
    }

    y -= 8;
    cover.drawText('Included Documents', { x: margin, y, size: 13, font: boldFont, color: ink });
    y -= 24;

    const listBottom = 54;
    const availableHeight = y - listBottom;
    const estimatedLines = included.reduce((sum, { requirement }, index) => {
      const title = String(requirement.title_en || requirement.id || `Document ${index + 1}`);
      const maxChars = 74;
      return sum + Math.max(1, Math.ceil(title.length / maxChars));
    }, 0);
    
    const lineHeight = Math.min(17, availableHeight / Math.max(estimatedLines, 1));
    const listFontSize = Math.max(7, Math.min(10, lineHeight - 3));
    
    if (included.length && lineHeight < 9) {
      throw new Error('The included document list is too long to fit on the cover page.');
    }

    included.forEach(({ requirement }, index) => {
      const title = String(requirement.title_en || requirement.id || `Document ${index + 1}`);
      const lines = wrapText(title, 74);
      cover.drawText(`${index + 1}.`, { x: margin, y, size: listFontSize, font: boldFont, color: accent });
      lines.forEach((line, lineIndex) => {
        cover.drawText(line, {
          x: margin + 24,
          y: y - lineIndex * lineHeight,
          size: listFontSize,
          font,
          color: ink,
          maxWidth: pageWidth - margin * 2 - 24,
        });
      });
      y -= lines.length * lineHeight;
    });

    // --- 6.2 Merge Documents in Order ---
    for (const { requirement, uploaded } of included) {
      let sourcePdf;
      try {
        sourcePdf = await PDFDocument.load(await uploaded.file.arrayBuffer(), { ignoreEncryption: true });
      } catch (error) {
        throw new Error(`Could not read “${uploaded.name || requirement.title_en || requirement.id}” as a PDF: ${error.message}`);
      }
      const copiedPages = await packagePdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
      copiedPages.forEach((page) => {
        // Create a footer band and move the original artwork upward so the
        // footer remains readable without covering existing page content.
        page.translateContent(0, FOOTER_RESERVE);
        page.setSize(page.getWidth(), page.getHeight() + FOOTER_RESERVE);
        packagePdf.addPage(page);
      });
    }

    // --- 6.3 & 6.4 Add Footer to EVERY page (including cover) ---
    const totalPages = packagePdf.getPageCount();
    for (const [index, page] of packagePdf.getPages().entries()) {
      const footer = `${tender.tender_id} | Page ${index + 1} of ${totalPages}`;
      const footerSize = 9; // Slightly increased from 8 for better readability
      const footerWidth = font.widthOfTextAtSize(footer, footerSize);
      
      page.drawText(footer, {
        x: (page.getWidth() - footerWidth) / 2, // Centered
        y: 8,
        size: footerSize,
        font,
        color: muted,
      });
    }

    // --- Save and Download ---
    const bytes = await packagePdf.save();
    if (download) downloadPdf(bytes, `${safeFilename(tender.tender_id)}_Package.pdf`);
    return bytes;
  } catch (error) {
    throw new Error(`Package generation failed: ${error.message || 'Unknown error'}`, { cause: error });
  }
}

function wrapText(value, maxChars) {
  const words = value.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function safeFilename(value) {
  return String(value).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
}

function downloadPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
