# React conversion — E2E browser checklist (UI1–UI25)

Source of truth: `docs/react-conversion-contract.md` §4 (acceptance criteria), §6 (risks R3/R4) and
§8 (approved decisions; Q1 → `aria-invalid="true"`). Run this checklist **only on the merged result**
(phase 4). Use Orca's embedded browser (`orca-cli` skill) and take one screenshot per criterion into
the slot shown. Never mark a step PASS unless it was observed in the browser.

Legend: `[ ]` not run · `[x]` pass · `[!]` fail (add repro steps under the item). "Eval" means
reading the DOM with the browser's JS console or the Orca browser eval command; it must only
**read** state, except where a step explicitly says to change an attribute to provoke an error.

---

## 0. Setup

1. `git log --oneline -1` — record the merged commit hash: `________`
2. `npm ci`
3. `npm run typecheck && npm test && npm run build` — record each result (needed for UI24).
4. Use a throwaway DB and start empty: `rm -f /tmp/e2e-react.db`. `data/todos.db` must never be touched.
5. Start the dev servers as **two separate** processes so the API can be stopped on its own for
   the failure steps (the Vite proxy in `vite.config.ts` forwards `/api` to `127.0.0.1:3000`, so the
   API must listen on port 3000):
   - API: `DB_FILE=/tmp/e2e-react.db npx tsx server/index.ts` → "Todo app listening on http://127.0.0.1:3000"
   - Web: `npx vite` → http://localhost:5173

   This is equivalent to `DB_FILE=/tmp/e2e-react.db npm run dev`, except that `concurrently -k`
   would also kill Vite when the API stops.
6. Open http://localhost:5173 in the Orca browser. Viewport ≥ 800px wide.

Helper (eval) used below to dump tab state:

```js
[...document.querySelectorAll('#tabs [role="tab"]')].map(t => [t.id, t.getAttribute('aria-selected'), t.tabIndex]);
[...document.querySelectorAll('[role="tabpanel"]')].map(p => [p.id, p.hidden]);
```

---

## Document and tabs

### UI1 — document, title, single `<main>`
- [ ] Steps: load the page; eval `document.documentElement.lang`, `document.title`,
  `document.querySelectorAll('main').length`, `document.querySelector('#root > main') !== null`.
- Expected: `"en"`, `"Todos"`, `1`, `true`; `#tabs` and all four panels are inside that `<main>`
  (`document.querySelector('main').contains(document.getElementById('panel-3'))` → `true`).
- Screenshot: `ui01-document.png` — ______

### UI2 — tablist markup
- [ ] Steps: eval
  `const tl = document.getElementById('tabs'); [tl.tagName, tl.getAttribute('role'), tl.getAttribute('aria-label')]`
  and `[...tl.children].map(b => [b.tagName, b.type, b.getAttribute('role'), b.id, b.textContent, b.getAttribute('aria-controls')])`.
- Expected: `["DIV","tablist","Sections"]` and exactly 4 children in this order:

  | # | tag | type | role | id | text | aria-controls |
  |---|---|---|---|---|---|---|
  | 1 | BUTTON | button | tab | `tab-todos` | Todos | `panel-todos` |
  | 2 | BUTTON | button | tab | `tab-1` | Tab 1 | `panel-1` |
  | 3 | BUTTON | button | tab | `tab-2` | Tab 2 | `panel-2` |
  | 4 | BUTTON | button | tab | `tab-3` | Tab 3 | `panel-3` |
- Screenshot: `ui02-tablist.png` — ______

### UI3 — initial tab state
- [ ] Steps: fresh load (no clicks); run the helper; also `getAttribute('tabindex')` on each tab.
- Expected: `tab-todos` → `aria-selected="true"`, tabIndex `0`; `tab-1/2/3` → `aria-selected="false"`
  and `tabindex="-1"`. `panel-todos` not hidden; `panel-1/2/3` have the `hidden` attribute
  (`hasAttribute('hidden')` → `true`) and are not visible. Visually the "Todos" tab has the accent
  underline and bold text.
- Screenshot: `ui03-initial-tabs.png` — ______

### UI4 — panels
- [ ] Steps: eval
  `[...document.querySelectorAll('section[role="tabpanel"]')].map(p => [p.id, p.getAttribute('aria-labelledby')])`
  and for each of `#btn-a/#btn-b/#btn-c`: `[b.tagName, b.type, b.textContent, b.closest('section').id]`.
