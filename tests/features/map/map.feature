@not-an-example
Feature: Mapping an app
  wion map opens each screen of an app by its address, signs in like a person
  (as Ava, from wion.config.json) and writes down every screen, field and locator.

  Scenario: Mapping Sprout finds every screen and every form field
    When Sprout is mapped
    Then the map shows these screens:
      | screen            | address          |
      | Sign in to Sprout | /sign-in         |
      | Plants            | /                |
      | Add plant         | /plants/new      |
      | Edit plant        | /plants/:id/edit |
    And the "Add plant" screen has these fields:
      | field                    | type   | rules                                                                         |
      | Name                     | text   |                                                                               |
      | Light                    | select | options: Choose…, Low light, Medium light, Bright, indirect light, Direct sun |
      | Watering interval (days) | number | min 1 · max 60                                                                |
    And every button, link and field on the map has a locator
    And every screen on the map has a screenshot

  Scenario: Mapping changes no data
    Given the plants as they are now
    When Sprout is mapped
    Then no plant has changed

  Scenario: A wrong password is explained
    When Sprout is mapped with a wrong password
    Then the map fails with "Email or password is wrong."

  Scenario: An app that is not running is explained
    When an app that is not running is mapped
    Then the map fails with "Is the app running?"
