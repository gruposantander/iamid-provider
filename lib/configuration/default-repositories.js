'use strict'

const expiresAtIndex = { key: { expiresAt: 1 }, expireAfterSeconds: 0 }
const grandIdIndex = { key: { grandId: 1 } }
const mongoIndexes = '-mongodb-indexes'

/*
  As described in https://github.com/panva/node-oidc-provider/blob/master/example/my_adapter.js the name of the repo could be one of this
  "Session", "AccessToken", "AuthorizationCode", "RefreshToken", "ClientCredentials", "Client", "InitialAccessToken",
  "RegistrationAccessToken", "DeviceCode", "Interaction", "ReplayDetection", or "PushedAuthorizationRequest"
*/

module.exports = {
  ['Session' + mongoIndexes]: [
    { key: { uid: 1 }, unique: true },
    expiresAtIndex
  ],
  ['AccessToken' + mongoIndexes]: [
    grandIdIndex,
    expiresAtIndex
  ],
  ['AuthorizationCode' + mongoIndexes]: [
    grandIdIndex,
    expiresAtIndex
  ],
  ['RefreshToken' + mongoIndexes]: [
    grandIdIndex,
    expiresAtIndex
  ],
  ['DeviceCode' + mongoIndexes]: [
    grandIdIndex,
    { key: { userCode: 1 }, unique: true },
    expiresAtIndex
  ],
  ['UserAuthorizations' + mongoIndexes]: [
    { key: { systems: 1 } }
  ],
  ['default' + mongoIndexes]: [
    expiresAtIndex
  ]
}
