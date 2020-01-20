'use strict'

const { it } = require('mocha')

module.exports = function () {
  it('should expose a OpenId Configuration URL', function () {
    return this.request
      .get('/.well-known/openid-configuration')
      .expect(200, require('../resources/openid-configuration'))
  })
}
