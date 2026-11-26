@not-an-example
Feature: Teaching wion by clicking
  While wion teach records, each thing a person does in the browser becomes a generic step:
  a click, typing, a choice, or an Option+click on a text to check that it is shown. Here
  Playwright plays Ava, so the recorder is tested on every push.

  Background:
    Given Ava is signed in
    And wion is recording what Ava does

  Scenario: Adding a plant becomes steps, with the typed test name as {new name}
    When Ava adds a new plant with light "Medium light", watered every 5 days
    And Ava points out the new plant's name
    Then the recording reads:
      """
      When Ava clicks "Add plant"
      And Ava fills "Name" with "{new name}"
      And Ava chooses "Medium light" in "Light"
      And Ava fills "Watering interval (days)" with "5"
      And Ava clicks "Save"
      Then Ava sees "{new name}"
      """
    And the recorded steps pass the check

  Scenario: The test name is replaced inside a link's name too
    When Ava adds a new plant with light "Low light", watered every 3 days
    And Ava opens the new plant for editing
    Then the recording ends with:
      """
      And Ava clicks "Edit {new name}"
      """

  Scenario: A password is never recorded
    When Ava signs out
    And Ava signs in with the password "not-her-password"
    Then the recording does not contain "not-her-password"
    And the recording notes that the password was not recorded
