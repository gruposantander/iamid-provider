'use strict'

const registration = (process.env.REGISTRATION === 'active')

module.exports = {
  responseTypes: ['code'],
  tokenEndpointAuthMethods: ['private_key_jwt'],
  conformIdTokenClaims: false,
  forceOIDCScope: true,
  forceURNRequestURI: true,
  requestURIParamRequired: true,
  disableSessionEndpoints: true,
  nonceRequired: true,
  subjectTypes: ['pairwise'],
  features: {
    requestObjects: {
      mergingStrategy: {
        name: 'whitelist',
        whitelist: [
          'response_mode',
          'prompt'
        ]
      }
    },
    pushedAuthorizationRequests: {
      enabled: true,
      requestParamRequired: true,
      ack: 0
    },
    claimsParameter: {
      enabled: true
    },
    // Ensure additional endpoints are disabled
    registration: { enabled: registration },
    revocation: { enabled: false },
    introspection: { enabled: false },
    sessionManagement: { enabled: false },
    deviceFlow: { enabled: false },
    devInteractions: { enabled: false }
  },
  postLogoutRedirect: {
    enabled: true,
    uri: null
  }
}
