const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class SharedService {
  static context = null;
  static nplEventEmitter = new EventEmitter();

  static generateUUID() { return uuidv4(); }

  static getUtcISOStringFromUnixTimestamp(milliseconds) {
    const date = new Date(milliseconds);
    return date.toISOString();
  }

  static getCurrentTimestamp() {
    return this.getUtcISOStringFromUnixTimestamp(this.context.timestamp);
  }

  static addHours(timestamp, hoursToAdd) {
    const date = new Date(timestamp);
    date.setHours(date.getHours() + hoursToAdd);
    return this.getUtcISOStringFromUnixTimestamp(date.getTime());
  }

  static generateConcurrencyKey() {
    const timestamp = this.getCurrentTimestamp();
    const extractedTimestamp = timestamp.replace(/\D/g, "");
    const timestampHex = Number(extractedTimestamp).toString(16).toUpperCase().padStart(14, '0');
    const checksum = 16 - timestampHex.length;
    const concurrencyKey = `0x${'0'.repeat(checksum)}${timestampHex}`;
    return concurrencyKey;
  }
}

module.exports = SharedService;
