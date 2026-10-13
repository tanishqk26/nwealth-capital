export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { db } from '@/lib/supabase';

const DARK   = rgb(0.051, 0.231, 0.2);   // #0d3b33
const BLACK  = rgb(0.102, 0.102, 0.094); // #1a1a18
const GREY   = rgb(0.353, 0.353, 0.337); // #5a5a56
const LIGHT  = rgb(0.604, 0.604, 0.580); // #9a9a94
const GREEN_BG = rgb(0.957, 0.988, 0.976); // #f4fcf9

const DUMMY_HOLDINGS = [
  { scheme: 'HDFC Mid-Cap Opportunities Fund - Growth',     folio: '108234765/90', units: '312.450', nav: '₹182.34',  value: '₹56,985' },
  { scheme: 'Axis Bluechip Fund - Direct Growth',           folio: '24561238/01',  units: '481.200', nav: '₹54.67',   value: '₹26,314' },
  { scheme: 'Parag Parikh Flexi Cap Fund - Direct Growth',  folio: '30012845/00',  units: '196.800', nav: '₹74.20',   value: '₹14,600' },
  { scheme: 'SBI Small Cap Fund - Direct Growth',           folio: '18774432/12',  units: '88.600',  nav: '₹148.90',  value: '₹13,193' },
];

