# SD-09 series teaser — 17 September 2026

The series grid now includes Hidden Dragons, Sleeping Dogs in ninth position. The card shows the portrait adaptation of the author's selected artwork, labels the release as coming November 2026, and opens `/sample-chapter/#chapter-one`. It remains separate from the eight published BOOKS records, so no retailer links or publication date are invented. At release, move the book into BOOKS with verified retailer data and remove upcomingCard() from fill().

The Encrypt/Decrypt strip uses a shared CSS grid row for its text and control. Both message states occupy the same cell; wrapping determines its height, and a separate control column prevents overlap on narrow screens.

The selected square cover and approved trailer are unchanged. `public/covers/sd-09.webp` is a 1024 × 1536 portrait adaptation made with the built-in image-generation tool from the supplied approved square artwork. See `sd09-cover-prompt.txt` for the exact prompt. The full PNG master is retained in the project workspace.

Verification: 18 generated pages, 456 local references, 17 sitemap routes, zero static issues; 40 newsletter checks passed. Browser checks at desktop and 390px mobile width found nine ordered series cards, a correctly loaded portrait, no horizontal overflow, and zero difference between cipher text/control vertical centers. Chapter One navigation and focus were verified, as were keyboard and click cipher toggles. Both output trees are byte-identical. The trailer SHA256 remains `48aaa9da29e1b4634a54b1babff9b48bccf885f516870f28047cc9464b8f0842`.

Bluehost publication is pending authenticated access. The last deployed release is `0ad69c7`. Pushing this change to GitHub alone does not deploy it to Bluehost.
