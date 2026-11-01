/**
 * Reads a public Google Sheet from the browser with the Visualization API ("gviz"). It answers
 * queries like `select A, count(C) where B = 'x' group by A`, so only the rows needed are sent.
 * The request is made with a <script> tag (JSONP) because Google doesn't allow cross-site fetches
 * here; the sheet must be shared so anyone with the link can view it.
 */

/** Overridable for tests; the real service is Google Docs. */
const SHEETS_BASE =
  process.env.NEXT_PUBLIC_SHEETS_BASE || "https://docs.google.com";

export interface SheetTable {
  cols: { id: string; label: string; type: string }[];
  rows: { c: ({ v: unknown; f?: string } | null)[] }[];
}

const NOT_SHARED =
  "Couldn't read the Google Sheet. Make sure it's shared so anyone with the link can view it.";

let callbacks = 0;

/** Runs a query against one tab of a sheet. */
export function querySheet(
  sheetId: string,
  tab: string,
  query: string,
): Promise<SheetTable> {
  return new Promise((resolve, reject) => {
    const name = `__rocketSheet${++callbacks}`;
    const script = document.createElement("script");
    const globals = window as unknown as Record<string, unknown>;
    let settled = false;
    const finish = () => {
      settled = true;
      clearTimeout(timer);
      delete globals[name];
      script.remove();
    };
    const timer = setTimeout(() => {
      if (settled) return;
      finish();
      reject(new Error("The Google Sheet took too long to answer."));
    }, 20000);

    globals[name] = (response: {
      status: string;
      table: SheetTable;
      errors?: { message?: string; detailed_message?: string }[];
    }) => {
      if (settled) return;
      finish();
      if (response.status === "error") {
        const error = response.errors?.[0];
        reject(
          new Error(error?.detailed_message || error?.message || NOT_SHARED),
        );
      } else resolve(response.table);
    };
    script.onerror = () => {
      if (settled) return;
      finish();
      reject(new Error(NOT_SHARED));
    };
    // A private sheet answers with a sign-in page instead of calling back.
    script.onload = () =>
      setTimeout(() => {
        if (settled) return;
        finish();
        reject(new Error(NOT_SHARED));
      }, 0);

    const params = new URLSearchParams({
      tqx: `out:json;responseHandler:${name}`,
      headers: "1",
      sheet: tab,
      tq: query,
    });
    script.src = `${SHEETS_BASE}/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?${params}`;
    document.head.appendChild(script);
  });
}

/** A string literal for a query, quoted with whichever quote mark the text doesn't contain. */
export function quote(text: string): string {
  if (!text.includes('"')) return `"${text}"`;
  if (!text.includes("'")) return `'${text}'`;
  return `"${text.replace(/"/g, "")}"`;
}

/** Pulls the sheet ID out of a Google Sheets link (or returns the text if it's already an ID). */
export function sheetIdFromUrl(text: string): string {
  const match = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(text);
  return match ? match[1] : text.trim();
}

/** A cell's value as text. */
export function cellText(
  cell: { v: unknown; f?: string } | null | undefined,
): string {
  if (!cell || cell.v === null || cell.v === undefined) return "";
  return String(cell.v).trim();
}
