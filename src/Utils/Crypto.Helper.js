const nacl = require('tweetnacl');

module.exports = {
  verifyEd25519Detached: function(messageBuffer, signatureHex, publicKeyHex) {
    try {
      const sig = Buffer.from(signatureHex, 'hex');
      const pub = Buffer.from(publicKeyHex, 'hex');
      const ok = nacl.sign.detached.verify(new Uint8Array(messageBuffer), new Uint8Array(sig), new Uint8Array(pub));
      return ok;
    } catch (e) {
      return false;
    }
  }
};
