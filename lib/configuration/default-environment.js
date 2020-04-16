'use strict'

module.exports = {
  scopes: [], // 'openid' and 'offline_access' already default in oidc-provider.
  postLogoutRedirectURI: null,
  customAuthorizationEndpoint: null,
  discovery: {
    assertion_claims_supported: true,
    digital_id_certified_data_extension: true,
    claims_in_assertion_claims_supported: {},
    assertion_claims_query_language_supported: {
      string: ['eq'],
      phone_number: ['eq'],
      date: ['eq', 'gt', 'lt', 'gte', 'lte'],
      number: ['eq', 'gt', 'lt', 'gte', 'lte'],
      decimal: ['eq', 'gt', 'lt', 'gte', 'lte'],
      object: [],
      boolean: ['eq'],
      array: ['none', 'every', 'some']
    }
  },
  claims: {},
  masks: {},
  routes: {
    interaction: '/interaction',
    authorization: '/authorize',
    device_authorization: '/device-authorize',
    token: '/token',
    pushed_authorization_request: '/initiate-authorize'
  },
  pushedRequestURN: null,
  issuer: null,
  ttl: {
    AccessToken: 1,
    AuthorizationCode: 120,
    ClientCredentials: 1,
    DeviceCode: 1,
    IdToken: 600
  },
  whitelistedJWA: {
    tokenEndpointAuthSigningAlgValues: ['RS256'],
    idTokenSigningAlgValues: ['RS256'],
    requestObjectSigningAlgValues: ['RS256'],
    userinfoSigningAlgValues: ['RS256']
  },
  clockTolerance: 5
}
