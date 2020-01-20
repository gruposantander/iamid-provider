'use strict'

const { PhoneNumberUtil, PhoneNumberFormat } = require('google-libphonenumber')
const pnu = PhoneNumberUtil.getInstance()
const logger = require('log4js').getLogger('phone-number')

function normalize (str) {
  try {
    return pnu.format(pnu.parse(str, 'GB'), PhoneNumberFormat.E164)
  } catch (err) {
    logger.trace(err)
    return null
  }
}

module.exports = { normalize }
