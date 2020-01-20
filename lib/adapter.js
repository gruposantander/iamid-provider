'use strict'

async function unwrap (promise) {
  const raw = await promise
  if (!raw) return undefined
  const { id, expiresAt, ...doc } = raw
  return doc
}

class Adapter {
  /**
   *
   * Creates an instance of MyAdapter for an oidc-provider model.
   *
   * @constructor
   * @param {string} name Name of the oidc-provider model. One of "Session", "AccessToken",
   * "AuthorizationCode", "RefreshToken", "ClientCredentials", "Client", "InitialAccessToken",
   * "RegistrationAccessToken", "DeviceCode", "Interaction", "ReplayDetection", or "PushedAuthorizationRequest"
   *
   */
  constructor (name) {
    this.name = name
  }

  async _getRepository () {
    return Adapter.repositories.getRepository(this.name)
  }

  /**
   *
   * Update or Create an instance of an oidc-provider model.
   *
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   * @param {string} id Identifier that oidc-provider will use to reference this model instance for
   * future operations.
   * @param {object} payload Object with all properties intended for storage.
   * @param {integer} expiresIn Number of seconds intended for this model to be stored.
   *
   */
  async upsert (id, payload, expiresIn) {
    const repo = await this._getRepository()
    const doc = { id, ...payload }
    if (expiresIn) doc.expiresAt = new Date(Date.now() + (expiresIn * 1000))
    await repo.save(doc)
  }

  /**
   *
   * Return previously stored instance of an oidc-provider model.
   *
   * @return {Promise} Promise fulfilled with what was previously stored for the id (when found and
   * not dropped yet due to expiration) or falsy value when not found anymore. Rejected with error
   * when encountered.
   * @param {string} id Identifier of oidc-provider model
   *
   */
  async find (id) {
    const repo = await this._getRepository()
    return unwrap(repo.findById(id))
  }

  /**
   *
   * Return previously stored instance of DeviceCode by the end-user entered user code. You only
   * need this method for the deviceFlow feature
   *
   * @return {Promise} Promise fulfilled with the stored device code object (when found and not
   * dropped yet due to expiration) or falsy value when not found anymore. Rejected with error
   * when encountered.
   * @param {string} userCode the user_code value associated with a DeviceCode instance
   *
   */
  async findByUserCode (userCode) {
    const repo = await this._getRepository()
    return unwrap(repo.findOne({ userCode }))
  }

  /**
   *
   * Return previously stored instance of Session by its uid reference property.
   *
   * @return {Promise} Promise fulfilled with the stored session object (when found and not
   * dropped yet due to expiration) or falsy value when not found anymore. Rejected with error
   * when encountered.
   * @param {string} uid the uid value associated with a Session instance
   *
   */
  async findByUid (uid) {
    const repo = await this._getRepository()
    return unwrap(repo.findOne({ uid }))
  }

  /**
   *
   * Mark a stored oidc-provider model as consumed (not yet expired though!). Future finds for this
   * id should be fulfilled with an object containing additional property named "consumed" with a
   * truthy value (timestamp, date, boolean, etc).
   *
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   * @param {string} id Identifier of oidc-provider model
   *
   */
  async consume (id) {
    const repo = await this._getRepository()
    repo.updateById(id, { consumed: Math.floor(Date.now() / 1000) })
  }

  /**
   *
   * Destroy/Drop/Remove a stored oidc-provider model. Future finds for this id should be fulfilled
   * with falsy values.
   *
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   * @param {string} id Identifier of oidc-provider model
   *
   */
  async destroy (id) {
    const repo = await this._getRepository()
    await repo.deleteById(id)
  }

  /**
   *
   * Destroy/Drop/Remove a stored oidc-provider model by its grantId property reference. Future
   * finds for all tokens having this grantId value should be fulfilled with falsy values.
   *
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   * @param {string} grantId the grantId value associated with a this model's instance
   *
   */
  async revokeByGrantId (grantId) {
    const repo = await this._getRepository()
    await repo.deleteMany({ grantId })
  }

  static initialize (repositories) {
    Adapter.repositories = repositories
  }
}

module.exports = Adapter
