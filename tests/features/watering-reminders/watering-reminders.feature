# Drafted by claude/claude-opus-5-5 on 2026-11-26, approved with wion review on 2026-11-26.
# Edited by a person on 2026-11-26: kept the 5 scenarios that reminders.feature does not cover
# already, renamed the feature, and added a missing step to two scenarios (marked "Fixed").
# Missing steps (not used below; a person writes them first):
#   - "Then {word} cannot mark the test plant watered again": Checks that the Watered button for the test plant is disabled after it was marked watered on the same day.
#   - "When {word} sends the test plant with last watered {string}": Sends a plant save with a missing or impossible watering day, for example "2026-02-30" or "yesterday", to check that the server rejects it with the message 'Last watered must be a day like 2026-06-15.'
#   - "Given the test plant was saved on {string} without a last watering day": Sets up old data from before reminders existed, to check that the plant counts as watered on the day it was last saved.
#   - "When the demo data is reset": Resets to the seed data, to check that seed watering days are moved to today and the list shows a mix of due, overdue and upcoming plants.
#   - "Given marking plants watered fails": Makes saving a watering fail, to check that the list shows 'Could not mark <plant> watered' as an alert.
#   - "Given it is {string} at {string} on {word}'s device": Sets the device clock to a time near midnight or in another time zone, to check that reminders use the device's local calendar day.
@ai-drafted
Feature: Watering reminders: more cases
  Each plant in the list says when it needs water next, counted from its last watering day and its watering interval. A Watered button marks a plant watered today and starts the count again. This also works offline and when two people change the same plant.

  What changed: Plants now remember the day they were last watered. The plant list shows a reminder under each plant: 'Water in N days', 'Water tomorrow', 'Water today' or 'N days overdue'. Due plants and overdue plants are shown in a different colour. A new Watered button next to Edit marks the plant watered on the person's own calendar day. The button cannot be pressed again on the same day. Marking a plant watered is saved like any other edit: first on the device, then synced, so it works offline. If two people's changes meet, the later watering day always wins and nobody is asked to choose; the conflict screen can still show this field. A new plant counts as watered on the day it is added. Editing a plant keeps its watering day. Old data without a watering day counts as watered on the day the plant was last saved. Demo and seed data have their watering days moved to the real today, so a fresh demo shows a mix of due, overdue and upcoming plants. Things this could affect: saving and validating plants (the server now rejects a missing or invalid watering day), conflict merging, sync of queued offline edits, demo reset, and loading existing data files.

  Test plan:
  - Reminder text for every case: upcoming, tomorrow, today, 1 day overdue, several days overdue.
  - Marking a plant watered updates the reminder and stores today's day on the server.
  - Watered button is disabled after watering on the same day (needs a new step).
  - Offline: watering is shown as not synced, the server is unchanged, and it syncs when back online; sign-out is blocked while the watering is unsent.
  - Two people: one person waters offline while the other edits another field; both changes survive.
  - Two people water on different days: the later day wins and no conflict question is asked, in both orders of syncing.
  - Editing a plant's name, light or interval keeps its last-watered day.
  - A new plant counts as watered today.
  - Wrong input: the server rejects a missing or impossible watering day such as '2026-02-30' (needs a new step).
  - Old data files without a watering day still load, using the last-saved day (needs a new step).
  - Demo reset moves seed watering days to today (needs a new step).
  - Time zones and the hours around midnight: the reminder uses the device's local day.
  - The error message when marking watered fails (needs a new step).

  Scenario: An unsent watering keeps Ava from signing out
    Given it is "2026-06-15" on Ava's device
    And a test plant exists
    And the test plant is watered every 7 days and was last watered 9 days ago
    And Ava is signed in
    And Ava goes offline
    When Ava marks the test plant watered
    Then Ava cannot sign out yet

  Scenario: Editing a plant keeps its last watering day
    Given it is "2026-06-15" on Ava's device
    And a test plant exists
    And the test plant is watered every 7 days and was last watered 9 days ago
    And Ava is signed in
    # Fixed by a person: the form has to be open before a field can be changed.
    When Ava starts editing the test plant
    And Ava changes the watering interval to 10 days and saves
    Then Ava sees the test plant marked "Water tomorrow"
    And the server has the test plant last watered on "2026-06-06"

  Scenario: A new plant counts as watered today
    Given it is "2026-06-15" on Ava's device
    And Ava is signed in
    When Ava adds a new plant with light "Medium light", watered every 5 days
    Then Ava's list shows the new plant as "Water in 5 days"
    And the new plant is saved on the server

  Scenario: An offline watering and someone else's edit are both kept
    Given it is "2026-06-15" on Ava's device
    And it is "2026-06-15" on Ben's device
    And a test plant exists
    And the test plant is watered every 7 days and was last watered 9 days ago
    And Ava and Ben are signed in on separate devices
    And Ava goes offline
    When Ava marks the test plant watered
    # Fixed by a person: the form has to be open before a field can be changed.
    And Ben starts editing the test plant
    And Ben changes the watering interval to 10 days and saves
    And Ava goes back online
    Then all of Ava's changes are synced
    And the server has the test plant with a watering interval of 10 days
    And the server has the test plant last watered on "2026-06-15"

  Scenario: When two people water on different days, the later day wins
    Given it is "2026-06-15" on Ava's device
    And it is "2026-06-14" on Ben's device
    And a test plant exists
    And the test plant is watered every 7 days and was last watered 9 days ago
    And Ava and Ben are signed in on separate devices
    And Ava goes offline
    When Ava marks the test plant watered
    And Ben marks the test plant watered
    And Ava goes back online
    Then all of Ava's changes are synced
    And the server has the test plant last watered on "2026-06-15"
