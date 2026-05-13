const { ServiceTypes } = require('./Constants/ServiceTypes');
const VotingController = require('./Controllers/Voting.Controller');
const UpgradeController = require('./Controllers/Upgrade.Controller');

class Controller {
  async handleRequest(user, message, isReadOnly) {
    let result = {};
    try {
      if (!message || !message.Service || !message.Action) {
        result = { error: { code: 400, message: 'Invalid request' } };
      } else if (message.Service === ServiceTypes.VOTING) {
        const ctrl = new VotingController(message, user);
        result = await ctrl.handleRequest();
      } else if (message.Service === ServiceTypes.UPGRADE) {
        const ctrl = new UpgradeController(message);
        result = await ctrl.handleRequest(user);
      } else {
        result = { error: { code: 400, message: 'Unknown service' } };
      }
    } catch (e) {
      result = { error: { code: 500, message: 'Internal server error' } };
    }

    // Echo back with promiseId if present
    if (message && message.promiseId) result.promiseId = message.promiseId;
    try { await user.send(result); } catch (e) { /* ignore */ }
  }
}

module.exports = Controller;
