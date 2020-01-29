'use strict'

const nanoid = require('nanoid')
const REPO_NAME = 'Users'

// TODO what should we use for generate the unique id?
// TODO method add a system using uid? this for future when we aggregate systems.

/**
 * Class that contain the additional logic for store and retrieve User authorization data related with external systems/connections.
 * This external systems are used to obtain user information (Claims) normally using APIs, using this class is how
 * auth data is stored and retrieved.
 */
class Users {
  /**
   * Create an Users
   * @param {repositories} repositories
   */
  constructor (repositories) {
    this.repositories = repositories
  }

  /**
   * Return the repo name to the outside world.
   */
  static getRepoName () {
    return REPO_NAME
  }

  /**
   * Store connection data from an external system related with an User.
   * @param {Connection} connect - a connection for a new user or existing one
   * @return {String} - The user unique id in the OP server.
   */
  async insertOrUpdate (connection) {
    const repo = await this.repositories.getRepository(REPO_NAME)
    const { type, uid } = connection
    const query = { 'connections.type': type, 'connections.uid': uid }
    const user = (await repo.findOne(query, User.fromJSON)) || new User()
    user.setConnection(connection)
    await repo.save(user)
    return user.id
  }

  /**
   * Obtain the User object stored for a given user unique identifier
   * @param {String} id - An unique user identifier in the OP server.
   * @return {User} An object containing all the User information in the OP server
   */
  async get (id) {
    const repo = await this.repositories.getRepository(REPO_NAME)
    return repo.findById(id, User.fromJSON)
  }
}

/**
 * This class Represents the authorization data in an external system
 */
class Connection {
  /**
   * Create a Connection
   * @param {String} type - A type identifier for the system, as for example 'minibank', 'sanuk'...
   * @param {String} uid - A unique identifier of the End-User in the external system.
   * @param {Object} auth - A free format object that contain the authorization data for the external system.
   */
  constructor (type, uid, auth) {
    this.type = type
    this.uid = uid
    this.auth = auth
  }

  /**
   * Parse a JSON object to Connection instance
   * @param {Object} obj - The JSON object to be parsed.
   * @returns {Connection} - A initialized instance of the system
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
   * Create a User instance
   * @param {String} id - The unique identifier of the user in the OP server. If don't provided will be generated.
   * @param {Array<Connection>} connections - An array of Connection with multiple system auth data.
   */
  constructor (id = nanoid(), connections = []) {
    this.id = id
    this.connections = connections
  }

  /**
   * Add a Connection to the User entity
   * @param {Connection} value - External system data for the User
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
   * Get Connection for a given system type
   * @param {String} type - A type identifier for the system, as for example 'minibank', 'sanuk'...
   * @return {Connection} The Connection object containing the user information and authorization data
   */
  getConnection (type) {
    return this.connections.find((conn) => conn.type === type) || null
  }

  /**
   * Parse a JSON object to Authorization instance
   * @param {Object} obj - The JSON object to be parsed.
   * @return {Connection} - Initialized instance of the User authorization data
   */
  static fromJSON (obj) {
    if (!obj) return null
    const { id, connections = [] } = obj
    return new User(id, connections.map((conn) => Connection.fromJSON(conn)))
  }
}

module.exports = { Users, User, Connection }