- Expected: `[["panel-todos","tab-todos"],["panel-1","tab-1"],["panel-2","tab-2"],["panel-3","tab-3"]]`;
  `#btn-a` "A" in `panel-1`, `#btn-b` "B" in `panel-2`, `#btn-c` "C" in `panel-3`, all `type="button"`,
  clicking them does nothing. `#panel-todos` contains `h1` "Todos", `#add-form`, `#status`, `#empty`,
  `#list` in that order.
- Screenshot: `ui04-panels.png` (after clicking Tab 1 so "A" is visible) — ______

### UI5 — clicking selects a tab
- [ ] Steps: click "Tab 2"; run helper. Click "Tab 1"; run helper. Click "Todos"; run helper.
- Expected each time: clicked tab `aria-selected="true"`, tabIndex 0; all others `"false"`, -1; only
  the matching panel is visible and the other three have `hidden`. Button "B" visible only on Tab 2.
- Screenshot: `ui05-click-tab2.png` — ______

### UI6 — arrow keys with wrap
- [ ] Steps:
  1. Click "Todos" (focus on `#tab-todos`). Press **ArrowRight** three times; after each press check
     `document.activeElement.id` and the helper: `tab-1`, `tab-2`, `tab-3` are selected and focused in turn.
  2. Press **ArrowRight** once more → wraps to `tab-todos` (selected, focused, `panel-todos` shown).
  3. Press **ArrowLeft** → wraps to `tab-3` (selected, focused, `panel-3` shown).
  4. Press **ArrowLeft** → `tab-2`.
  5. Press **Home**, **End**, **ArrowUp**, **ArrowDown** → nothing changes (`tab-2` still selected and focused).
  6. preventDefault: eval
     `document.getElementById('tab-2').addEventListener('keydown', e => setTimeout(() => console.log('dp', e.key, e.defaultPrevented)), {once:true})`,
     then press ArrowRight → console logs `dp ArrowRight true`. Repeat on the now-focused tab with
     ArrowLeft → `true`. Repeat with Home → `dp Home false`.
- Expected: as above; the amber `:focus-visible` ring is on the focused tab.
- Screenshot: `ui06-wrap-left-tab3.png` (state after step 3) — ______

### UI7 — todos panel state survives tab switching
- [ ] Steps: on Todos, ensure ≥1 todo exists; type `draft text` in `#new-title` (do not submit) and
  pick a date in `#new-due`. Clear the Network log. Click "Tab 3", then "Todos".
- Expected: `#new-title` still `draft text`, `#new-due` still the picked date, list unchanged; no new
  `GET /api/todos` request while switching (the panel was not remounted).
- Screenshot: `ui07-state-kept.png` — ______

---

## Add form

### UI8 — form markup
- [ ] Steps: eval
  ```js
  const f = document.getElementById('add-form');
  [f.tagName, f.noValidate, f.hasAttribute('novalidate'),
   [...f.querySelectorAll('label, .row, input, button, #form-error')].map(e => e.outerHTML.slice(0, 180))]
  ```
- Expected, in DOM order:
  1. `<label for="new-title">New todo</label>`
  2. `<div class="row">` containing `<input id="new-title" name="title" type="text" maxlength="200" autocomplete="off" aria-describedby="form-error">` then `<button type="submit">Add</button>`
  3. `<label for="new-due" class="due-label">Due date (optional)</label>`
  4. `<input id="new-due" name="dueDate" type="date" aria-describedby="form-error">`
  5. `<p id="form-error" class="error" hidden>` with empty text

  `FORM`, `noValidate === true`, `novalidate` attribute present. Neither input has `aria-invalid` initially.
- Screenshot: `ui08-form.png` — ______

### UI9 — empty / whitespace title
- [ ] Steps: open the Network panel. With `#new-title` empty click **Add**. Then type three spaces and
  press **Enter**.
- Expected each time: `#form-error` visible with exactly `Please enter a todo.`; `#new-title` and
  `#new-due` both have `aria-invalid="true"` and a red border; `document.activeElement.id === "new-title"`;
  **no** `POST /api/todos` request was sent.
- Screenshot: `ui09-empty-error.png` — ______

### UI10 — valid add
- [ ] Steps: first make `#status` show a message (e.g. a failed toggle per UI18 B, then restart the
  API). Type `  Buy milk  `, pick `2030-01-15` in `#new-due`, click **Add**. Then add `No date` with
  an empty date (press Enter).
