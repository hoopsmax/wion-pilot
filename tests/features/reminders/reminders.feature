Feature: Watering reminders
  Each plant says when it needs water next, counted from its last watering and its
  watering interval. Marking a plant watered starts the count again, also offline.

  Background:
    Given it is "2026-06-15" on Ava's device
    And a test plant exists

  Scenario Outline: The list says when to water (<reminder>)
    Given the test plant is watered every <every> days and was last watered <ago> days ago
    And Ava is signed in
    Then Ava sees the test plant marked "<reminder>"

    Examples:
      | every | ago | reminder        |
      | 3     | 3   | Water today     |
      | 3     | 2   | Water tomorrow  |
      | 7     | 4   | Water in 3 days |
      | 3     | 4   | 1 day overdue   |
      | 2     | 4   | 2 days overdue  |

  Scenario: Marking a plant watered starts the count again
    Given the test plant is watered every 7 days and was last watered 9 days ago
    And Ava is signed in
    When Ava marks the test plant watered
    Then Ava sees the test plant marked "Water in 7 days"
    And the server has the test plant last watered on "2026-06-15"

  Scenario: A plant watered offline is synced later
    Given the test plant is watered every 7 days and was last watered 9 days ago
    And Ava is signed in
    And Ava goes offline
    When Ava marks the test plant watered
    Then Ava sees the test plant marked "Not synced yet"
    And the server has the test plant last watered on "2026-06-06"
    When Ava goes back online
    Then all of Ava's changes are synced
    And the server has the test plant last watered on "2026-06-15"
