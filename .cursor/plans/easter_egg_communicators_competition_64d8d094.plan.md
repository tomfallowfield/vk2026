---
name: Easter egg communicators competition
overview: "Plan for hiding 10 famous-communicator names around the site as a “power hour” competition: JS-only injection, obfuscated storage, single toggle to turn off, and specific placements (forms, rescue eyebrow, thank-you, Tom’s pic, T&amp;C, dark-only, deliverable, FAQ)."
todos: []
isProject: false
---

# Easter egg competition: 10 hidden communicators

## Goal

Run a competition where visitors find 10 hidden names of famous communicators to win a free power hour. All names are **JS-injected** (not in HTML so not in view source), stored **sneakily**, and the whole thing is **toggleable** when the competition ends.

---

## 1. The list of 10 names (draft)

**Required:** Tom Waits and Maya Angelou must be two of the 10 (valid competition answers). The rest:


| #   | Name                   | Rationale                                                                                    |
| --- | ---------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Winston Churchill      | Obvious orator                                                                               |
| 2   | William Shakespeare    | Fits “turn your shit to Shakespeare” rescue eyebrow                                          |
| 3   | David Ogilvy           | Copywriting legend                                                                           |
| 4   | Seth Godin             | Marketing/communication                                                                      |
| 5   | Steve Jobs             | Product storytelling                                                                         |
| 6   | Oprah Winfrey          | Communicator                                                                                 |
| 7   | Brené Brown            | Storytelling/vulnerability                                                                   |
| 8   | Martin Luther King Jr. | Orator                                                                                       |
| 9   | Maya Angelou           | Already quoted on site (“How it feels”) – Required; already quoted on site ("How it feels"). |
| 10  | Tom Waits              | Required; already quoted in T&Cs ("large print...")                                          |


You can swap any of 1–8 for Donald Miller, Gary Halbert, Eugene Schwartz, Rory Sutherland, Nelson Mandela, George Orwell, Cicero, or Mark Twain.

---

## 2. Where to store the list (sneaky, not in settings.js)

- **Do not** put the 10 names in [settings.js](settings.js) – that’s plaintext and easy to search.
- **Toggle only** in settings: one flag (e.g. `easter_eggs_competition_showing: true`) in [settings.js](settings.js) or in Strapi. This is fine in plaintext; it doesn’t reveal the names.
- **Names in [main.js](main.js)** as a single obfuscated value, decoded at runtime only when the flag is true:
  - Store as **base64-encoded JSON** (e.g. `atob('WyJDaHVyY2hpbGwiLC...')` then `JSON.parse`), or
  - Array of base64 strings, or
  - Character-code array decoded in JS.
- **No** separate `easter-eggs.js` unless you want to lazy-load it only when the flag is true (adds a tiny bit of obscurity). Prefer one obfuscated structure in main.js and a single `if (!easterEggsEnabled) return;` at the top of the Easter-egg init so when the flag is false, the rest of the code never runs and the list is never decoded in practice.

Result: view source and settings show no list; only when the toggle is on does the script decode and inject.

---

## 3. Toggle

- **Setting:** `easter_eggs_competition_showing: true` (or `false` when competition ends).
- Read via existing [getSettings()](main.js) (extend it to include this key). If false, the Easter-egg module does nothing: no decoding, no placeholders, no tooltips, no injected text.

---

## 4. Placement map (10 names, JS-injected)

All injection happens in one Easter-egg init in [main.js](main.js) that runs after DOM ready and only when `easter_eggs_competition_showing` is true. No names in [index.html](index.html).

**Form placeholders:** When competition is on, **communicators replace the random stars entirely** (no star placeholders). Different name per form is fine (e.g. book-call → one name, website-review → another). When competition is off, keep current random-star behaviour. **Do not use the cookie bar** – too hard to get back once dismissed.


