'use strict'

const { equal, notEqual, fail, ok } = require('assert').strict

function isObject (any) {
  return any && typeof any === 'object' && !Array.isArray(any)
}

function pushKey (path, key) {
  return path + '.' + key
}

function validate (rules, result, path = '$') {
  for (const [key, value] of Object.entries(rules)) {
    if (key.startsWith('$')) continue
    const rule = value || {}
    const { $type } = rule
    const current = result[key]
    notEqual(current, undefined, `${pushKey(path, key)} is required`)
    if ($type === 'string') {
      equal(typeof current, $type, `${pushKey(path, key)} must be a string`)
    } else if ($type === 'number') {
      equal(typeof current, $type, `${pushKey(path, key)} must be a number`)
    } else if ($type === 'object') {
      ok(isObject(current), `${pushKey(path, key)} must be an object`)
    } else if ($type === 'array') {
      ok(Array.isArray(current), `${pushKey(path, key)} must be an array`)
    } else if ($type) {
      fail(`${pushKey(path, key)} type "${$type}" is not supported`)
    }
    if (isObject(current)) {
      validate(value, current, pushKey(path, key))
    }
  }
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
          result[key] = merge(rule, target, value)
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
  validate(rules, merged)
  return merged
}

module.exports = melt
