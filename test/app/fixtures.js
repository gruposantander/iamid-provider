'use strict'

const jwt = require('jsonwebtoken')
const fs = require('fs')

const { ClaimResponse, Claim } = require('../../lib/resolvers')
const { freeze } = Object

const INIT_PATH = '/initiate-authorize'
const AUTH_PATH = '/authorize'
const LOGIN_PATH = '/login'
const INTERACTION_PATH = '/interaction/'
const CONSENT_PATH = '/consent'
const TOKEN_PATH = '/token'
const LOGOUT_PATH = '/logout'
const ABORT_PATH = '/abort'

const CLIENT_ID = 'TEST-2754efa75e8c4d11a6d7f95b90cd8e40-TEST'
const CLIENT_ID_ALT = 'TEST2-d47f2130ee7948a2b79e31f7f2b10d00-TEST2'
const CLIENT = freeze({
  clientName: 'Sainsbury',
  logoUri: 'https://www.about.sainsburys.co.uk/~/media/Images/S/Sainsburys/' +
    'content-images/media-tool-kit/media-images/preview/sainsburys.jpeg',
  tosUri: 'https://help.sainsburys.co.uk/help/website/terms-conditions-acceptance',
  policyUri: 'https://privacy-hub.sainsburys.co.uk/privacy-policy/'
})
const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
const REDIRECT_URI = 'http://127.0.0.1:8080/cb'
const OP_ID = 'https://op.example.com'
const USER = 'juanjo'
const PASS = 'juanjo-pass'
const KEY_ID = '259337db-7412-45da-ad86-b63c97796588'
const NONCE = 'nonce-value'
// TODO rename to UID
const AUTH = 'juanjo-uid'

const DEFAULT_REQUEST_OBJECT = freeze({
  iss: CLIENT_ID,
  nonce: NONCE,
  aud: OP_ID,
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  scope: 'openid'
})

const CLAIMS_FOR_REQUEST = freeze({
  claims: freeze({
    purpose: 'general purpose',
    id_token: freeze({
      given_name: { essential: true, purpose: 'id_token given_name purpose' }
    })
  })
})

const REQUEST_WITH_CLAIMS = { ...DEFAULT_REQUEST_OBJECT, ...CLAIMS_FOR_REQUEST }
const RESOLVED_CLAIMS = new ClaimResponse({ given_name: new Claim(['Juan José']) })

const PAYLOAD_AUTH = freeze({
  aud: OP_ID,
  iss: CLIENT_ID,
  sub: CLIENT_ID
})

const PAYLOAD_AUTH_ALT = freeze({
  aud: OP_ID,
  iss: CLIENT_ID_ALT,
  sub: CLIENT_ID_ALT
})

const publicKey = fs.readFileSync('./test/resources/public-key.pem')
const privateKey = fs.readFileSync('./test/resources/private-key.pem')
let jwtCounter = Date.now()

function jwtSign (payload, options) {
  const { privateKey, keyid, expiresIn } = { ...jwtSign.DEFAULTS, ...options }
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    keyid,
    expiresIn,
    notBefore: 0,
    jwtid: `jwt-${jwtCounter++}`
  })
}
jwtSign.DEFAULTS = {
  expiresIn: 30,
  privateKey,
  keyid: KEY_ID
}

function jwtVerify (tokenStr) {
  return jwt.verify(tokenStr, publicKey)
}

function getInteractionIdFromInteractionUri (interactionUri) {
  return interactionUri.split('/').pop()
}

function error (error, description) {
  return { error, error_description: description }
}

module.exports = {
  getInteractionIdFromInteractionUri,
  jwtVerify,
  jwtSign,
  INIT_PATH,
  PAYLOAD_AUTH,
  PAYLOAD_AUTH_ALT,
  CLIENT,
  CLIENT_ID,
  CLIENT_ID_ALT,
  OP_ID,
  AUTH_PATH,
  AUTH,
  REDIRECT_URI,
  DEFAULT_REQUEST_OBJECT,
  CLIENT_ASSERTION_TYPE,
  error,
  LOGIN_PATH,
  INTERACTION_PATH,
  CONSENT_PATH,
  TOKEN_PATH,
  USER,
  PASS,
  NONCE,
  LOGOUT_PATH,
  REQUEST_WITH_CLAIMS,
  ABORT_PATH,
  RESOLVED_CLAIMS
}
