Feature: Working offline
  Sprout keeps working without a connection. Changes wait on the device, the banner says so,
  and they are sent as soon as the connection is back. Nothing is lost on the way.

  Background:
    Given Ava is signed in
    And a test plant exists

  Scenario: A change made offline waits on the device
    When Ava starts editing the test plant
    And Ava goes offline
    And Ava changes the watering interval to 9 days
    And Ava saves the form
    Then Ava's banner says "Offline"
    And Ava sees the test plant marked "Not synced yet"
    And Ava cannot sign out yet
    And the server still has the test plant with a watering interval of 7 days

  Scenario: Back online, the change is sent
    Given Ava changed the test plant's watering interval to 9 days while offline
    When Ava goes back online
    Then all of Ava's changes are synced
    And the server has the test plant with a watering interval of 9 days

  Scenario: Back online, a first try that fails is retried within seconds
    Given Ava changed the test plant's watering interval to 9 days while offline
    And Ava's next request to the server will fail
    When Ava goes back online
    Then all of Ava's changes are synced
    And the server has the test plant with a watering interval of 9 days

  Scenario: A plant added offline is created when back online
    Given Ava goes offline
    When Ava adds a new plant with light "Low light", watered every 14 days
    And Ava goes back online
    Then all of Ava's changes are synced
    And the new plant is saved on the server
