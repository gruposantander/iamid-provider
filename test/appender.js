'use strict'
const util = require('util')

const output = []

function append (event) {
  const { categoryName: category, data, level: { levelStr: level } } = event
  output.push(`[${category}] [${level}] ${util.format(...data)}`)
}

function configure () {
  return append
}

function clear () {
  output.length = 0
}

module.exports = {
  configure,
  clear,
  output
}
