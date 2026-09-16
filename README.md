# Falbey Books

The approved John Wayne Falbey / Sleeping Dogs author website for **https://falbeybooks.com**. This repository contains the editable source and the prepared website. The chapter page has a centered trailer; its former adjacent sample-cover panel has been removed. The final 15-second trailer retains the Option A Helix styling, pacing and exact original soundtrack. Its final card now uses the client-selected cover and falbeybooks.com (16 September 2026 revision).

## Edit and build

Requirements: Node.js 18+ and PHP 8.2+ for local preview/testing. No npm packages or install step are needed.

```sh
node source/build.mjs
php tests/test-form-handler.php
php -S 127.0.0.1:4175 -t public source/preview-router.php
```

Open http://127.0.0.1:4175/ for the local preview. Stop the preview with Ctrl+C. The backend tests use simulated mail transports and send no real email.

- `source/site.html`: shared design, page content, book data and browser behavior. Edit this template rather than generated HTML or shared CSS/JS.
- `source/release.json`: domain, author, release configuration, optional exact launch date and verified preorder links. Update matching editorial copy in the template when facts change; metadata descriptions and social layouts also contain release wording.
- `source/retailer-links.json`: researched retailer destinations with evidence/verification notes. Recheck links before replacing them.
- `source/build.mjs`: produces 18 static pages, cached shared CSS/JS, metadata, sitemap and robots rules in `public/`. It preserves existing media, PHP and Apache files. The local build manifest is written under ignored `.build/`.
- `public/`: complete hosting payload, including original media, generated pages, PHP handler and Apache `.htaccess`. Keep these files committed so the repository always contains a deployable version. Add or replace media here, then build.
- `source/social.mjs`: optional 1200 × 630 social-card layout generator. Run `node source/social.mjs`, then preview `/__review/social/general/`, `/__review/social/sd-01/` through `sd-08/`, or `/__review/social/hidden-dragons/` with the local server. Export the layouts at 1200 × 630 into `public/og-card.png` and `public/assets/social/` when artwork changes. Prepared PNGs are already included; the normal build does not regenerate them.
- `tests/`: backend validation and no-mail regression tests. `docs/FORMS.md` documents form behavior and host setup.

The deployment includes the eight published novels, Book 9 promotion, sample chapter, appearances, newsletter, biography, press and contact pages. Old hash-style links redirect to the corresponding permanent paths.

## Publish to Bluehost

**Deploy the contents of `public/` only**, including `.htaccess`, to the verified document root that Bluehost assigns to `falbeybooks.com`. Do not upload this repository's `source/`, `tests/`, `docs/`, `.git/`, local runtime or build reports into that public directory. Do not point the domain at GitHub Pages: this website includes a PHP form endpoint, which GitHub Pages cannot execute.

Before replacing the live site, confirm the document root in Bluehost, preserve an appropriate backup of the current website, and confirm the deployment process targets that domain. There is intentionally no guessed document-root deployment command or automated workflow in this repository.

The supplied Bluehost screen showed an expired SSL certificate. Renew/activate and verify a valid certificate for `falbeybooks.com` and `www.falbeybooks.com` before public launch. DNS must resolve the domain to the Bluehost site containing this payload. Verify HTTPS, root and deep page URLs, a missing-page 404, media playback, retailer links and form fallback after deployment. Enable a canonical HTTPS redirect on the host once the certificate is valid; preserve any existing email-related DNS records.

## Forms and mailing list

The author has an existing mailing service; its integration is intentionally deferred to a later PR when account details are supplied. Current newsletter submissions are explicitly **manual subscription requests**, never automatic enrollment.

Contact/request mail delivery is disabled by default and shows a direct email fallback. The fixed recipient is `wayne@falbeygroup.com`; the sender is `noreply@falbeybooks.com`. Configure the permitted sender and host mail delivery, then set the server-side environment variable `FALBEY_FORM_TRANSPORT=mail` only when ready to verify delivery. Confirm test messages arrive before describing these forms as operational. Keep credentials out of the repository. See [form setup and tests](docs/FORMS.md) for details.

## Release facts still pending

The site uses November 2026; the exact day and preorder destinations are not yet supplied. Cover artwork is labeled as a sample where presented. The promotional trailer has been revised with the selected cover and falbeybooks.com; its audio and 15-second timeline are preserved. Update these items when the author supplies final materials.
