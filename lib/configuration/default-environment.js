'use strict'

module.exports = {
  scopes: [], // 'openid' and 'offline_access' already default in oidc-provider.
  postLogoutRedirectURI: 'https://www.santander.co.uk',
  customAuthorizationEndpoint: 'https://verifiedid-nginx-spa-verifiedid-pro.e4ff.pro-eu-west-1.openshiftapps.com',
  discovery: {
    assertion_claims_supported: true,
    digital_id_certified_data_extension: true,
    claims_in_assertion_claims_supported: {
      total_balance: { type: 'object', properties: { amount: { type: 'decimal' }, currency: { type: 'string' } } },
      phone_number: { type: 'phone_number' },
      email: { type: 'string' },
      birthdate: { type: 'date' },
      family_name: { type: 'string' },
      given_name: { type: 'string' }
    },
    assertion_claims_query_language_supported: {
      string: ['$eq'],
      phone_number: ['$eq'],
      date: ['$eq', '$gt', '$lt', '$gte', '$lte'],
      decimal: ['$eq', '$gt', '$lt', '$gte', '$lte'],
      object: []
    }
  },
  claims: {
    assertion_claims: null,
    total_balance: null,
    phone_number: null,
    email: null,
    birthdate: null,
    family_name: null,
    given_name: null
  },
  masks: {
    email: { type: 'email' },
    phone_number: { type: 'slice', args: { prefix: '******', begin: -4 } },
    given_name: { type: 'fill', args: { begin: 2, end: -2, filling: '****' } },
    family_name: { type: 'fill', args: { begin: 2, end: -2, filling: '****' } }
  },
  routes: {
    interaction: '/interaction',
    authorization: '/authorize',
    device_authorization: '/device-authorize',
    token: '/token',
    pushed_authorization_request: '/initiate-authorize'
  },
  pushedRequestURN: 'urn:op.example:',
  issuer: 'https://op.example.com',
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
