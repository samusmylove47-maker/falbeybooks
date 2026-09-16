# Form implementation and launch setup

Newsletter signup uses the author's recovered Mailchimp form. Contact messages still use the separate PHP endpoint at `public/form-handler.php`; its mail transport remains disabled until hosting delivery is configured and verified. The retained PHP `newsletter` branch supports older manual-request clients for backward compatibility, but neither public signup form uses it and it never enrolls readers.

## Newsletter signup through Mailchimp

Both signup forms—the homepage and `/newsletter/`—submit directly to the author's existing Mailchimp audience. The integration was recovered from the public [original Google Sites homepage](https://sites.google.com/falbeygroup.com/falbeybookscom/home). No account login, API key, or private credential was required. The audience identifiers in the public embed are form routing values, not account credentials.

The exact recovered destination is:

```text
https://johnwaynefalbey.us8.list-manage.com/subscribe/post?u=beac98e8cf6ffad5c4d0118d6&id=8c5c967b5c&f_id=00345ae0f0
```

| Field | Behavior |
|---|---|
| `EMAIL` | Required email address on both forms |
| `FNAME` | Optional name on the full newsletter page; omitted from the compact homepage form |
| `b_beac98e8cf6ffad5c4d0118d6_8c5c967b5c` | Original honeypot; hidden, outside the tab order, and submitted empty |
| `subscribe` | Submit control with value `Subscribe` |

The forms use native HTML POST with browser email validation and open Mailchimp in a new tab using `target="_blank"` and `rel="noopener"`. The explanatory copy announces that new tab. Signup works without JavaScript. Newsletter forms do not have `data-form` or `novalidate`, so the site's local JSON contact handler does not intercept them. Existing site styles are retained; Mailchimp's old stylesheet and validation script are not loaded.

Mailchimp controls the authoritative validation, CAPTCHA if presented, confirmation steps, subscription status, and unsubscribe process. The site does not claim a reader is subscribed merely because a form was submitted, and it does not assume a particular single- or double-opt-in audience setting. Signup details go directly from the reader's browser to Mailchimp rather than through this website's PHP endpoint.

The original embed is preserved for provenance in [original-mailchimp-embed.html](original-mailchimp-embed.html). Do not publish that evidence file or these implementation notes in the public website directory.

## Contact PHP behavior


- No names, addresses, messages, IP addresses, or backup submissions are written by the handler to disk or a log.
- The PHP endpoint accepts `contact` and the legacy `newsletter` request type. Public newsletter signups bypass PHP and use Mailchimp. Email is required; contact messages must contain text. Name is optional.
- Maximum sizes are 120 UTF-8 bytes for name, 254 for email, and 8,000 for message. The encoded request is limited to 32 KiB, allowing URL encoding to expand a valid UTF-8 message. Invalid field arrays, invalid UTF-8, control characters, and CR/LF in email or name are rejected. Input is not silently truncated.
- The fixed recipient is `wayne@falbeygroup.com`; the fixed sender is `noreply@falbeybooks.com`. Visitor input only becomes a validated Reply-To header and plain-text message content. No visitor-controlled envelope options or recipient are used.
- The existing hidden honeypot suppresses automated submissions. Requests with a browser origin outside the production HTTPS domains are rejected. Loopback HTTP origins are accepted only for an actual loopback-host/address preview. Requests without an Origin header remain supported. This does not prevent arbitrary direct bot requests; host-level rate limiting or a mailing provider's spam controls can complement it if needed.
- All responses are non-cacheable JSON with `ok`, `code`, and `message`. A success means PHP accepted the email for delivery. It cannot prove inbox arrival, and a newsletter request is never represented as enrollment.

## Production setup before enabling contact delivery