- Expected: `#status` becomes hidden and empty when the submit starts; request payloads (Network →
  Payload) are exactly `{"title":"Buy milk","dueDate":"2030-01-15"}` and `{"title":"No date","dueDate":null}`;
  each new `li` is appended **at the end** of `#list`; both inputs are cleared; focus is on
  `#new-title`; `#form-error` is hidden; no `aria-invalid` on either input.
- Screenshot: `ui10-added.png` — ______

### UI11 — create failure
- [ ] A. Server error: eval `document.getElementById('new-title').removeAttribute('maxlength')`, then
  paste 201 characters (`'x'.repeat(201)`, copied to the clipboard) into `#new-title`, pick a date,
  click **Add**.
  Expected: `#form-error` shows exactly `Title must be 200 characters or fewer.`; `#status` stays
  hidden; both inputs keep their values and have `aria-invalid="true"`; focus on `#new-title`; list
  unchanged; POST returned 400. (If React re-applies `maxlength` before the paste, record that and
  verify this message in the production run instead.)
- [ ] B. Unreachable API: stop the **API** process only. Type `Offline todo`, click **Add**.
  Expected: an error text appears in `#form-error` (not in `#status`); inputs keep their values with
  `aria-invalid="true"`; focus on `#new-title`. Record the exact text: through the Vite proxy the
  fetch usually resolves with a 5xx, so `Request failed (5xx).` is acceptable here; the exact
  `Could not reach the server. Check your connection and try again.` is checked in UI25 step 7.
  Restart the API.
- Note: the "Could not add todo." non-Error fallback cannot be produced from the browser without
  patching code; it is covered by QA jsdom tests. Mark that sub-item N/A.
- Screenshots: `ui11a-too-long.png`, `ui11b-offline.png` — ______

### UI12 — editing clears the error
- [ ] Steps: provoke the UI9 error, then type one character in `#new-title`. Provoke it again, then
  change only `#new-due`.
- Expected: after each edit `#form-error` has `hidden` and neither input has an `aria-invalid`
  attribute (`hasAttribute('aria-invalid') === false`); red borders gone.
- Screenshot: `ui12-cleared.png` — ______

### UI13 — aria-invalid value and styling
- [ ] Steps: provoke the UI9 error; eval
  `['new-title','new-due'].map(id => document.getElementById(id).getAttribute('aria-invalid'))` and
  `getComputedStyle(document.getElementById('new-title')).borderTopColor`. Type a character and repeat.
- Expected: while the error shows → `["true","true"]` (Q1) and border colour `rgb(185, 28, 28)`
  (`--danger`); after editing → `[null,null]` and the normal grey (`#888`) border.
- Screenshot: `ui13-aria-invalid.png` — ______

---

## Status and empty

### UI14 — `#status`
- [ ] Steps: eval
  `const s = document.getElementById('status'); [s.tagName, s.getAttribute('role'), s.getAttribute('aria-live'), s.className, s.hidden, s.textContent]`.
  Stop the API, then one at a time: toggle a checkbox, change a due date, click Delete; read
  `#status` after each. Restart the API and perform a successful toggle.
- Expected: initially `["P","status","polite","error",true,""]`. Each failed action shows an error
  in `#status` (visible, red, bold) and the previous message is cleared when the next action starts;
  after the successful toggle `#status` is hidden and empty. Failed load is checked in UI15 C. The
  "Something went wrong." non-Error fallback is jsdom-only (N/A here).
- Screenshot: `ui14-status-error.png` — ______

### UI15 — `#empty`
- [ ] A. Empty DB: stop the API, `rm -f /tmp/e2e-react.db`, restart it, reload.
  Expected: `#empty` visible with exactly `No todos yet. Add one above.`; `#list` has no `li`.
- [ ] B. While loading: throttle the network to "Slow 3G" (or stop the API, reload, observe, then
  restart and reload) — while `GET /api/todos` is pending, `#empty` is hidden.
- [ ] C. Failed load: stop the API, reload. Expected: `#empty` hidden, `#status` shows the error.
  Restart the API.
- [ ] D. Add a todo → `#empty` hidden. Delete it → `#empty` visible again.
- Screenshots: `ui15a-empty.png`, `ui15c-failed-load.png` — ______

---

## List and items

