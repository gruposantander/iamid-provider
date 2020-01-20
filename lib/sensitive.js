'use strict'

const unwrap = (value) => value instanceof Sensitive ? { value: value.value } : value
const unwrapEntry = (entry) => [entry[0], unwrap(entry[1])]

class Sensitive {

  constructor (value) {
    this.value = value
  }

  toJSON () {
    return undefined
  }

  static wrap (value) {
    return new Sensitive(value)
  }

  static unwrap (_, value) {
    if (value && typeof value === 'object') {
      if(Array.isArray(value)) {
        return value.map(unwrap)
      }
      return Object.fromEntries(Object.entries(value).map(unwrapEntry))
    }
    return value
  }
}

module.exports = Sensitive
