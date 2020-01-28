'use strict'

const nanoid = require('nanoid')
const AUTH_REPO_NAME = 'Users'

// TODO what should we use for generate the unique id?
// TODO method add a system using uid? this for future when we aggregate systems.

/**
 * Class that contain the additional logic for store and retrieve authorization data related with external systems.
 * This external systems are used to obtain user information (Claims) normally using APIs, using this class is how
 * auth data is stored and retrieved.
 */
class Users {
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
   * Store connection data from an external system related with an user.
   * @param {Connection} connect - a new connection for a new user or existing one
   */
  async insertOrUpdate (connection) {
    const repo = await this.repositories.getRepository(AUTH_REPO_NAME)
    const { type, uid } = connection
    const query = { 'connections.type': type, 'connections.uid': uid }
    const user = (await repo.findOne(query, User.fromJSON)) || new User()
    user.setConnection(connection)
    await repo.save(user)
    return user.id
  }

  /**
   * Obtain the authorization object stored for a end user.
   * @param {String} uid - An unique user identifier in the OP server.
   * @return {User} The Authorization object with all the authoriztiaon user info
   */
  async get (id) {
    const repo = await this.repositories.getRepository(AUTH_REPO_NAME)
    return repo.findById(id, User.fromJSON)
  }
}

/**
 * This class Represents the authorization data in an external system
 */
class Connection {
  /**
   * Create a System Authorization
   * @param {String} type
   * @param {String} uid - A unique identifier of the End-User in the external system.
   * @param {Object} auth - A free format object that contain the authorization data for the external system.
   */
  constructor (type, uid, auth) {
    this.type = type
    this.uid = uid
    this.auth = auth
  }

  /**
   * Parse a JSON object to SystemAuth instance
   * @param {Object} obj - The JSON object to be parsed.
   */
  static fromJSON (obj) {
    const { type, uid, auth } = obj
    return new Connection(type, uid, auth)
  }
}

/**
 * Class that represents the User data from a End-User in the OP Server.
 */
class User {
  /**
   * Create a Authorization instance
   * @param {string} id - The unique identifier of the user in the OP server. If user doesn't exist will be generated.
   * @param {Array<Connection>} connections - An array of SystemAuth with multiple system auth data.
   */
  constructor (id = nanoid(), connections = []) {
    this.id = id
    this.connections = connections
  }

  /**
   * Add a system auth data to the User Authorization entity
   * @param {Connection} value - Authorization system data
   */
  setConnection (connection) {
    const index = this.connections.findIndex((conn) => conn.type === connection.type)
    if (index !== -1) {
      this.connections[index] = connection
    } else {
      this.connections.push(connection)
    }
  }

  /**
   * Get system object for a given systemId
   * @param {string} systemId -A unique identifier of the system that has provide the authorization data, for example 'minibank', 'sanuk'...
   * @return {Connection} The system object that has this system id in the Authorization or null if not exist
   */
  getConnection (type) {
    return this.connections.find((conn) => conn.type === type) || null
  }

  /**
   * Parse a JSON object to Authorization instance
   * @param {Object} obj - The JSON object to be parsed.
   */
  static fromJSON (obj) {
    if (!obj) return null
    const { id, connections = [] } = obj
    return new User(id, connections.map((conn) => Connection.fromJSON(conn)))
  }
}

module.exports = { Users, User, Connection }
