@not-an-example
Feature: AI drafts, approved by a person
  wion draft turns an AI answer into a proposal checked with bddgen, and wion review lets a
  person approve each scenario before it enters the features folder. These scenarios replay
  saved answers, so no AI is called and nothing is billed.

  Scenario: A good answer becomes a proposal that passes the check
    When the saved answer "good" is drafted
    Then the draft passes the check
    And there is a proposal for "watering-reminders-extra"
    And no feature file has been written yet

  Scenario: An answer with a made-up step is kept but never offered
    When the saved answer "made-up-step" is drafted
    Then the draft fails the check, naming "When Ava sings to the test plant"
    And the review does not offer "singing-to-plants"

  Scenario: An approved scenario is written, a rejected one is not
    Given the saved answer "good" was drafted
    When the reviewer approves the first scenario and rejects the second
    Then the written feature has the scenario "A plant watered today waits a whole interval"
    And the written feature does not have the scenario "A long-forgotten plant"
    And the written feature passes the check

  Scenario: Without a provider, the prompt is saved with personal data removed
    When a prompt about "reminders for ava@sprout.test" is made with the password "sprout-ava" set
    Then the saved prompt does not contain "ava@sprout.test"
    And the saved prompt does not contain "sprout-ava"
    And the saved prompt contains "<email>"
