// CSV-generering til data-eksport (fx /poster -> regneark).
//
// Vi bygger CSV'en til at åbne rent i dansk Excel/Numbers uden import-wizard:
//   - Separator er semikolon (;). Dansk Excel bruger semikolon som default
//     liste-separator, og komma er decimaltegn - så komma kan vi ikke bruge
//     som feltadskiller uden at tal-felter splittes forkert.
//   - UTF-8 BOM foran så Excel auto-detekterer encoding og viser æøå korrekt.
//   - CRLF (\r\n) linjeskift jf. RFC 4180; Excel er gladest for det.
//   - Felter med ; " eller linjeskift wrappes i dobbelt-anførselstegn, og
//     interne " fordobles ("" ) - standard RFC 4180-escaping.

const SEPARATOR = ';';
const NEWLINE = '\r\n';
// U+FEFF byte-order-mark. Markerer filen som UTF-8 for Excel på Windows.
const BOM = '﻿';

// Escape ét felt. Tal-strenge og simple ord slipper uberørt igennem; kun
// felter der ville bryde parsing wrappes.
function escapeField(value: string): string {
  if (value.includes('"') || value.includes(SEPARATOR) || /[\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Byg en komplet CSV-streng (inkl. BOM) fra en header-række og data-rækker.
// Hver celle konverteres til streng og escapes. Returnerer noget der kan
// sendes direkte som text/csv-body.
export function buildCsv(
  headers: string[],
  rows: (string | number)[][]
): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeField(String(cell))).join(SEPARATOR)
  );
  return BOM + lines.join(NEWLINE) + NEWLINE;
}

// Øre -> dansk decimal-streng uden tusind-separator: 123456 -> "1234,56".
// Bevidst UDEN tusind-separator (1.234,56) fordi punktummet ellers forvirrer
// Excels tal-parsing. Komma som decimaltegn matcher dansk locale, så cellen
// genkendes som et tal man kan regne på.
export function csvAmountDA(oere: number): string {
  return (oere / 100).toFixed(2).replace('.', ',');
}
