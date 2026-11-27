# Sprout, the demo app

[← Wion-Pilot](../README.md)

Sprout is a small, made-up plant-care app (`apps/sprout`). It exists to show flows that are often tested only by hand:

- **Offline mode.** Every change is saved in the browser first (an outbox in IndexedDB) and sent when the connection is there. A banner always says **Offline**, **Syncing** or **Synced**, and changes that have not reached the server show "Not synced yet".
- **Two people editing the same plant.** Each plant has a version number. When two edits meet, Sprout compares them field by field: fields only one person changed are combined automatically, and equal values are not a conflict. Only fields both people changed to different values are shown on a conflict screen, side by side ("Yours" and "Latest (Ben)"), for the user to choose.
- **Watering reminders.** Each plant says when to water it next, counted in calendar days from its last watering, and a **Watered** button starts the count again. Tests fix "today" with Playwright's clock.
- **No silent data loss.** A change is never dropped: it waits in the outbox, or it waits for a decision. Signing out is blocked while changes are still waiting.

## Try Sprout

Start it with `npm run demo` and open http://localhost:4600. The two demo users are made up:

| User | Email | Password |
| --- | --- | --- |
| Ava | `ava@sprout.test` | `sprout-ava` |
| Ben | `ben@sprout.test` | `sprout-ben` |

**Watering reminders**

Each plant says when it needs water next: "Water in 3 days", "Water tomorrow", "Water today" or "2 days overdue". **Watered** starts the count again from today, also offline. If two people water the same plant, the later day simply wins; it is never a conflict. A fresh demo (`npm run demo:reset`) always shows a mix, because the seed's waterings are moved to the current date.

**Offline mode**

1. Sign in as Ava. The banner says **Synced**.
2. Open the browser's DevTools, Network tab, and choose **Offline**. The banner says **Offline**.
3. Edit a plant or add one. It shows "Not synced yet", and Sign out is blocked.
4. Switch the network back to **No throttling**. The banner goes to **Syncing**, then **Synced**.

Reloading the page while offline is not supported yet (that needs a service worker, planned for later).

**A conflict**

1. Sign in as Ava in a normal window and as Ben in a private window.
2. Both open the same plant with **Edit**.
3. Ben changes the name and saves. Ava changes the name to something else and saves.
4. Ava sees the conflict screen with only the **Name** field. If they had changed different fields, both changes would simply be kept.

`npm run demo:reset` brings the seed data back at any time.
