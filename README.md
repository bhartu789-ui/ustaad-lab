# CertifyPro — School Certificate Studio

CertifyPro is a school certificate management application. This is the **CertifyPro branch** of the education repository; the unrelated main branch is unchanged.

**Live website:** https://certifypro-edu.vercel.app

## Features

- Professional landscape A4 certificate designer with four themes
- School branding, signature and live preview
- Save printable certificates as PDF using the browser's Print dialog
- Bulk CSV import and multi-page certificate issuance
- Administrator-only certificate issuance and history
- Unique certificate IDs and QR links to the public verification page
- Server-side verification backed by Neon PostgreSQL

## Technology

Vanilla JavaScript, CSS, Vercel Node.js Functions, Neon PostgreSQL and open-source QRCode.

## Deployment

1. Import this branch into a Vercel project. The project does not require a front-end build tool.
2. Set the environment variables in `.env.example` via Vercel encrypted project settings, **never in Git**.
3. Apply `schema.sql` to a Neon database.
4. Use the Vercel build command `npm run build` and output directory `.`, with Node 22 or newer.
5. Visit the website, sign in as administrator, enter the institution name, and issue a certificate.
6. The public verification page is available at `/verify?id=CP-... `.

## Security and limitations

Only authorized administrators can issue official certificates. Public verification requires the record to exist in the persistent database. QR links do not themselves attest to certificate validity.

This branch supports **CSV**, not direct XLSX upload (save Excel worksheets as CSV first). The certificate records are persistent, but uploaded logo/signature assets remain local to the current browser. It does not yet have self-service organization accounts or a revocation interface. The admin password should be rotated after initial deployment.

Hosting and database usage must remain within their respective free-tier limits. No paid AI API is used.
