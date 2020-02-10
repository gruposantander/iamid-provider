'use strict'

const melt = require('./melt')

const { DEFAULT_ENVIRONMENT, DEFAULT_SECRET, FIXED, functions } = require('./configuration/')

class ConfigurationBuilder {
  constructor () {
    const environments = []
    const secrets = []
    this.pushEnvironment = function (environment) {
      environments.push(environment)
      return this
    }
    this.pushSecrets = function (secret) {
      secrets.push(secret)
      return this
    }
    this.build = function () {
      const melted = melt({}, DEFAULT_ENVIRONMENT, ...environments, DEFAULT_SECRET, ...secrets, FIXED)
      return melt({}, melted, functions(melted))
    }
  }
}

function newInstance () {
  return new ConfigurationBuilder()
}

module.exports = { newInstance }
