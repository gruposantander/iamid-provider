'use strict'

const { validate } = require('./schema-validator')

function isObject (any) {
  return any && typeof any === 'object' && !Array.isArray(any)
}

function merge (schema, base, specific) {
  const result = { ...base }
  const { properties = {} } = schema || {}
  for (const [key, value] of Object.entries(specific)) {
    const target = result[key]
    const rule = properties[key] || { }
    const { merge: indicator = true } = rule
    if (target) {
      if (isObject(target) && isObject(value)) {
        if (indicator) {
          result[key] = merge(rule, target, value)
          continue
        }
      }
    }
    result[key] = value
  }
  return result
}

function melt (schema, ...values) {
  const merged = values.reduce((base, specific) => merge(schema, base, specific))
  validate(schema, merged)
  return merged
}

module.exports = melt
