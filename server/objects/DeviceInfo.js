const uuidv4 = require("uuid").v4

// Privacy Enhancement: Generic device identifiers for anonymization
const PRIVACY_GENERIC_DEVICE = {
  clientName: 'Generic Client',
  deviceName: 'Generic Device',
  model: 'Generic Device',
  manufacturer: 'Generic',
  osName: 'Generic OS',
  osVersion: '',
  browserName: 'Generic Browser',
  browserVersion: '',
  sdkVersion: null
}

class DeviceInfo {
  constructor(deviceInfo = null) {
    this.id = null
    this.userId = null
    this.deviceId = null
    this.ipAddress = null

    // From User Agent (see: https://www.npmjs.com/package/ua-parser-js)
    this.browserName = null
    this.browserVersion = null
    this.osName = null
    this.osVersion = null
    this.deviceType = null

    // From client
    this.clientVersion = null
    this.manufacturer = null
    this.model = null
    this.sdkVersion = null // Android Only

    this.clientName = null
    this.deviceName = null

    if (deviceInfo) {
      this.construct(deviceInfo)
    }
  }

  construct(deviceInfo) {
    for (const key in deviceInfo) {
      if (deviceInfo[key] !== undefined && this[key] !== undefined) {
        this[key] = deviceInfo[key]
      }
    }
  }

  toJSON() {
    const obj = {
      id: this.id,
      userId: this.userId,
      deviceId: this.deviceId,
      ipAddress: this.ipAddress,
      browserName: this.browserName,
      browserVersion: this.browserVersion,
      osName: this.osName,
      osVersion: this.osVersion,
      deviceType: this.deviceType,
      clientVersion: this.clientVersion,
      manufacturer: this.manufacturer,
      model: this.model,
      sdkVersion: this.sdkVersion,
      clientName: this.clientName,
      deviceName: this.deviceName
    }
    for (const key in obj) {
      if (obj[key] === null || obj[key] === undefined) {
        delete obj[key]
      }
    }
    return obj
  }

  /**
   * Privacy Enhancement: Returns anonymized device info for admin-visible contexts
   * This prevents surveillance of specific device types/models while maintaining sync functionality
   * @returns {Object}
   */
  toAnonymizedJSON() {
    return {
      id: this.id,
      userId: this.userId,
      deviceId: this.deviceId,
      ipAddress: null, // IP is anonymized separately
      browserName: PRIVACY_GENERIC_DEVICE.browserName,
      browserVersion: PRIVACY_GENERIC_DEVICE.browserVersion,
      osName: PRIVACY_GENERIC_DEVICE.osName,
      osVersion: PRIVACY_GENERIC_DEVICE.osVersion,
      deviceType: 'generic',
      clientVersion: this.clientVersion,
      manufacturer: PRIVACY_GENERIC_DEVICE.manufacturer,
      model: PRIVACY_GENERIC_DEVICE.model,
      sdkVersion: PRIVACY_GENERIC_DEVICE.sdkVersion,
      clientName: PRIVACY_GENERIC_DEVICE.clientName,
      deviceName: PRIVACY_GENERIC_DEVICE.deviceName
    }
  }

  get deviceDescription() {
    // Privacy Enhancement: Return generic device description to prevent device fingerprinting
    return `${PRIVACY_GENERIC_DEVICE.deviceName} / v${this.clientVersion || 'Unknown'}`
  }

  /**
   * Original device description (for internal use only, not exposed to admin UIs)
   * @returns {string}
   */
  get deviceDescriptionInternal() {
    if (this.model) { // Set from mobile apps
      if (this.sdkVersion) return `${this.model} SDK ${this.sdkVersion} / v${this.clientVersion}`
      return `${this.model} / v${this.clientVersion}`
    }
    return `${this.osName} ${this.osVersion} / ${this.browserName}`
  }

  // When client doesn't send a device id
  // Privacy Enhancement: Use only non-identifying data for temp device ID
  getTempDeviceId() {
    const keys = [
      this.userId,
      this.clientVersion,
      uuidv4() // Add randomness instead of device fingerprinting data
    ].map(k => k || '')
    return 'temp-' + Buffer.from(keys.join('-'), 'utf-8').toString('base64')
  }

  setData(ip, ua, clientDeviceInfo, serverVersion, userId) {
    this.id = uuidv4()
    this.userId = userId
    this.deviceId = clientDeviceInfo?.deviceId || this.id

    // Privacy Enhancement: Anonymize IP address (store null, real IP handled separately for logging with anonymization)
    this.ipAddress = null

    // Privacy Enhancement: Store generic device info instead of actual device fingerprints
    this.browserName = PRIVACY_GENERIC_DEVICE.browserName
    this.browserVersion = PRIVACY_GENERIC_DEVICE.browserVersion
    this.osName = PRIVACY_GENERIC_DEVICE.osName
    this.osVersion = PRIVACY_GENERIC_DEVICE.osVersion
    this.deviceType = 'generic'

    this.clientVersion = clientDeviceInfo?.clientVersion || serverVersion
    this.manufacturer = PRIVACY_GENERIC_DEVICE.manufacturer
    this.model = PRIVACY_GENERIC_DEVICE.model
    this.sdkVersion = PRIVACY_GENERIC_DEVICE.sdkVersion

    this.clientName = PRIVACY_GENERIC_DEVICE.clientName
    this.deviceName = PRIVACY_GENERIC_DEVICE.deviceName

    if (!this.deviceId) {
      this.deviceId = this.getTempDeviceId()
    }
  }

  update(deviceInfo) {
    const deviceInfoJson = deviceInfo.toJSON ? deviceInfo.toJSON() : deviceInfo
    const existingDeviceInfoJson = this.toJSON()

    let hasUpdates = false
    for (const key in deviceInfoJson) {
      if (['id', 'deviceId'].includes(key)) continue

      if (deviceInfoJson[key] !== existingDeviceInfoJson[key]) {
        this[key] = deviceInfoJson[key]
        hasUpdates = true
      }
    }

    for (const key in existingDeviceInfoJson) {
      if (['id', 'deviceId'].includes(key)) continue

      if (existingDeviceInfoJson[key] && !deviceInfoJson[key]) {
        this[key] = null
        hasUpdates = true
      }
    }

    return hasUpdates
  }
}
module.exports = DeviceInfo