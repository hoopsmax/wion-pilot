Feature: Signing in and out
  People sign in with their email and password to see the household's plants.

  Scenario: Signing in shows the plants
    When Ava signs in
    Then Ava sees the plant list
    And Ava's banner says "Synced"

  Scenario: A wrong password is refused
    When Ava signs in with the password "not-her-password"
    Then Ava sees the error "Email or password is wrong."
    And Ava sees the sign-in screen

  Scenario: Signing out
    Given Ava is signed in
    When Ava signs out
    Then Ava sees the sign-in screen
