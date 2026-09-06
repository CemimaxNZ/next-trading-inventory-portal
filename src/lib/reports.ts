import { format } from "date-fns";

export function escapeCsvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function buildCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function csvDownloadResponse(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = `\uFEFF${buildCsv(rows)}\n`;

  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

export function buildReportFilename(prefix: string) {
  return `${prefix}-${format(new Date(), "yyyy-MM-dd")}.csv`;
}