1. Keep the site on a supported PHP release with valid HTTPS. The website is deployed on Bluehost; valid certificates and normal HTTPS verification for `falbeybooks.com` and `www.falbeybooks.com` were confirmed on 16 September 2026. Continue monitoring certificate renewal.
2. Verify that Bluehost permits the `noreply@falbeybooks.com` sender and that domain email authentication is configured for the actual sending service. Provision that sender or change the fixed sender to another confirmed address on the domain if required. Confirm the author still wants delivery to `wayne@falbeygroup.com`.
3. Set the **server-side** environment variable `FALBEY_FORM_TRANSPORT=mail` only when ready to test host contact delivery. With no setting, `disabled`, or any other value, this PHP endpoint returns HTTP 503 and the direct author-email fallback. This setting has no effect on Mailchimp signup. Do not put mail credentials in HTML, JavaScript, a public config file, or GitHub. The PHP implementation uses the host's mail transport and contains no SMTP credentials.
4. With an approved test message, verify the contact form's delivery to the intended mailbox, inspect Reply-To, and check the visible success/error response before describing contact delivery as operational. Actual inbox delivery has **not** been tested. Mailchimp enrollment is a separate check requiring an approved test address; no live subscriber was created during this integration.
5. If a previous handler has ever run on a live host, check for its old `form-submissions.txt` in the document root. Deny public access immediately and arrange removal/private retention according to the author's needs. The revised handler never creates it. No live historical data was inspected, moved, or deleted during this work.

The PHP endpoint must execute, not be served as source. A static-only host cannot run this handler. Local PHP preview uses the disabled contact transport by default, so a contact submission exercises the fallback without sending email. Newsletter forms point to the author's real Mailchimp audience even in local preview; use an approved test address for any deliberate enrollment test. Automated integration checks inspect the form contract without submitting it.

## Contact and legacy PHP contract

POST `application/x-www-form-urlencoded` or `multipart/form-data` to `/form-handler.php` with:

| Field | Expected value |
|---|---|
| `form-name` | `contact`; legacy clients may still use `newsletter` for a manual request |
| `name` | Optional plain text |
| `email` | Required email address |
| `message` | Required for contact; unused for newsletter |
| `bot-field` | Leave empty |

Parse JSON and check `ok === true` as well as HTTP success; never accept an arbitrary HTML HTTP 200 page as submission success. Display the returned `message` as text, not HTML. Do not reset entered fields on a failed submission. Disable the submit button while the request is in flight to prevent accidental duplicates.

| HTTP | Code | Meaning |
|---|---|---|
| 200 | `request_received` | Legacy manual newsletter request accepted for delivery (or bot honeypot acknowledged without sending); not Mailchimp enrollment |
| 200 | `message_accepted` | Contact message accepted for delivery |
| 400 | `invalid_input`, `invalid_form` | Visitor can correct the form |
| 403 | `origin_not_allowed` | Unrelated browser origin rejected |
| 405 | `method_not_allowed` | POST required; response includes `Allow: POST` |
| 413 | `too_large` | Request or field limit exceeded |
| 415 | `unsupported_type` | Unsupported request content type |
| 503 | `delivery_unavailable` | Delivery disabled or host transport rejected/failed; show direct email fallback |

## Verification without real enrollment or email

Run `python tests/test-newsletter.py` (Python 3.9+, standard library only) from the repository root to check the generated public forms against `docs/original-mailchimp-embed.html`. The JSON report is written to ignored `.build/newsletter-verification.json`. The test only reads local files and never submits an address.

On 16 September 2026, 78 independent integration checks passed across both generated website copies. Checks compared the two signup forms to the recovered embed and verified the exact destination and honeypot, required `EMAIL`, optional `FNAME`, native POST validation, new-tab protection, accessible labels, removal of manual-request wording, and separation from the unchanged contact handler. All 79 existing PHP regression assertions also passed with simulated mail transports. No actual signup, network POST to Mailchimp, or real email was sent; audience enrollment and confirmation settings remain untested.

Run `php tests/test-form-handler.php`. The CLI-only harness injects simulated accepted, rejected, and exception-throwing transports. It checks valid forms, accurate newsletter request wording, fixed mail headers, bad inputs, honeypot behavior, origin rules, and delivery failures. The test harness and this document belong outside the public deploy directory. The production endpoint cannot enable the test harness through a request or environment variable.

Verification completed 15 September 2026 with the official portable PHP 8.5.10 runtime: syntax check passed and all 79 harness assertions passed. This includes the 32 KiB request boundary and a URL-encoded round trip for 2,600 Chinese characters (7,800 decoded UTF-8 bytes) reaching the simulated mail transport intact. A temporary loopback PHP server also returned the expected JSON over HTTP: GET = 405 with `Allow: POST`; valid newsletter POST with transport explicitly disabled = 503; invalid contact email = 400. `Content-Type: application/json; charset=utf-8` and `Cache-Control: no-store` were verified. The temporary server was stopped after these checks. No real email was sent.
