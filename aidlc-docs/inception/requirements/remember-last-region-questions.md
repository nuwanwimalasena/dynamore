# Requirements Clarification: Remember Last Selected Region

Please answer the following questions to help clarify the feature requirements and behavioral expectations. Fill in your choice directly after each `[Answer]:` tag.

---

## Question 1
Across which contexts should the last selected region be remembered and restored?

A) Globally across both the Login Page (pre-filling initial region for SSO and Access Keys forms) and the Main Application header switcher when logged in.

B) Only in the Main Application when logged in (active session region switching).

C) Only on the Login Page (pre-filling the default region dropdown when opening the app).

D) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 2
When a user explicitly switches the region from the top header switcher during an active session, what should happen on subsequent app launches or re-logins?

A) The switched region becomes the persistent default for future sessions and pre-selects that region in the login screen.

B) The switched region only applies while the current session lasts; newly authenticated sessions always start with the initial configured login region.

C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 3
Where should the last selected region preference be stored?

A) In Tauri's native persistent store (`dynamore-config` via `tauri-plugin-store`), so it persists reliably across restarts on all desktop platforms alongside SSO config.

B) In browser `localStorage` in the frontend web layer.

C) Synchronized across both Tauri native store and frontend store.

D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 4
When the user clicks the "Reset" button on the SSO login form or logs out, should the remembered region be preserved or reset back to default `us-east-1`?

A) Preserve the remembered region (reset only clears credentials, account, and role selections).

B) Reset the region back to `us-east-1` as well.

C) Other (please describe after [Answer]: tag below)

[Answer]: A
