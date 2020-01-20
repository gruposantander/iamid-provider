'use strict'

const expiresAtIndex = { key: { expiresAt: 1 }, expireAfterSeconds: 0 }
const grandIdIndex = { key: { grandId: 1 } }
const mongoIndexes = '-mongodb-indexes'

module.exports = {
  ['session' + mongoIndexes]: [
    { key: { uid: 1 }, unique: true },
    expiresAtIndex
  ],
  ['access_token' + mongoIndexes]: [
    grandIdIndex,
    expiresAtIndex
  ],
  ['authorization_code' + mongoIndexes]: [
    grandIdIndex,
    expiresAtIndex
  ],
  ['refresh_token' + mongoIndexes]: [
    grandIdIndex,
    expiresAtIndex
  ],
  ['device_code' + mongoIndexes]: [
    grandIdIndex,
    { key: { userCode: 1 }, unique: true },
    expiresAtIndex
  ]
}
