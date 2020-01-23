'use strict'

const { MongoClient } = require('mongodb')
const { unwrap } = require('./sensitive')

function execFilter (filter) {
  // TODO this should not be done in this way but is a temporal solution for the memoery repo...
  // { 'systems.id': systemId, 'systems.uid': systemUid }
  if (filter['systems.id']) {
    return (value) => value.systems.some((el) => (el.id === filter['systems.id'] && el.uid === filter['systems.uid']))
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
    return revive(str && JSON.parse(str), reviver)
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
      .map((str) => JSON.parse(str))
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
    this._map.set(doc.id, JSON.stringify(doc, unwrap))
  }

  async clear () {
    this._map.clear()
  }
}

const toDodgy = (obj) => JSON.parse(JSON.stringify(obj, unwrap).replace(/\$/g, '~$'))
const fromDodgy = (obj) => JSON.parse(JSON.stringify(obj).replace(/~\$/g, '$'))

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
    this._dbCache = new Map()
  }

  async getRepository (name) {
    const cached = this._cache.get(name)
    if (cached) {
      return cached
    }

    const { _cfg: { default: def = {}, [name]: { type, options } = def } } = this
    if (type === 'mongodb') {
      let client = this._dbCache.get('default')
      if (!client) {
        const { uri } = options
        client = new MongoClient(uri, { useUnifiedTopology: true })
        await client.connect()
        this._dbCache.set('default', client)
      }
      const collection = client.db().collection(name)
      const indexes = this._cfg[name + '-mongodb-indexes']
      if (indexes) {
        await collection.createIndexes(indexes)
      }
      const repository = new MongoRepository(collection)
      this._cache.set(name, repository)
      return repository
    }
    const repository = new MemoryRepository(options)
    this._cache.set(name, repository)
    return repository
  }

  async close () {
    for (const client of this._dbCache.values()) {
      await client.close()
    }
  }
}

module.exports = { Repositories }
