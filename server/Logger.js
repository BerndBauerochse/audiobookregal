const date = require('./libs/dateAndTime')
const { LogLevel } = require('./utils/constants')
const util = require('util')

/**
 * Privacy Enhancement: Utility function to anonymize IP addresses
 * Masks the last octet of IPv4 addresses and the last 80 bits of IPv6 addresses
 * @param {string} ip - The IP address to anonymize
 * @returns {string} - Anonymized IP address
 */
function anonymizeIP(ip) {
  if (!ip || typeof ip !== 'string') return 'unknown'

  // Handle IPv4
  if (ip.includes('.') && !ip.includes(':')) {
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`
    }
  }

  // Handle IPv6 (including IPv4-mapped IPv6)
  if (ip.includes(':')) {
    // For IPv4-mapped IPv6 (::ffff:192.168.1.1)
    if (ip.includes('::ffff:')) {
      const ipv4Part = ip.split('::ffff:')[1]
      if (ipv4Part) {
        const parts = ipv4Part.split('.')
        if (parts.length === 4) {
          return `::ffff:${parts[0]}.${parts[1]}.${parts[2]}.xxx`
        }
      }
    }
    // For pure IPv6, mask the last 5 groups (80 bits)
    const parts = ip.split(':')
    if (parts.length >= 4) {
      return `${parts.slice(0, 3).join(':')}:xxxx:xxxx:xxxx:xxxx:xxxx`
    }
  }

  return 'anonymized'
}

class Logger {
  constructor() {
    /** @type {import('./managers/LogManager')} */
    this.logManager = null

    this.isDev = process.env.NODE_ENV !== 'production'

    this.logLevel = !this.isDev ? LogLevel.INFO : LogLevel.TRACE
    this.socketListeners = []
  }

  /**
   * Privacy Enhancement: Anonymize IP address for GDPR compliance
   * @param {string} ip - The IP address to anonymize
   * @returns {string} - Anonymized IP address
   */
  static anonymizeIP(ip) {
    return anonymizeIP(ip)
  }

  /**
   * @returns {string}
   */
  get timestamp() {
    return date.format(new Date(), 'YYYY-MM-DD HH:mm:ss.SSS')
  }

  get levelString() {
    return this.getLogLevelString(this.logLevel)
  }

  /**
   * @returns {string}
   */
  get source() {
    const regex = global.isWin ? /^.*\\([^\\:]*:[0-9]*):[0-9]*\)*/ : /^.*\/([^/:]*:[0-9]*):[0-9]*\)*/
    return Error().stack.split('\n')[3].replace(regex, '$1')
  }

  getLogLevelString(level) {
    for (const key in LogLevel) {
      if (LogLevel[key] === level) {
        return key
      }
    }
    return 'UNKNOWN'
  }

  addSocketListener(socket, level) {
    var index = this.socketListeners.findIndex((s) => s.id === socket.id)
    if (index >= 0) {
      this.socketListeners.splice(index, 1, {
        id: socket.id,
        socket,
        level
      })
    } else {
      this.socketListeners.push({
        id: socket.id,
        socket,
        level
      })
    }
  }

  removeSocketListener(socketId) {
    this.socketListeners = this.socketListeners.filter((s) => s.id !== socketId)
  }

  /**
   * Privacy Enhancement: Anonymize IP addresses in log messages
   * @param {string} message - The log message
   * @returns {string} - Message with anonymized IPs
   */
  #anonymizeIPsInMessage(message) {
    if (!message || typeof message !== 'string') return message

    // IPv4 pattern (including those in IPv6 format)
    const ipv4Pattern = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g
    message = message.replace(ipv4Pattern, (match, p1, p2, p3, p4) => {
      // Validate it's a real IP (each octet 0-255)
      if ([p1, p2, p3, p4].every(octet => parseInt(octet) <= 255)) {
        return `${p1}.${p2}.${p3}.xxx`
      }
      return match
    })

    // IPv6 pattern (simplified - full addresses)
    const ipv6Pattern = /\b([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g
    message = message.replace(ipv6Pattern, (match) => {
      const parts = match.split(':')
      return `${parts.slice(0, 3).join(':')}:xxxx:xxxx:xxxx:xxxx:xxxx`
    })

    return message
  }

  /**
   *
   * @param {number} level
   * @param {string} levelName
   * @param {string[]} args
   * @param {string} src
   */
  async #logToFileAndListeners(level, levelName, args, src) {
    const expandedArgs = args.map((arg) => (typeof arg !== 'string' ? util.inspect(arg) : arg))

    // Privacy Enhancement: Anonymize any IP addresses in log messages
    const anonymizedMessage = this.#anonymizeIPsInMessage(expandedArgs.join(' '))

    const logObj = {
      timestamp: this.timestamp,
      source: src,
      message: anonymizedMessage,
      levelName,
      level
    }

    // Emit log to sockets that are listening to log events
    this.socketListeners.forEach((socketListener) => {
      if (level >= LogLevel.FATAL || level >= socketListener.level) {
        socketListener.socket.emit('log', logObj)
      }
    })

    // Save log to file
    if (level >= LogLevel.FATAL || level >= this.logLevel) {
      await this.logManager?.logToFile(logObj)
    }
  }

  setLogLevel(level) {
    this.logLevel = level
    this.debug(`Set Log Level to ${this.levelString}`)
  }

  static ConsoleMethods = {
    TRACE: 'trace',
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    FATAL: 'error',
    NOTE: 'log'
  }

  #log(levelName, source, ...args) {
    const level = LogLevel[levelName]
    if (level < LogLevel.FATAL && level < this.logLevel) return
    const consoleMethod = Logger.ConsoleMethods[levelName]
    console[consoleMethod](`[${this.timestamp}] ${levelName}:`, ...args)
    return this.#logToFileAndListeners(level, levelName, args, source)
  }

  trace(...args) {
    this.#log('TRACE', this.source, ...args)
  }

  debug(...args) {
    this.#log('DEBUG', this.source, ...args)
  }

  info(...args) {
    this.#log('INFO', this.source, ...args)
  }

  warn(...args) {
    this.#log('WARN', this.source, ...args)
  }

  error(...args) {
    this.#log('ERROR', this.source, ...args)
  }

  fatal(...args) {
    return this.#log('FATAL', this.source, ...args)
  }

  note(...args) {
    this.#log('NOTE', this.source, ...args)
  }
}
module.exports = new Logger()
