# Falbey Books

The approved John Wayne Falbey / Sleeping Dogs author website for **https://falbeybooks.com**. This repository contains the editable source and the prepared website. The chapter page has a centered trailer; its former adjacent sample-cover panel has been removed. The final 20-second trailer retains the Option A Helix styling, with longer reading holds and corrected map connections. Its original score is extended without changing pitch or tempo; the original musical ending stays aligned with the final card. The client-selected cover and falbeybooks.com remain on that card.

## Edit and build

Requirements: Node.js 18+ and PHP 8.2+ for local preview/testing. No npm packages or install step are needed.

```sh
node source/build.mjs
php tests/test-form-handler.php
python tests/test-newsletter.py
php -S 127.0.0.1:4175 -t public source/preview-router.php
```

Open http://127.0.0.1:4175/ for the local preview. Stop the preview with Ctrl+C. The backend tests use simulated mail transports and send no real email.

- `source/site.html`: shared design, page content, book data and browser behavior. Edit this template rather than generated HTML or shared CSS/JS.
- `source/release.json`: domain, author, release configuration, optional exact launch date and verified preorder links. Update matching editorial copy in the template when facts change; metadata descriptions and social layouts also contain release wording.
- `source/retailer-links.json`: researched retailer destinations with evidence/verification notes. Recheck links before replacing them.
- `source/build.mjs`: produces 18 static pages, cached shared CSS/JS, metadata, sitemap and robots rules in `public/`. It preserves existing media and PHP and copies the Apache configuration from `source/apache.htaccess`. The local build manifest is written under ignored `.build/`.
- `source/apache.htaccess`: Apache access protections, response headers and routing configuration. Edit this source file before rebuilding when host configuration needs to change.
- `public/`: complete hosting payload, including original media, generated pages, PHP handler and Apache `.htaccess`. Keep these files committed so the repository always contains a deployable version. Add or replace media here, then build.
- `source/social.mjs`: optional 1200 × 630 social-card layout generator. Run `node source/social.mjs`, then preview `/__review/social/general/`, `/__review/social/sd-01/` through `sd-08/`, or `/__review/social/hidden-dragons/` with the local server. Export the layouts at 1200 × 630 into `public/og-card.png` and `public/assets/social/` when artwork changes. Prepared PNGs are already included; the normal build does not regenerate them.
- `tests/`: backend validation, no-mail regression tests, and a Python standard-library check comparing the generated Mailchimp forms with the recovered embed. `docs/FORMS.md` documents form behavior and host setup. The newsletter test needs Python 3.9+ and writes its report under ignored `.build/`.

The deployment includes the eight published novels, Book 9 promotion, sample chapter, appearances, newsletter, biography, press and contact pages. Old hash-style links redirect to the corresponding permanent paths.

## Publish to Bluehost

**Deploy the contents of `public/` only**, including `.htaccess`, to the verified document root that Bluehost assigns to `falbeybooks.com`. Do not upload this repository's `source/`, `tests/`, `docs/`, `.git/`, local runtime or build reports into that public directory. Do not point the domain at GitHub Pages: this website includes a PHP form endpoint, which GitHub Pages cannot execute.

Before replacing the live site, confirm the document root in Bluehost, preserve an appropriate backup of the current website, and confirm the deployment process targets that domain. There is intentionally no guessed document-root deployment command or automated workflow in this repository.

The website is live on Bluehost at https://falbeybooks.com. Valid HTTPS for both `falbeybooks.com` and `www.falbeybooks.com`, the canonical www-to-apex redirect, page routes, media playback, file protections and the contact fallback were verified on 16 September 2026. The expired certificate was replaced with an AutoSSL-issued certificate; no DNS records were changed. For each update, preserve a private rollback backup and verify the deployed pages and affected features using normal TLS validation. Keep certificate validation paths and existing email-related DNS records intact.

## Forms and mailing list

The homepage and newsletter page now use native HTML POST directly to the author's existing Mailchimp audience. The endpoint and field identifiers were recovered from the public signup form on the [original Google Sites homepage](https://sites.google.com/falbeygroup.com/falbeybookscom/home); no account login, API key, or private credential was needed. The original embed is preserved in [docs/original-mailchimp-embed.html](docs/original-mailchimp-embed.html) for provenance. Existing website styling is retained.

Signup opens Mailchimp in a new tab with `noopener`, announced in the form copy. Mailchimp's response is authoritative for validation and any confirmation steps; the site does not claim enrollment on submission or assume a particular opt-in setting. Both forms support native browser validation without JavaScript. Independent local verification passed 78 integration checks against the recovered embed and all 79 existing PHP regression assertions. No actual subscription or real email was sent; completed enrollment remains untested.

Contact mail delivery remains disabled and shows a direct email fallback. The fixed recipient is `wayne@falbeygroup.com`; the sender is `noreply@falbeybooks.com`. Configure the permitted sender and host mail delivery, then set the server-side environment variable `FALBEY_FORM_TRANSPORT=mail` only when ready to verify contact delivery. This setting does not affect Mailchimp signup. The PHP handler retains its old manual newsletter-request branch for backward compatibility, but neither public signup form uses it. Keep credentials out of the repository. See [form setup and tests](docs/FORMS.md) for details.

## Release facts still pending

The site uses November 2026; the exact day and preorder destinations are not yet supplied. Cover artwork is labeled as a sample where presented. The 20-second promotional trailer includes the selected cover, falbeybooks.com, longer reading holds, complete map connections and an extended version of the original soundtrack. Update these items when the author supplies final materials.
