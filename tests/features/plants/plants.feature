Feature: Adding and editing plants
  Ava keeps the household's plants up to date. The form checks every field and explains
  what is wrong next to the field itself.

  Background:
    Given Ava is signed in

  Scenario: Adding a plant
    When Ava adds a new plant with light "Direct sun", watered every 3 days
    Then Ava's list shows the new plant as "Direct sun · Water every 3 days"
    And the new plant is saved on the server

  Scenario: Editing a plant
    Given a test plant exists
    When Ava starts editing the test plant
    And Ava changes the watering interval to 12 days
    And Ava saves the form
    Then Ava's list shows the test plant as "Medium light · Water every 12 days"
    And the server has the test plant with a watering interval of 12 days

  Scenario Outline: The form explains what is wrong (<case>)
    When Ava tries to add a plant named "<name>" with light "<light>", watered every "<interval>" days
    Then Ava's "<field>" field says "<message>"
    And Ava is still on the "Add plant" form

    Examples:
      | case        | name            | light      | interval | field                    | message                                                     |
      | no name     |                 | Direct sun | 3        | Name                     | Name is required.                                           |
      | interval 0  | wion-test-valid | Direct sun | 0        | Watering interval (days) | Watering interval must be a whole number from 1 to 60 days. |
      | interval 61 | wion-test-valid | Direct sun | 61       | Watering interval (days) | Watering interval must be a whole number from 1 to 60 days. |
      | no light    | wion-test-valid |            | 3        | Light                    | Choose a light level from the list.                         |
