Feature: Two people edit the same plant
  Ava and Ben share the household's plants and edit them on separate devices. Sprout combines
  their edits field by field and only asks when both changed the same field to different values.
  "The label Ben" means the plant's name becomes "<test plant name> Ben".

  Background:
    Given a test plant exists
    And Ava and Ben are signed in on separate devices

  Scenario: Different fields are combined without asking
    Given Ava and Ben both start editing the test plant
    When Ben changes the watering interval to 9 days and saves
    And Ava changes the light to "Low light" and saves
    Then Ava is not asked to decide anything
    And the server has the test plant with "Low light", watered every 9 days

  Scenario: The same value is not a conflict
    Given Ava and Ben both start editing the test plant
    When Ben changes the watering interval to 10 days and saves
    And Ava changes the watering interval to 10 days and saves
    Then Ava is not asked to decide anything
    And the server has the test plant with "Medium light", watered every 10 days

  Scenario Outline: Only the clashing field is asked about (keeping <choice>)
    Given Ava and Ben both start editing the test plant
    When Ben renames the test plant with the label "Ben" and sets 10 days, and saves
    And Ava renames the test plant with the label "Ava" and sets 10 days, and saves
    Then Ava is asked by Ben to decide only about "Name"
    When Ava keeps "<choice>" for "Name" and saves her choices
    Then the server has the test plant named with the label "<winner>"

    Examples:
      | choice       | winner |
      | Yours        | Ava    |
      | Latest (Ben) | Ben    |

  Scenario: Ava edited offline while Ben edited online
    Given Ava and Ben both start editing the test plant
    When Ava goes offline
    And Ava renames the test plant with the label "Ava" and saves
    And Ben renames the test plant with the label "Ben" and saves
    And Ava goes back online
    Then Ava is asked by Ben to decide only about "Name"
    When Ava takes all the latest values
    Then the server has the test plant named with the label "Ben"

  Scenario: A conflict found while Ava is typing keeps her typing
    Given Ava and Ben both start editing the test plant
    And Ava goes offline
    And Ava renames the test plant with the label "Ava" and saves
    And Ben renames the test plant with the label "Ben" and saves
    When Ava starts adding a plant named "wion-test-typing"
    And Ava goes back online
    Then Ava's banner offers to review a decision
    And Ava is still on the "Add plant" form with the name "wion-test-typing"

  Scenario: A background refresh while editing does not hide the conflict
    Given Ava's browser clock is controlled by the test
    And Ava and Ben both start editing the test plant
    When Ben renames the test plant with the label "Ben" and saves
    And Ava's app refreshes in the background
    And Ava renames the test plant with the label "Ava" and saves
    Then Ava is asked by Ben to decide only about "Name"
