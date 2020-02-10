'use strict'

const secureCookies = (process.env.NODE_ENV === 'production')
const repositories = require('./default-repositories')

module.exports = {
  cookies: {
    keys: ['some-key'],
    long: {
      httpOnly: true,
      maxAge: 15 * 60 * 1000, // 15 minutes
      // sameSite: true,
      secure: secureCookies,
      signed: true
    },
    short: {
      httpOnly: true,
      maxAge: 10 * 60 * 1000, // 10 minutes
      // sameSite: true,
      secure: secureCookies,
      signed: true
    }
  },
  repositories,
  pairwiseSalt: 'op-server'
}
