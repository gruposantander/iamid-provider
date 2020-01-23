'use strict'

const { assert, isObject, isNotEmptyString } = require('./validation')
const nanoid = require('nanoid')
const AUTH_REPO_NAME = 'user_authorizations'

// TODO should the index of 'systems' be unique? or not?
// TODO what should we use for generate the unique id?
// TODO method add a system using uid? this for future when we agregate systems.
// TODO should avoid insert same system with diferent userid?? CANNOT HAPPEN I GUESS

/**
 * Class that contain the additional logic for store and retrieve authorization data related with external systems.
 * This external systems are used to obtain user information (Claims) normally using APIs, using this class is how
 * auth data is stored and retrieved.
 */
class UserAuthorizations {
  /**
   * Create an AuthAdapter
   * @param {repositories} repositories
   */
  constructor (repositories) {
    this.repositories = repositories
  }

  /**
   * Return the repo name to the outside world.
   */
  static getRepoName () {
    return AUTH_REPO_NAME
  }

  /**
   * Store authorization data from an external system related with an user.
   * @param {String} systemId - A unique identifier of the system that has provide the authorization data, for example 'minibank', 'sanuk'...
   * @param {String} systemUid - A unique identifier of the End-User in the external system.
   * @param {Object} authData - A JSON object containing the needed authorization info to use APIs from the external system.
   * @return {String} The unique identifier of the user in the OP server. If user doesn't exist will be generated.
   */
  async save (systemId = '', systemUid = '', authData = {}) {
    const repo = await this.repositories.getRepository(AUTH_REPO_NAME)
    let authorization = await repo.findOne({ 'systems.id': systemId, 'systems.uid': systemUid }, Authorization.fromJSON)
    if (!authorization) {
      authorization = new Authorization()
    }
    authorization.upsertSystemAuth(new SystemAuth(systemId, systemUid, authData))
    await repo.save(authorization)
    return authorization.id
  }

  /**
   * Obtain the authorization data from repository for a given system.
   * @param {String} uid - An unique user identifier in the OP server.
   * @param {String} systemId - A unique identifier of the system that has provide the authorization data, for example 'minibank', 'sanuk'...
   * @return {Object} The auth data stored for this system and user.
   */
  async getAuth (uid, systemId) {
    const repo = await this.repositories.getRepository(AUTH_REPO_NAME)
    const authorization = await repo.findById(uid, Authorization.fromJSON)
    const system = authorization.getSystem(systemId)
    return (system !== null) ? system.auth : null
  }

  /**
   * Obtain the authorization object stored for a end user.
   * @param {String} uid - An unique user identifier in the OP server.
   * @return {Authorization} The Authorization object with all the authoriztiaon user info
   */
  async get (uid) {
    const repo = await this.repositories.getRepository(AUTH_REPO_NAME)
    return repo.findById(uid, Authorization.fromJSON)
  }
}

/**
 * This class Represents the authorization data in an external system
 */
class SystemAuth {
  /**
   * Create a System Authorization
   * @param {String} id - A unique identifier of the system that has provide the authorization data, for example 'minibank', 'sanuk'...
   * @param {String} uid - A unique identifier of the End-User in the external system.
   * @param {Object} auth - A free format object that contain the authorization data for the external system.
   */
  constructor (id, uid, auth) {
    this.id = id
    this.uid = uid
    this.auth = auth
  }

  /**
   * Parse a JSON object to SystemAuth instance
   * @param {Object} obj - The JSON object to be parsed.
   * @param {bool} validate - Indicate if the method should validate for incorrect values
   */
  static fromJSON (obj, validate = false) {
    const id = obj.id || ''
    const uid = obj.uid || ''
    const auth = obj.auth || {}
    if (validate) {
      assert(isObject(auth), 'auth must be an object')
      assert(isNotEmptyString(id), 'id cannot be empty')
      assert(isNotEmptyString(uid), 'uid cannot be empty')
    }
    return new SystemAuth(id, uid, auth)
  }
}

/**
 * Class that represents the Authorization data from a End-User in the OP Server.
 */
class Authorization {
  /**
   * Create a Authorization instance
   * @param {string} id - The unique identifier of the user in the OP server. If user doesn't exist will be generated.
   * @param {Array} systems - An array of SystemAuth with multiple system auth data.
   */
  constructor (id = nanoid(), systems = []) {
    this.id = id
    this.systems = systems
  }

  /**
   * Add a system auth data to the User Authorization entity
   * @param {SystemAuth} system - Authoriztaion system data
   */
  addSystemAuth (system) {
    this.systems.push(system)
  }

  /**
   * Add or update a SystemAuth in the systems array
   * @param {SystemAuth} system - Authoriztaion system data
   */
  upsertSystemAuth (system) {
    const index = this.systems.findIndex(({ id, uid }) => id === system.id && uid === system.uid)
    if (index === -1) {
      this.addSystemAuth(system)
    } else {
      this.systems[index] = system
    }
  }

  /**
   * Get system object for a given systemId
   * @param {*} systemId -A unique identifier of the system that has provide the authorization data, for example 'minibank', 'sanuk'...
   * @return {SystemAuth} The system object that has this system id in the Authorization or null if not exist
   */
  getSystem (systemId) {
    return this.systems.find((el) => (el.id === systemId)) || null
  }

  /**
   * Parse a JSON object to Authorization instance
   * @param {Object} obj - The JSON object to be parsed.
   * @param {bool} validate - Indicate if the method should validate for incorrect values
   */
  static fromJSON (obj, validate = false) {
    if (!obj) return null
    const { id, systems = [] } = obj
    if (validate) {
      assert(isNotEmptyString(id), 'id cannot be empty')
    }
    const parsedSystem = systems.map((el) => SystemAuth.fromJSON(el, validate))
    return new Authorization(id, parsedSystem)
  }
}

/*
{
  "_id":"5e282574f919f535c7029346",
  "systems": [
    {
      "id": "sanuk",
      "uid": "XFTHGDTY34",
      "auth": {
        "token": "eiueiueiueiueieu",
        "refresh": "eiueiueiue"
      }
    },
    {
      "id": "minibank",
      "uid": "10244343435",
      "auth": {
        "token": "87878787878787"
      }
    }
  ]
}
*/

module.exports = { UserAuthorizations, Authorization, SystemAuth }
