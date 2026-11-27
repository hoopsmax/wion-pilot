# Recorded with wion teach on 2026-11-27, approved with wion review on 2026-11-27.
@recorded
Feature: Adding a plant by clicking
  Recorded with wion teach: a person clicked through the app.

  Scenario: Adding a plant by clicking
    Given Ava is signed in
    When Ava clicks "Add plant"
    And Ava fills "Name" with "{new name}"
    And Ava chooses "Medium light" in "Light"
    And Ava fills "Watering interval (days)" with "5"
    And Ava clicks "Save"
    Then Ava sees "{new name}"
