// Client-side PDF generation — the prototype has no real scans, so document "View" actions
// build a genuine single-page PDF from the on-file data and open it in a new tab, where the
// browser's native PDF viewer renders it (toolbar, zoom, print, save all work for real).

export type PdfLine = { text: string; size?: number; bold?: boolean; gap?: number; highlight?: boolean }

// PDF strings are latin-1: swap ₹ for "Rs" and drop anything else non-ASCII.
export const pdfSafe = (s: string) => s.replace(/₹/g, 'Rs ').replace(/[^\x20-\x7e]/g, '')

export function wrapText(s: string, width = 92): string[] {
  const words = pdfSafe(s).split(/\s+/)
  const out: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) { out.push(line.trim()); line = w }
    else line += ' ' + w
  }
  if (line.trim()) out.push(line.trim())
  return out
}

export function buildPdf(lines: PdfLine[]): Blob {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  let y = 790
  let content = ''
  for (const l of lines) {
    const size = l.size ?? 11
    y -= l.gap ?? size + 8
    if (y < 56) break
    // A marker-style highlight box behind the line — same yellow a reader would draw over an
    // extracted value on a printed doc — drawn before the text so the glyphs sit on top of it.
    if (l.highlight) {
      const w = pdfSafe(l.text).length * size * 0.56 + 6
      const h = size + 5
      content += `1 0.92 0.35 rg\n52 ${(y - 3).toFixed(1)} ${w.toFixed(1)} ${h} re f\n0 g\n`
    }
    content += `BT /${l.bold ? 'F2' : 'F1'} ${size} Tf 56 ${y} Td (${esc(pdfSafe(l.text))}) Tj ET\n`
  }
  const objs: Record<number, string> = {
    1: '<< /Type /Catalog /Pages 2 0 R >>',
    2: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    3: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    4: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    5: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    6: `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  }
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let i = 1; i <= 6; i++) { offsets[i] = pdf.length; pdf += `${i} 0 obj\n${objs[i]}\nendobj\n` }
  const xref = pdf.length
  pdf += `xref\n0 7\n0000000000 65535 f \n${[1, 2, 3, 4, 5, 6].map((i) => `${String(offsets[i]).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}

// Opens a generated PDF in a new browser tab; revokes the object URL after a grace period
// so the tab has time to load it.
export function openPdfInNewTab(blob: Blob) {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
