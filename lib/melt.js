'use strict'

function isObject (any) {
  return any && typeof any === 'object' && !Array.isArray(any)
}

function melt (rules, base, specific) {
  const result = { ...base }
  for (const [key, value] of Object.entries(specific)) {
    const target = result[key]
    const rule = rules[key] || { $melt: true }
    if (target) {
      if (isObject(target) && isObject(value)) {
        if (rule.$melt) {
          result[key] = melt(rule, target, value)
          continue
        }
      }
    }
    result[key] = value
  }
  return result
}

module.exports = melt
