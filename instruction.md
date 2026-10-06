# Tender Document Package Builder — Development Guide

This guide is for anyone continuing development of this project. It describes how to run the app, how its current pieces fit together, and the rules future changes should preserve.

## What the app does

This is a frontend-only React application for assembling a tender submission PDF. The user loads a requirements JSON file, uploads PDFs, matches one PDF to each requirement, supplies expiry dates when needed, checks the resulting status, and downloads a combined package PDF.

There is no application server or database. Requirements and PDFs are processed in the browser. The current upload limits are 30 files and 50 MB total.

## Technology

- React 19 and Vite
- Tailwind CSS 4, with shared component styles in `style.css`
- `pdfjs-dist` to inspect PDF files and count pages
- `pdf-lib` to create the cover page and merge PDFs
- Web Crypto API (`crypto.subtle`) to compute SHA-256 hashes for duplicate detection

## Run the app

Use Node.js with npm, then run from the project directory:

```bash
npm install
npm run dev
```

Open the local address printed by Vite, usually `http://localhost:5173/`. Keep the terminal process running while using the development server.

To create and serve a production build locally:

```bash
npm run build
npm run preview
```

## Project layout

```text
App.jsx             Main UI, application state, uploads, matching, and status logic
generatePackage.js  PDF package creation and browser download
style.css           Tailwind import, reusable component classes, and motion styles
main.jsx            React application entry point
index.html          Vite HTML entry point
public/             Static assets, including the company logo
```

Keep PDF creation in `generatePackage.js` and the interactive workflow in `App.jsx`. If either file grows substantially, split reusable UI or pure business logic into small focused modules rather than adding a framework without a clear need.

## Requirements JSON format

The loaded JSON must contain a `tender` object and a `requirements` array. A typical file looks like:

```json
{
  "tender": {
    "tender_id": "T-2026-0417",
    "title": "Supply of IT Equipment",
    "procuring_entity": "Example Directorate",
    "bidder": "Example Company Ltd.",
    "submission_deadline": "2026-10-20"
  },
  "requirements": [
    {
      "id": "R01",
      "order": 1,
      "title_en": "Trade License",
      "title_bn": "ট্রেড লাইসেন্স",
      "mandatory": true,
      "has_expiry": true
    }
  ]
}
```

Requirements are displayed and included in the package in ascending `order`. Preserve stable unique requirement IDs because matching and expiry dates use the ID as their state key. Use ISO `YYYY-MM-DD` dates for deadlines and expiry dates.

## Current workflow and rules

1. Load and validate the JSON shape. Requirements are sorted by `order`.
2. Upload PDFs. Non-PDFs are rejected; unreadable, corrupted, or password-protected PDFs show an error and are not added.
3. The app records each accepted file's original `File`, name, byte size, page count, and SHA-256 hash. Identical-content files are marked as duplicates.
4. Match files to requirements using the dropdown or Auto-Match. Auto-Match compares normalized filename words with `title_en`; it is a convenience heuristic, so users should review every match.
5. A file can be assigned to at most one requirement, and a requirement can have at most one file. Identical files cannot satisfy different requirements.
6. Status rules:
   - Mandatory with no file: `Missing`
   - Optional with no file: `Not provided`
   - Expiring document with no expiry date: `Expiry date needed`
   - Expiry date before the submission deadline: `Expired`
   - Otherwise: `OK`
7. Package generation stays disabled while any requirement is blocking (`Missing`, `Expiry date needed`, or `Expired`) or the same file content is matched more than once.
8. The generated PDF has an English cover page, includes matched documents in requirement order, skips optional requirements without a file, and adds page-number footers.

## Development conventions

- Keep the application frontend-only unless the product requirements explicitly change. Do not add API keys or secrets to client code.
- Keep matching and validation behavior consistent between the UI and package generation. Validate again in the package-generation function because it can be called independently of the UI.
- Treat filenames and JSON values as untrusted input. Handle malformed files and PDF-library errors with clear UI messages; never let a rejected PDF become selectable.
- When changing upload limits, update the validation and the visible upload hint together.
- If adding or changing visible English copy, consider the Bengali translation in the `text` object in `App.jsx` too.
- Use semantic controls and labels, preserve keyboard focus styles, and keep layouts usable on narrow screens.
- Keep animation subtle and honor `prefers-reduced-motion`, as the existing CSS does.
- Static images belong in `public/`; reference them by root-relative URL (for example, `/company-logo.png`).
- Avoid storing PDF bytes as base64 in React state. Keep the original `File` and release temporary object URLs after use.
- Preserve lazy imports for PDF processing where practical so the main interface does not eagerly load large PDF libraries.

## Verify a change

Run the production build after implementation changes:

```bash
npm run build
```

There is currently no automated test script in `package.json`. For changes to upload, matching, status, or PDF output, also manually check the relevant workflow in the browser with representative valid, invalid, duplicate, optional, and expiry-date cases.

## Useful future improvements

- Add automated unit tests for requirement validation, status calculation, duplicate matching, and Auto-Match scoring.
- Add browser-level tests for the full upload-to-download workflow.
- Add an explicit confirmation or preview of the final document order before download.
- Improve accessibility checks and verify PDF output with long titles, many included documents, and mixed page sizes.
- Consider splitting the bilingual strings and pure business rules into dedicated modules if the feature set grows.
