# Form implementation and launch setup

The PHP endpoint in `public/form-handler.php` handles contact messages and **manual subscription requests**. It does not enroll readers, send campaigns, or manage unsubscribe links. The author has a mailing service; integration is intentionally deferred until its details are supplied. Replace the interim request flow in a later change, using the service's consent and unsubscribe process.

## Current behavior

- No names, addresses, messages, IP addresses, or backup submissions are written by the handler to disk or a log.
- Only `newsletter` and `contact` are accepted. Email is required; contact messages must contain text. Name is optional.
- Maximum sizes are 120 UTF-8 bytes for name, 254 for email, and 8,000 for message. The encoded request is limited to 32 KiB, allowing URL encoding to expand a valid UTF-8 message. Invalid field arrays, invalid UTF-8, control characters, and CR/LF in email or name are rejected. Input is not silently truncated.
- The fixed recipient is `wayne@falbeygroup.com`; the fixed sender is `noreply@falbeybooks.com`. Visitor input only becomes a validated Reply-To header and plain-text message content. No visitor-controlled envelope options or recipient are used.
- The existing hidden honeypot suppresses automated submissions. Requests with a browser origin outside the production HTTPS domains are rejected. Loopback HTTP origins are accepted only for an actual loopback-host/address preview. Requests without an Origin header remain supported. This does not prevent arbitrary direct bot requests; host-level rate limiting or a mailing provider's spam controls can complement it if needed.
- All responses are non-cacheable JSON with `ok`, `code`, and `message`. A success means PHP accepted the email for delivery. It cannot prove inbox arrival, and a newsletter request is never represented as enrollment.

## Production setup before enabling forms

1. Serve the site with PHP 7.4+ (a current supported PHP release is preferred) and a valid HTTPS certificate for `falbeybooks.com`. The supplied Bluehost screenshot showed an expired certificate; repair and verify it before launch.
2. Verify that Bluehost permits the `noreply@falbeybooks.com` sender and that domain email authentication is configured for the actual sending service. Provision that sender or change the fixed sender to another confirmed address on the domain if required. Confirm the author still wants delivery to `wayne@falbeygroup.com`.
3. Set the **server-side** environment variable `FALBEY_FORM_TRANSPORT=mail` only when ready to test host delivery. With no setting, `disabled`, or any other value, forms fail safely with HTTP 503 and the direct author-email fallback. Do not put mail credentials in HTML, JavaScript, a public config file, or GitHub. This implementation uses the host's PHP mail transport and contains no SMTP credentials.
4. After publication/testing approval, submit one clearly labeled test through each form, check that the intended mailbox actually receives both, inspect Reply-To, and check the visible success/error response. These delivery tests have **not** been performed during local development.
5. If a previous handler has ever run on a live host, check for its old `form-submissions.txt` in the document root. Deny public access immediately and arrange removal/private retention according to the author's needs. The revised handler never creates it. No live historical data was inspected, moved, or deleted during this work.

The PHP endpoint must execute, not be served as source. A static-only host cannot run this handler. Local PHP preview uses the disabled transport by default, so submitting a valid form only exercises the honest fallback and sends no email. A static preview may show the fallback because the endpoint is not executable.

## Frontend contract

POST `application/x-www-form-urlencoded` or `multipart/form-data` to `/form-handler.php` with:

| Field | Expected value |
|---|---|
| `form-name` | `newsletter` or `contact` |
| `name` | Optional plain text |
| `email` | Required email address |
| `message` | Required for contact; unused for newsletter |
| `bot-field` | Leave empty |

Parse JSON and check `ok === true` as well as HTTP success; never accept an arbitrary HTML HTTP 200 page as submission success. Display the returned `message` as text, not HTML. Do not reset entered fields on a failed submission. Disable the submit button while the request is in flight to prevent accidental duplicates.

| HTTP | Code | Meaning |
|---|---|---|
| 200 | `request_received` | Newsletter request accepted for delivery (or bot honeypot acknowledged without sending) |
| 200 | `message_accepted` | Contact message accepted for delivery |
| 400 | `invalid_input`, `invalid_form` | Visitor can correct the form |
| 403 | `origin_not_allowed` | Unrelated browser origin rejected |
| 405 | `method_not_allowed` | POST required; response includes `Allow: POST` |
| 413 | `too_large` | Request or field limit exceeded |
| 415 | `unsupported_type` | Unsupported request content type |
| 503 | `delivery_unavailable` | Delivery disabled or host transport rejected/failed; show direct email fallback |

## Local tests (no real email)

Run `php tests/test-form-handler.php`. The CLI-only harness injects simulated accepted, rejected, and exception-throwing transports. It checks valid forms, accurate newsletter request wording, fixed mail headers, bad inputs, honeypot behavior, origin rules, and delivery failures. The test harness and this document belong outside the public deploy directory. The production endpoint cannot enable the test harness through a request or environment variable.

Verification completed 15 September 2026 with the official portable PHP 8.5.10 runtime: syntax check passed and all 79 harness assertions passed. This includes the 32 KiB request boundary and a URL-encoded round trip for 2,600 Chinese characters (7,800 decoded UTF-8 bytes) reaching the simulated mail transport intact. A temporary loopback PHP server also returned the expected JSON over HTTP: GET = 405 with `Allow: POST`; valid newsletter POST with transport explicitly disabled = 503; invalid contact email = 400. `Content-Type: application/json; charset=utf-8` and `Cache-Control: no-store` were verified. The temporary server was stopped after these checks. No real email was sent.