| #   | Location                       | Mechanism                                                                                                                                                                                                                                                                                              | Notes                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Form name placeholders**     | One **fixed** name for all forms (e.g. David Ogilvy). When competition is on, override the existing placeholder logic: set all `input[name="name"]` placeholders to `e.g. [Name]` (static, not rotating). When off, keep current behaviour (e.g. random stars / “Jennifer Coolidge”).                  | [main.js](main.js) currently has `applyRandomStarPlaceholders()`; add a branch: if competition on, use the single “placeholder name” from the list instead of random star.                                                                                                                                   |
| 2   | **Rescue kit eyebrow**         | 5-second hover on `#rescue .eyebrow` → show tooltip: “Why not let us turn your shit to Shakespeare?!”                                                                                                                                                                                                  | Use a timer on `mouseenter` / `mouseleave`; tooltip via `title` or a small positioned div. Shakespeare is a natural fit here.                                                                                                                                                                                |
| 3   | **Thank-you (success) screen** | After any form submit, when showing the success screen, append a short line to the message (e.g. “P.S. [Name] would approve.”).                                                                                                                                                                        | [showSuccessScreen(panel, message)](main.js) builds HTML; when competition is on, append a second line (or inject the name into the message). Server can keep returning the same message; client appends the Easter-egg line so it’s not in view source.                                                     |
| 4   | **Tom’s photo (Your guide)**   | Hover on Tom’s image → tooltip/title with a name (e.g. “Inspired by Ogilvy” or just the name).                                                                                                                                                                                                         | Target the img in `#guide` (e.g. `section#guide img` or add a stable class). Set `title` or use a small custom tooltip on hover.                                                                                                                                                                             |
| 5   | **T&Cs**                       | Inject one name into a clause. E.g. in the T&C content (panel `#terms` / `.app-modal__privacy-body`), append or insert a sentence like: “As Cicero said, clarity is the first virtue of persuasion.”                                                                                                   | Find a suitable paragraph (e.g. “Scope of work” or “Who we are”); inject a `<p>` or a phrase via JS so it reads naturally. Only when competition is on.                                                                                                                                                      |
| 6   | **Dark mode only**             | One name visible only when `html.dark-mode` is present. E.g. append a small span to an existing paragraph (footer or “How it feels” subhead) with text like “— [Name]”. CSS: `.easter-egg-attribution-dark { display: none; }` and `html.dark-mode .easter-egg-attribution-dark { display: inline; }`. | Content set by JS; class toggles visibility. Good candidate: near the Maya Angelou quote so the “dark only” name feels thematic.                                                                                                                                                                             |
| 7   | **Deliverable expandable**     | When a user expands one specific item (e.g. “Core Messaging Handbook” or “A welcome email”), append a congruous sentence that includes a name. E.g. “In the spirit of [Name], we keep it clear and persuasive.”                                                                                        | Hook into the existing feature-toggle expand (e.g. [main.js](main.js) or the handler that shows `feature-description`). When the chosen panel is shown, append a `<p>` or sentence to that panel’s content once. Congruous: “Core Messaging Handbook” (feature-desc-6) or “A welcome email” (addon1-desc-5). |
| 8   | **FAQ**                        | When one specific FAQ is expanded, inject a sentence containing a name into the answer. E.g. “Why is it SO HARD to do this myself?” → append “As [Name] put it, perspective is everything.”                                                                                                            | Target one FAQ panel in `#faq-list`; on first expand, append text to the `.faq-panel` content.                                                                                                                                                                                                               |
| 9   | **Hero eyebrow**               | E.g. long-hover on hero eyebrow, or a tiny hint in footer (e.g. hover on “All rights reserved” or a specific word).                                                                                                                                                                                    | Tooltip after 1s hover.                                                                                                                                                                                                                                                                                      |
| —   | **T&Cs (existing)**            | **Tom Waits** is already in plain text on the T&Cs page. Stays there; no injection. Counts as one of the 10 finds. No slot 10.                                                                                                                                                                         | Tom Waits                                                                                                                                                                                                                                                                                                    |


Deliverable and FAQ suggestions for “congruous”:

- **Deliverable:** “Core Messaging Handbook” (`#feature-desc-6`) – fits “single source of truth” and clarity; append something like “We aim for the clarity that [Name] brought to [their domain].”
- **FAQ:** “Why is it SO HARD to do this myself?” – the answer already talks about perspective; appending “As [Name] might say, …” fits.

---

## 4b. Placements and copy you can tinker with

Keep all **editable copy** in one place in main.js (e.g. an object `EASTER_EGG_COPY`). The code injects `[Name]` from the decoded list; you only change the surrounding words. Names stay obfuscated; copy is easy to find and edit.


