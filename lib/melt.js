'use strict'

const { equal, notEqual } = require('assert').strict

function isObject (any) {
  return any && typeof any === 'object' && !Array.isArray(any)
}

function validate (rules, result, path = '$') {
  for (const [key, value] of Object.entries(rules)) {
    const rule = value || {}
    const { $type } = rule
    const current = result[key]
    notEqual(current, undefined, `${path}.${key} is required`)
    if ($type === 'string') {
      equal(typeof current, $type, `${path}.${key} must be a string`)
    }
  }
  return result
}

function merge (rules, base, specific) {
  const result = { ...base }
  for (const [key, value] of Object.entries(specific)) {
    const target = result[key]
    const rule = rules[key] || { }
    const { $melt = true } = rule
    if (target) {
      if (isObject(target) && isObject(value)) {
        if ($melt) {
          result[key] = melt(rule, target, value)
          continue
        }
      }
    }
    result[key] = value
  }
  return result
}

function melt (rules, ...values) {
  const merged = values.reduce((base, specific) => merge(rules, base, specific))
  return validate(rules, merged)
}

module.exports = melt
