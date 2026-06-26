/**
 * Briefing export helpers — HTML (print/PDF) without external renderers.
 */

import { BRAND } from "../branding.js";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToSimpleHtml(markdown) {
  const lines = String(markdown || "").split("\n");
  const out = [];
  let inPre = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!inPre) {
        out.push("<pre>");
        inPre = true;
      } else {
        out.push("</pre>");
        inPre = false;
      }
      continue;
    }
    if (inPre) {
      out.push(`${escapeHtml(line)}\n`);
      continue;
    }
    if (line.startsWith("### ")) {
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith("- ")) {
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (line.trim() === "") {
      out.push("<br/>");
    } else {
      out.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inPre) out.push("</pre>");
  return out.join("\n");
}

export function renderBriefingHtml(briefing) {
  const title = escapeHtml(briefing.title || briefing.type || "Briefing");
  const body = markdownToSimpleHtml(briefing.markdown || "");
  const generated = escapeHtml(briefing.createdAt || new Date().toISOString());

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; line-height: 1.5; color: #111; }
    h1,h2,h3 { margin-top: 1.25rem; }
    pre { background: #f4f4f5; padding: 1rem; overflow-x: auto; font-size: 12px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 1.5rem; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Generated: ${generated} · ${BRAND.hubName} Briefing</div>
  ${body}
</body>
</html>`;
}

/**
 * Minimal text PDF (PDF 1.4) — no external dependencies.
 * @param {{ title?: string; markdown?: string }} briefing
 * @returns {Buffer}
 */
export function renderBriefingPdfBuffer(briefing) {
  const raw = `${briefing.title || "Briefing"}\n\n${briefing.markdown || ""}`.slice(0, 12_000);
  const lines = raw.split(/\r?\n/).slice(0, 100);

  function escPdf(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  const content = ["BT", "/F1 10 Tf", "14 TL"];
  let first = true;
  for (const line of lines) {
    const chunk = escPdf(line.slice(0, 95));
    if (first) {
      content.push(`(${chunk}) Tj`);
      first = false;
    } else {
      content.push(`T* (${chunk}) Tj`);
    }
  }
  content.push("ET");
  const stream = content.join("\n");
  const streamLen = Buffer.byteLength(stream, "utf8");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