| Slot | DOM target                                                  | Copy template (you edit; `[Name]` = injected)                                                                                                | Suggested name      |
| ---- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1a   | Book-a-call form – name placeholder                         | `e.g. [Name]`                                                                                                                                | David Ogilvy        |
| 1b   | Website-review form – name placeholder                      | `e.g. [Name]`                                                                                                                                | Seth Godin          |
| 1c   | Lead-magnet forms – name placeholders                       | `e.g. [Name]` (one per form)                                                                                                                 | Brené Brown         |
| 2    | `#rescue .eyebrow` – tooltip after 1s hover                 | `Why not let us turn your shit to Shakespeare?`                                                                                              | William Shakespeare |
| 3    | Success screen – line below message                         | `P.S. Broad, sunlit uplands, here we come. As [Name] may have put it.`                                                                       | Churchill           |
| 4    | `#guide img` (Tom's photo) – title on hover                 | `Not exactly [Name]. But I've come a long way.`                                                                                              | David Ogilvy        |
| 5    | T&Cs `#terms .app-modal__privacy-body` – one sentence       | `As [Name] said, clarity is the first virtue of persuasion.`                                                                                 | Cicero              |
| 6    | "How it feels" subhead – attribution only                   | Quote stays visible. Attribution `~ [Name] (not a client)` in light text so it's only readable in dark mode (invisible/light in light mode). | Maya Angelou        |
| 7    | `#feature-desc-6` (Core Messaging Handbook) – when expanded | `In the spirit of [Name], we keep it clear and persuasive.`                                                                                  | Eugene Schwartz     |
| 8    | FAQ "Why is it SO HARD..." – 3rd FAQ panel, when expanded   | `As [Name] put it, perspective is everything.`                                                                                               | MLK Jr.             |
| 9    | `.hero-eyebrow` – tooltip after 1s hover                    | `[Name] knew a thing or two about messaging.`                                                                                                | Rory Sutherland     |
| —    | **T&Cs (existing text)**                                    | Tom Waits is already attributed on the T&Cs page; no copy to inject. Counts as one of the 10 finds.                                          | Tom Waits           |


**In code:** One config object for copy (e.g. `rescueEyebrowTooltip`, `successAppend`, …) and **timing** in the same place (e.g. `rescueEyebrowDelaySec: 1`, `heroEyebrowDelaySec: 1`). Change delay in one place in main.js; no hunting in the logic. Default hover delay: **1s** (more discoverable than 5s).

---

## 5. Implementation sketch (no code changes in this plan)

- **Single module in main.js:** e.g. `initEasterEggs()`.
  - If `!getSettings().easter_eggs_competition_showing` → return.
  - Decode the list once (from the obfuscated form).
  - Assign each of the 10 names to a “slot” (placeholder, rescue tooltip, success line, Tom pic, T&C, dark-only, deliverable, FAQ, etc.).
  - **Placeholders:** When competition is on, **replace** the random-star logic entirely: call a communicator-based placeholder function instead of `applyRandomStarPlaceholders()`. Assign one communicator per form (or rotate from the 10) so different forms can show different names.
  - **Rescue eyebrow:** `#rescue .eyebrow` – `mouseenter` start 1s timer (delay in config), `mouseleave` clear it; on fire, show tooltip “Why not let us turn your shit to Shakespeare?!”.
  - **Success screen:** In `showSuccessScreen`, if competition on, append a line with the assigned name (e.g. “P.S. [Name] would approve.”).
  - **Tom’s pic:** Query `#guide img` (or the section’s image), set `title` or attach a hover tooltip with the name.
  - **T&Cs:** Query the terms panel body, insert a paragraph (or sentence) containing the name in a natural clause.
  - **Dark-only:** "How it feels" subhead: quote always visible; attribution in a span with class `easter-egg-attribution-dark`, append to a chosen node (e.g. “How it feels” subhead or footer); CSS in [styles.css](styles.css) for `html.dark-mode .easter-egg-attribution-dark`.
  - **Deliverable:** On expand of the chosen feature (e.g. `#feature-desc-6` or `#addon1-desc-5`), append one sentence with the name.
  - **FAQ:** On expand of the chosen FAQ, append one sentence with the name.
- **CSS:** Attribution span: default (light mode) very light/transparent so attribution blends; `html.dark-mode` gives it readable color. Optional: style for 1s tooltip and success-message line.

---

## 6. Security / “sneaky” summary

- Names **never** in HTML or in [settings.js](settings.js).
- Names in [main.js](main.js) in obfuscated form (e.g. base64 JSON); decode only when flag is true.
- All visible names are created in the DOM by JS (innerHTML/textContent), so view source stays clean.
- When the competition ends, set `easter_eggs_competition_showing: false`; no names are decoded or shown.

---

## 7. Files to touch (when you implement)

- **[settings.js](settings.js)** (or Strapi): add `easter_eggs_competition_showing: true`.
- **[main.js](main.js):** extend `getSettings()` for the flag; add obfuscated list and `initEasterEggs()`; wire placeholder logic, rescue-eyebrow timer, success-screen append, Tom pic, T&C inject, dark-only span, deliverable expand, FAQ expand; call `initEasterEggs()` on DOM ready.
- **[styles.css](styles.css):** `.easter-egg-attribution-dark` and optional tooltip/success styling.
- **Strapi** (if you use it for settings): add the same boolean field and surface it in the same way as other toggles so `load-cms.js` / applySettings keep working.

No changes to server responses required if you keep the success message unchanged and do the “P.S. [Name] would approve” append only on the client.