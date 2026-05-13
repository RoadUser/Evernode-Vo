const HotPocket = require('hotpocket-js-client');
const bson = require('bson');

class ContractService {
  constructor(servers, userKeyPair) {
    this.userKeyPair = userKeyPair;
    this.client = null;
    this.servers = servers;
    this.isConnectionSucceeded = false;
    this.promiseMap = new Map();
  }

  async init() {
    if (!this.client) {
      this.client = await HotPocket.createClient(this.servers, this.userKeyPair, { protocol: HotPocket.protocols.bson });
    }

    this.client.on(HotPocket.events.disconnect, () => { this.isConnectionSucceeded = false; });
    this.client.on(HotPocket.events.connectionChange, (server, action) => { /* console */ });
    this.client.on(HotPocket.events.contractOutput, (r) => {
      r.outputs.forEach((o) => {
        let output = null;
        try { output = bson.deserialize(o); } catch (e) { try { output = JSON.parse(o.toString()); } catch (e2) { output = null; } }
        if (!output) return;
        const pId = output.promiseId;
        if (output.error) this.promiseMap.get(pId)?.rejecter(output.error);
        else this.promiseMap.get(pId)?.resolver(output.success || output);
        this.promiseMap.delete(pId);
      });
    });

    if (!this.isConnectionSucceeded) {
      if (!(await this.client.connect())) return false;
      this.isConnectionSucceeded = true;
    }
    return true;
  }

  submitInputToContract(inp) {
    const promiseId = this._uniqueId();
    const payload = bson.serialize({ promiseId, ...inp });
    this.client.submitContractInput(payload).then((input) => {
      input?.submissionStatus.then((s) => { if (s.status !== 'accepted') throw new Error(`Ledger_Rejection: ${s.reason}`); });
    });

    return new Promise((resolve, reject) => {
      this.promiseMap.set(promiseId, { resolver: resolve, rejecter: reject });
    });
  }

  async submitReadRequest(inp) {
    const payload = bson.serialize(inp);
    const output = await this.client.submitContractReadRequest(payload);
    let res = null;
    try { res = bson.deserialize(output); } catch (e) { res = JSON.parse(output.toString()); }
    if (res.error) throw res.error; else return res.success || res;
  }

  _uniqueId() {
    return Buffer.from(String(Date.now()) + Math.random().toString(16).slice(2)).toString('hex').slice(0, 20);
  }
}

module.exports = ContractService;