Seed data for this section (add through the UI in this order; "today" = the machine's local date):
1. `Past due` — due date = yesterday
2. `Future` — due date = 2030-01-15
3. `No date` — no date
4. `<img src=x onerror=alert(1)>` — no date

### UI16 — list and item markup
- [ ] Steps: eval
  ```js
  const l = document.getElementById('list');
  [l.tagName, l.getAttribute('aria-label'), [...l.children].map(li => [li.tagName, ...[...li.children].map(c => c.outerHTML.slice(0, 160))])]
  ```
- Expected: `UL`, `Todo list`; every child is an `LI` whose children are, in order:
  1. `<input type="checkbox" id="todo-{id}">`
  2. `<label for="todo-{id}">{title}</label>`
  3. only for overdue items: `<span class="badge overdue-badge">Overdue</span>`
  4. `<input type="date" id="due-{id}" class="due" aria-label="Due date for &quot;{title}&quot;">`, `.value` = dueDate or `""`
  5. `<button type="button" class="delete" aria-label="Delete &quot;{title}&quot;">Delete</button>`

  Item order equals the `GET /api/todos` response order (Network → Response). Clicking a label toggles
  its checkbox.
- Screenshot: `ui16-list.png` — ______

### UI17 — `done` / `overdue` classes and badge
- [ ] Steps: eval
  `[...document.querySelectorAll('#list li')].map(li => [li.querySelector('label').textContent, li.className, !!li.querySelector('.overdue-badge')])`.
  Check `Past due`, re-run; uncheck it, re-run. Set `Future`'s date to today, re-run; to yesterday, re-run.
- Expected: `Past due` → `overdue` + badge; `Future`, `No date`, the xss title → empty/absent class,
  no badge. Checked `Past due` → `done` only, no badge, struck-through label. Due today → not
  overdue. Due yesterday → `overdue`, badge, red left border.
- Screenshot: `ui17-classes.png` — ______

### UI18 — toggle checkbox
- [ ] A. Success: click `Future`'s checkbox → checked immediately; `PATCH /api/todos/{id}` payload
  `{"completed":true}`; `li` gets `done`. Click again → `{"completed":false}`, `done` removed.
- [ ] B. Optimistic + revert: throttle to "Slow 3G" and click a checkbox — it shows the new state
  before the response arrives. Remove throttling, stop the API and click a checkbox: it flips, then
  reverts to its previous state; `#status` shows the error. Restart the API.
- Screenshot: `ui18-toggle-revert.png` — ______

### UI19 — due-date edit, including keyboard entry (risk R3)
- [ ] A. Picker: on `No date`, choose a date with the date picker → exactly one
  `PATCH {"dueDate":"YYYY-MM-DD"}`; overdue state and badge update.
- [ ] B. **Keyboard entry (R3)**: in Network filter on `PATCH` and clear the log. Focus `#due-{id}` of
  `Future` and type a full date digit by digit with the keyboard (e.g. for 2029-01-02 in an
  MM/DD/YYYY locale: `0`,`1`,`0`,`2`,`2`,`0`,`2`,`9`), then press **Tab**.
  Expected: **no** PATCH carries an intermediate year such as `0002-…`, `0020-…` or `0202-…`; the
  last PATCH payload is `{"dueDate":"2029-01-02"}`; record how many PATCHes were sent. After reload
  the input shows 2029-01-02.
- [ ] C. Clear: clear the date (select each segment and press Backspace, or the picker's Clear) →
  `PATCH {"dueDate":null}`; input value `""`; no badge.
- [ ] D. Failure: stop the API, change a date → the input reverts to the previous server value;
  `#status` shows the error. Restart the API.
- Screenshots: `ui19b-keyboard-network.png`, `ui19d-revert.png` — ______

### UI20 — delete
- [ ] A. Click Delete on `No date` → `DELETE /api/todos/{id}` returns 204; the `li` disappears.
- [ ] B. Failure: stop the API, click Delete on another item → the `li` stays; `#status` shows the
  error. Restart the API.
- [ ] C. Delete all remaining items → `#empty` visible.
- Screenshot: `ui20-delete.png` — ______

### UI21 — titles rendered as text
- [ ] Steps: with the `<img src=x onerror=alert(1)>` todo present, eval
  `document.querySelectorAll('#list img').length` and that label's `textContent`; terminal:
  `grep -rn "dangerouslySetInnerHTML\|innerHTML" src`.
- Expected: the literal text `<img src=x onerror=alert(1)>` is visible; `0` images; no alert dialog;
  delete button `aria-label` is `Delete "<img src=x onerror=alert(1)>"`; grep finds nothing.
- Screenshot: `ui21-xss-literal.png` — ______

### UI22 — initial load and StrictMode (risk R4)
- [ ] Steps: with exactly 3 todos stored, open Network and hard-reload the dev page (StrictMode is on
  in dev). Repeat the reload 3 times.
- Expected: `GET /api/todos` is sent (two GETs are acceptable in dev StrictMode);
  `document.querySelectorAll('#list li').length === 3` every time — **no duplicates**;
  `new Set([...document.querySelectorAll('#list input[type=checkbox]')].map(c => c.id)).size === 3`;
  the console shows no React warnings (duplicate `key`, state update after unmount).
- Screenshot: `ui22-no-duplicates.png` (list + Network panel) — ______

---

## Styling and build

### UI23 — visual appearance unchanged
- [ ] Steps: with one done, one overdue and one plain todo, eval
  ```js
  ['main','.row','.due-label','#new-due','li.done','li.overdue','.badge','.overdue-badge','button.delete',
   'li input.due','input[type="checkbox"]','[role="tablist"]','[role="tab"][aria-selected="true"]','[hidden]','.error']
   .map(s => [s, document.querySelectorAll(s).length])
  ```
- Expected: every count ≥ 1; `[role="tab"][aria-selected="true"]` exactly 1; `[hidden]` ≥ 3 with
  Todos active. Layout: centred 36rem column; input and Add button on one row; red "Overdue" pill;
  struck-through done label; red left border on the overdue `li`; amber focus ring. If possible,
  compare with a screenshot of the pre-conversion app at commit `88172c0`.
- Screenshot: `ui23-visual.png` — ______

### UI24 — code and checks (terminal)
- [ ] `npm run typecheck` · `npm test` (both node and dom projects run, all green) · `npm run build` → all pass.
- [ ] `grep -rnwE "any|interface" src` → no `any` type and no `interface` (review matches; words in
  strings/comments are fine).
- [ ] `grep -rn "extends.*Component" src` → none (function components and hooks only).
- [ ] `git diff 88172c0 -- server tests/api.test.ts tests/acceptance` → empty.
- Record outputs: ______

### UI25 — production build serves the React app; data persists
- [ ] Steps:
  1. Stop the dev servers. `npm run build` → pass; `dist/index.html` exists and loads a hashed
     `assets/*.js`.
  2. Pick a free port:
     `PORT=$(node -e "const s=require('net').createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})")`.
  3. `rm -f /tmp/e2e-react.db && NODE_ENV=production DB_FILE=/tmp/e2e-react.db PORT=$PORT npx tsx server/index.ts`.
     `server/index.ts` serves `dist/` **only** when `NODE_ENV=production` (without it `/` returns a
     404 JSON). `npm start` does the same on port 3000; the free port avoids clashes.
  4. Open `http://127.0.0.1:$PORT/`. Expected: the React app renders (title "Todos", `#root > main`,
     4 tabs) and `#empty` is visible.
  5. Add `Persist me` (due yesterday) and `Second` (no date); check `Second`.
  6. **Reload** → both todos still there, same order, `Second` checked with `done`, `Persist me`
     overdue with badge. Stop and restart the server (same `DB_FILE`), reload → still there.
  7. Stop the server and, without reloading, submit `Offline` → `#form-error` shows exactly
     `Could not reach the server. Check your connection and try again.`; restart the server.
  8. Smoke the tabs on the production build: click Tab 2, then ArrowRight → Tab 3, ArrowRight → Todos.
- Screenshots: `ui25-prod-before-reload.png`, `ui25-prod-after-reload.png` — ______

---

## Cleanup
- [ ] Stop every server started (API, Vite, production) by PID and confirm the ports are free.
- [ ] `rm -f /tmp/e2e-react.db`; `git status` shows no change to `data/` or any tracked file.

## Result table (fill in when run)

| Criterion | Result | Screenshot | Notes / repro |
|---|---|---|---|
| UI1 | | | |
| UI2 | | | |
| UI3 | | | |
| UI4 | | | |
| UI5 | | | |
| UI6 | | | |
| UI7 | | | |
| UI8 | | | |
| UI9 | | | |
| UI10 | | | |
| UI11 | | | |
| UI12 | | | |
| UI13 | | | |
| UI14 | | | |
| UI15 | | | |
| UI16 | | | |
| UI17 | | | |
| UI18 | | | |
| UI19 (incl. R3) | | | |
| UI20 | | | |
| UI21 | | | |
| UI22 (R4) | | | |
| UI23 | | | |
| UI24 | | | |
| UI25 | | | |
