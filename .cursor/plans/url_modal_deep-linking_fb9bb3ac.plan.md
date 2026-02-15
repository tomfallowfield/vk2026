---
name: URL modal deep-linking
overview: Add support for opening a specific app modal when the page is loaded with a `modal` query parameter (e.g. for LinkedIn or other shared links). No existing URL handling exists; the app already has `openAppModal(panelId)` to open by panel id.
todos: []
isProject: false
---

# Shareable URL to open a modal (e.g. ERV / website review)

Yes, it’s possible. You can use a **query parameter** so a link like  
`https://yoursite.com/?modal=website-review` opens the page with that dialog already open. That link is shareable on LinkedIn, email, etc.

## Why query parameter instead of hash

The site already uses the **hash** for in-page sections (`#rescue`, `#pricing`, `#faqs`, `#guide`). Using the **query string** (`?modal=...`) keeps modal deep-links separate and avoids clashes with those anchors.

## Valid modal values

Panels are identified by `data-panel` in [index.html](index.html). The IDs you can use in the URL are:


| URL param value    | Dialog                                              |
| ------------------ | --------------------------------------------------- |
| `website-review`   | Free website review (likely what you mean by “ERV”) |
| `book-call`        | Book a call                                         |
| `lead-50things`    | 50 Things checklist                                 |
| `lead-offboarding` | Offboarding guide                                   |
| `lead-socialproof` | Social proof email course                           |


Example shareable link for the free website review:  
`https://yoursite.com/?modal=website-review`

## Implementation (single file)

All logic lives in [main.js](main.js); no HTML or CSS changes.

1. **Allowlist of panel IDs**
  Define a set or array of valid `data-panel` values (e.g. from the existing panels: `book-call`, `website-review`, `lead-50things`, `lead-offboarding`, `lead-socialproof`).
2. **On page load, read `?modal=` and open if valid**
  After the app modal code runs (so `openAppModal` exists), run once on load:
  - Parse `window.location.search` with `URLSearchParams`.
  - Read the `modal` parameter; if it’s in the allowlist, call `openAppModal(panelId)`.
  - Use a short `setTimeout(..., 0)` or `requestAnimationFrame` so the page paints first, then the modal opens (better UX than opening before first paint).
3. **Optional: keep URL in sync when opening/closing**
  When opening the modal from a **click** (not from URL), you can call `history.replaceState` to add `?modal=website-review` (or the current panel) so the current URL is shareable. When closing the modal, replace state again to remove the param (so the URL doesn’t keep `?modal=...` after close). This is optional; the minimal solution is “open on load if `?modal=` is present” only.

## Edge cases

- **Invalid or unknown `modal` value** – Ignore it; don’t open a modal.
- **Exit-intent** – The existing exit-intent in [main.js](main.js) (around line 176) shows `website-review` once per session. If the user landed with `?modal=website-review`, you may want to set the same `sessionStorage` flag so they don’t get a second pop on exit intent. Small one-line check before opening exit-intent.
- **Video modal** – This plan only covers the **app modal** (book a call, website review, lead magnets). The video lightbox is separate; extending URL support to it would be a follow-up (e.g. `?video=...` or similar).

## Summary

- **File to change:** [main.js](main.js).
- **Behaviour:** On load, if URL has `?modal=<valid-panel-id>`, call `openAppModal(panelId)` after a brief delay. Optionally sync URL when opening/closing the modal so the link in the address bar is shareable.
- **Example:** Sharing `https://yoursite.com/?modal=website-review` will open the Free website review dialog when the page loads.

