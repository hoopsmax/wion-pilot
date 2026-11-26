@demo-bug @not-an-example
Feature: Bug-report demo
  This scenario fails on purpose: it expects a message Sprout never shows. It exists so that
  `npm run demo:bug` can produce a real bug-report draft at any time. A normal `npm test` skips it.

  Scenario: A deliberately wrong expectation
    When Ava signs in with the password "not-her-password"
    Then Ava sees the error "Welcome back!"
    And Ava sees the sign-in screen