function fmt(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const contactId = searchParams.get('contact_id') ?? '';
  const fromDate  = searchParams.get('from') ?? '';
  const toDate    = searchParams.get('to') ?? '';

  // Look up contact name if we have an id
  let clientName = 'Investor';
  if (contactId) {
    const { data } = await db.from('contacts').select('name').eq('id', contactId).single();
    if (data?.name) clientName = data.name;
  }

  const doc  = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);

  const margin  = 48;
  const contentW = width - margin * 2;

  // ── Header band ────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: DARK });

  page.drawText('CONSOLIDATED ACCOUNT STATEMENT', {
    x: margin, y: height - 34, font: bold, size: 15, color: rgb(1, 1, 1),
  });
  page.drawText('CAMS · KFintech · NSDL · CDSL', {
    x: margin, y: height - 54, font: reg, size: 9, color: rgb(0.85, 0.95, 0.92),
  });

  // Logo placeholder top-right
  page.drawText('N', {
    x: width - margin - 14, y: height - 52, font: bold, size: 22, color: rgb(1, 1, 1),
  });

  // ── Sub-header band ────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 116, width, height: 36, color: GREEN_BG });
  page.drawText('Statement Period:', { x: margin, y: height - 101, font: bold, size: 9, color: DARK });
  page.drawText(
    `${fmt(fromDate)} to ${fmt(toDate)}`,
    { x: margin + 98, y: height - 101, font: reg, size: 9, color: GREY }
  );
  page.drawText('Generated:', { x: width - margin - 180, y: height - 101, font: bold, size: 9, color: DARK });
  page.drawText(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), {
    x: width - margin - 105, y: height - 101, font: reg, size: 9, color: GREY,
  });

  // ── Investor details ───────────────────────────────────────
  let y = height - 152;
  page.drawText('INVESTOR DETAILS', { x: margin, y, font: bold, size: 8, color: LIGHT });
  y -= 16;
  page.drawText('Name:', { x: margin, y, font: bold, size: 10, color: BLACK });
  page.drawText(clientName, { x: margin + 52, y, font: reg, size: 10, color: DARK });

  y -= 14;
  page.drawText('PAN:', { x: margin, y, font: bold, size: 10, color: BLACK });
  page.drawText('XXXXX0000X  (masked)', { x: margin + 52, y, font: reg, size: 10, color: GREY });

  // ── Holdings header ────────────────────────────────────────
  y -= 30;
  page.drawText('MUTUAL FUND HOLDINGS', { x: margin, y, font: bold, size: 8, color: LIGHT });

  // Column headers
  y -= 16;
  page.drawRectangle({ x: margin, y: y - 4, width: contentW, height: 18, color: rgb(0.918, 0.937, 0.929) });
  const cols = [0, 240, 330, 400, 460, 516];
  const colHeaders = ['Scheme Name', 'Folio No.', 'Units', 'NAV', 'Value'];
  colHeaders.forEach((h, i) => {
    page.drawText(h, { x: margin + cols[i], y: y + 1, font: bold, size: 8, color: DARK });
  });

  // Rows
  DUMMY_HOLDINGS.forEach((row, idx) => {
    y -= 22;
    if (idx % 2 === 1) {
      page.drawRectangle({ x: margin, y: y - 4, width: contentW, height: 18, color: rgb(0.975, 0.975, 0.97) });
    }
    page.drawText(row.scheme,  { x: margin + cols[0], y, font: reg,  size: 8, color: BLACK, maxWidth: 228 });
    page.drawText(row.folio,   { x: margin + cols[1], y, font: reg,  size: 8, color: GREY });
    page.drawText(row.units,   { x: margin + cols[2], y, font: reg,  size: 8, color: GREY });
    page.drawText(row.nav,     { x: margin + cols[3], y, font: reg,  size: 8, color: GREY });
    page.drawText(row.value,   { x: margin + cols[4], y, font: bold, size: 8, color: DARK });
  });

  // ── Total ──────────────────────────────────────────────────
  y -= 24;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentW, y }, thickness: 0.5, color: LIGHT });
  y -= 16;
  page.drawText('Total Portfolio Value', { x: margin, y, font: bold, size: 10, color: DARK });
  page.drawText('₹1,11,092', { x: margin + contentW - 50, y, font: bold, size: 10, color: DARK });

  // ── Sample transactions summary ────────────────────────────
  y -= 42;
  page.drawText('TRANSACTION SUMMARY (DEMO DATA)', { x: margin, y, font: bold, size: 8, color: LIGHT });
  y -= 16;
  const txns = [
    ['05 Apr 2024', 'SIP Purchase', 'HDFC Mid-Cap Opportunities',   '5,000', '27.42 units @ ₹182.34'],
    ['05 May 2024', 'SIP Purchase', 'Axis Bluechip Fund',           '3,000', '54.87 units @ ₹54.67'],
    ['05 Jun 2024', 'SIP Purchase', 'PPFAS Flexi Cap',              '2,000', '26.95 units @ ₹74.20'],
  ];
  txns.forEach(([date, type, scheme, amount, units]) => {
    page.drawText(date,   { x: margin,       y, font: reg, size: 8, color: GREY });
    page.drawText(type,   { x: margin + 78,  y, font: reg, size: 8, color: GREY });
    page.drawText(scheme, { x: margin + 168, y, font: reg, size: 8, color: BLACK, maxWidth: 170 });
    page.drawText(`₹${amount}`, { x: margin + 370, y, font: reg,  size: 8, color: GREY });
    page.drawText(units,         { x: margin + 420, y, font: reg,  size: 8, color: GREY, maxWidth: 130 });
    y -= 16;
  });

  // ── Footer ─────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width, height: 52, color: GREEN_BG });
  page.drawText(
    'This is a SAMPLE / DEMONSTRATION statement generated by Nwealth Capital. It does not represent actual holdings.',
    { x: margin, y: 32, font: bold, size: 7.5, color: DARK }
  );
  page.drawText(
    'Mutual fund investments are subject to market risks. Please read all scheme related documents carefully.',
    { x: margin, y: 18, font: reg, size: 7.5, color: GREY }
  );
  page.drawText('Nwealth Capital · SEBI Registered Mutual Fund Distributor · Pune, India', {
    x: width - margin - 280, y: 6, font: reg, size: 7, color: LIGHT,
  });

  const pdfBytes = await doc.save();

  const filename = `CAS_Statement_${fromDate || 'demo'}_to_${toDate || 'demo'}.pdf`
    .replace(/[^a-zA-Z0-9._-]/g, '-');

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}
