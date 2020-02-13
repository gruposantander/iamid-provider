'use strict'

const { MongoClient } = require('mongodb')

// Dodgy clone and transform function
function transform (data, fn) {
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map((item) => transform(item, fn))
    }
    if (data instanceof Date) {
      return new Date(data.getTime())
    }
    return Object.fromEntries(Object.entries(data)
      .map(fn)
      .map(([key, value]) => [key, transform(value, fn)]))
  }
  return data
}

const toDodgy = (obj) => transform(obj, ([key, value]) => [key.startsWith('$') ? '~' + key : key, value])
const fromDodgy = (obj) => transform(obj, ([key, value]) => [key.startsWith('~$') ? key.slice(1) : key, value])

function execFilter (filter) {
  // TODO this should not be done in this way but is a temporal solution for the memory repo...
  // { 'systems.id': systemId, 'systems.uid': systemUid }
  if (filter['connections.uid']) {
    return (value) => value.connections.some((el) => (el.uid === filter['connections.uid'] && el.type === filter['connections.type']))
  } else {
    const entries = Object.entries(filter)
    return (value) => entries.every((entry) => value[entry[0]] === entry[1])
  }
}

function revive (obj, reviver = (obj) => obj) {
  return obj ? reviver(obj) : obj
}

class MemoryRepository {
  constructor () {
    this._map = new Map()
  }

  async findById (id, reviver) {
    const str = this._map.get(id)
    return revive(str && fromDodgy(str), reviver)
  }

  async updateById (id, update) {
    const current = this.findById(id)
    if (current) {
      const updated = { ...current, ...update }
      this.save(updated)
    }
  }

  async findOne (filter, reviver) {
    return revive(Array.from(this._map.values())
      .map((str) => fromDodgy(str))
      .find(execFilter(filter)), reviver)
  }

  async deleteById (id) {
    this._map.delete(id)
  }

  async deleteMany (filter) {
    await this._map.values()
      .filter(execFilter(filter))
      .forEach(value => this._map.delete(value.id))
  }

  // TODO Must return ID
  async save (doc) {
    this._map.set(doc.id, toDodgy(doc))
  }

  async clear () {
    this._map.clear()
  }
}

class MongoRepository {
  /**
   *
   * @param {import('mongodb').Collection} collection
   */
  constructor (collection) {
    this._collection = collection
  }

  async findById (id, reviver) {
    const result = await this.findOne({ _id: id })
    return revive(result ? fromDodgy(result) : null, reviver)
  }

  async updateById (id, update) {
    await this._collection.updateOne({ _id: id }, { $set: toDodgy(update) }, { checkKeys: false })
  }

  async findOne (filter, reviver) {
    const response = await this._collection.findOne(filter)
    if (!response) return null
    const { _id, ...doc } = response
    doc.id = _id
    return revive(fromDodgy(doc), reviver)
  }

  async deleteById (id) {
    await this._collection.deleteOne({ _id: id })
  }

  async deleteMany (filter) {
    await this._collection.deleteMany(filter)
  }

  // TODO Must return ID
  async save (doc) {
    const { id, ...rest } = doc
    await this._collection.replaceOne({ _id: id }, toDodgy(rest), { upsert: true, checkKeys: false })
  }

  async clear () {
    await this._collection.deleteMany({})
  }
}

class Repositories {
  constructor (cfg = {}) {
    this._cfg = cfg
    this._cache = new Map()
    this._clients = new Map()
  }

  async getMongoRepository (name, options) {
    let client = this._clients.get('default')
    if (!client) {
      const { uri } = options
      client = new MongoClient(uri, { useUnifiedTopology: true })
      await client.connect()
      this._clients.set('default', client)
    }
    const collection = client.db().collection(name)
    const { _cfg: { 'default-mongodb-indexes': def, [name + '-mongodb-indexes']: indexes = def } } = this
    if (indexes) {
      await collection.createIndexes(indexes)
    }
    const repository = new MongoRepository(collection)
    this._cache.set(name, repository)
    return repository
  }

  async getMemoryRepository (name, options) {
    const repository = new MemoryRepository(options)
    this._cache.set(name, repository)
    return repository
  }

  async getRepository (name) {
    const cached = this._cache.get(name)
    if (cached) {
      return cached
    }
    const { _cfg: { default: def = {}, [name]: { type, options } = def } } = this
    if (type === 'mongodb') {
      return this.getMongoRepository(name, options)
    } else if (type === 'memory' || type === undefined) {
      return this.getMemoryRepository(name, options)
    }
    return Error('Unknown repository type')
  }

  async close () {
    for (const client of this._clients.values()) {
      await client.close()
    }
  }
}

exports.Repositories = Repositories // For VSCode
module.exports = { Repositories }
