const UpgradeService = require('../Services/Common.Services/Upgrade.Service');
const env = require('../Utils/Environment');
const CryptoHelper = require('../Utils/Crypto.Helper');

function isMaintainer(userPubKeyHex) {
  if (!env.MAINTAINER_PUBKEY || typeof env.MAINTAINER_PUBKEY !== 'string' || !env.MAINTAINER_PUBKEY.trim()) return false;
  try {
    return userPubKeyHex.toLowerCase() === env.MAINTAINER_PUBKEY.toLowerCase();
  } catch (e) { return false; }
}

class UpgradeController {
  constructor(message) {
    this._message = message;
    this._service = new UpgradeService(message);
  }

  async handleRequest(user) {
    try {
      if (this._message.Action === 'UpgradeContract') {
        const userPubKey = user.pubKey || user.publicKey || '';
        const pubHex = Buffer.isBuffer(userPubKey) ? Buffer.from(userPubKey).toString('hex') : (typeof userPubKey === 'string' ? userPubKey : '');
        if (!isMaintainer(pubHex)) {
          return { error: { code: 401, message: 'Unauthorized' } };
        }
        const data = this._message.data || {};
        if (!data.zipBase64 || !data.zipSignatureHex || typeof data.version === 'undefined') {
          return { error: { code: 400, message: 'Invalid upgrade payload.' } };
        }
        const zipBuffer = Buffer.from(data.zipBase64, 'base64');
        const verified = CryptoHelper.verifyEd25519Detached(zipBuffer, data.zipSignatureHex, env.MAINTAINER_PUBKEY);
        if (!verified) {
          return { error: { code: 401, message: 'Signature verification failed.' } };
        }
        return await this._service.upgradeContract();
      }
      return { error: { code: 400, message: 'Invalid action.' } };
    } catch (e) {
      return { error: { code: 500, message: 'Upgrade handling failed.' } };
    }
  }
}

module.exports = UpgradeController;
