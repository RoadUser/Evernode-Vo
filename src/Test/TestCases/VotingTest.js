const HotPocket = require('hotpocket-js-client');
const { assertTrue, assertSuccessResponse, assertEqual } = require('../test-utils');

async function runVotingTest() {
  const userKeyPair = await HotPocket.generateKeys();
  const client = await HotPocket.createClient(['wss://localhost:8081'], userKeyPair);
  const ok = await client.connect();
  assertTrue(ok, 'Unable to connect to HotPocket');

  function wrapPromise() {
    return new Promise((resolve, reject) => {
      const promiseId = Buffer.from(String(Date.now()) + Math.random().toString(16).slice(2)).toString('hex').slice(0, 20);
      const payload = { promiseId, Service: 'Voting', Action: 'CreateProposal', data: { title: 'Test Proposal', description: 'desc', options: ['Yes', 'No'], deadline: null } };
      client.on(HotPocket.events.contractOutput, (result) => {
        result.outputs.forEach((o) => {
          let out = null;
          try { out = JSON.parse(o.toString()); } catch (e) { try { const bson = require('bson'); out = bson.deserialize(o); } catch (e2) { out = null; } }
          if (out && out.promiseId === promiseId) return resolve(out);
        });
      });
      client.submitContractInput(Buffer.from(JSON.stringify(payload)));
    });
  }

  const createRes = await wrapPromise();
  assertSuccessResponse(createRes);
  const proposalId = createRes.success.id;

  // Read proposals via readonly
  const listRes = await client.submitContractReadRequest(Buffer.from(JSON.stringify({ Service: 'Voting', Action: 'ListProposals' })));
  const list = JSON.parse(listRes.toString());
  assertSuccessResponse(list);
  const found = list.success.find((p) => p.id === proposalId);
  assertTrue(!!found, 'Proposal not found in list');

  // Vote
  async function submitAndWait(action, data) {
    return new Promise((resolve) => {
      const promiseId = Buffer.from(String(Date.now()) + Math.random().toString(16).slice(2)).toString('hex').slice(0, 20);
      client.on(HotPocket.events.contractOutput, (result) => {
        result.outputs.forEach((o) => {
          let out = null;
          try { out = JSON.parse(o.toString()); } catch (e) { try { const bson = require('bson'); out = bson.deserialize(o); } catch (e2) { out = null; } }
          if (out && out.promiseId === promiseId) return resolve(out);
        });
      });
      client.submitContractInput(Buffer.from(JSON.stringify({ Service: 'Voting', Action: action, promiseId, data })));
    });
  }

  const voteRes = await submitAndWait('Vote', { proposalId: proposalId, choice: 'Yes' });
  assertSuccessResponse(voteRes);

  const tallyRespRaw = await client.submitContractReadRequest(Buffer.from(JSON.stringify({ Service: 'Voting', Action: 'Tally', data: { proposalId: proposalId } })));
  const tallyResp = JSON.parse(tallyRespRaw.toString());
  assertSuccessResponse(tallyResp);
  assertEqual(tallyResp.success.counts['Yes'], 1, 'Yes count should be 1');

  return true;
}

module.exports = { runVotingTest };
