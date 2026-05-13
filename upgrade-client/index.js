const fs = require('fs');
const path = require('path');
const nacl = require('tweetnacl');
const ContractService = require('./contract-service');
const HotPocket = require('hotpocket-js-client');

// Usage: node index.js <contractUrl> <zipFilePath> <privateKeyHex> <version> <description>

(async () => {
  const contractUrl = process.argv[2];
  const filepath = process.argv[3];
  const privateKeyHex = process.argv[4];
  const version = process.argv[5];
  const description = process.argv[6] || '';

  if (!contractUrl || !filepath || !privateKeyHex || !version) {
    console.log('Usage: node index.js <contractUrl> <zipFilePath> <privateKeyHex> <version> <description>');
    process.exit(1);
  }

  const zipBuffer = fs.readFileSync(path.resolve(filepath));
  const secretKey = Buffer.from(privateKeyHex, 'hex');
  const keyPair = nacl.sign.keyPair.fromSecretKey(new Uint8Array(secretKey));

  const userKeyPair = { publicKey: Buffer.from(keyPair.publicKey), privateKey: Buffer.from(keyPair.secretKey) };
  const contractService = new ContractService([contractUrl], userKeyPair);
  if (!(await contractService.init())) { console.log('Connection failed.'); process.exit(1); }

  const signature = nacl.sign.detached(new Uint8Array(zipBuffer), new Uint8Array(userKeyPair.privateKey));
  const payload = {
    Service: 'Upgrade',
    Action: 'UpgradeContract',
    data: {
      version: parseFloat(version),
      description: description,
      zipBase64: zipBuffer.toString('base64'),
      zipSignatureHex: Buffer.from(signature).toString('hex')
    }
  };

  try {
    const res = await contractService.submitInputToContract(payload);
    console.log('Upgrade submission result:', res);
  } catch (e) {
    console.log('Upgrade submission failed:', e);
  } finally {
    process.exit(0);
  }
})();
