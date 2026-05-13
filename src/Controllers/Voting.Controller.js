const VotingService = require('../Services/Domain.Services/Voting.service');

class VotingController {
  constructor(message, user) {
    this._message = message;
    this._user = user;
    this._service = new VotingService(message, user);
  }

  async handleRequest() {
    try {
      switch (this._message.Action) {
        case 'CreateProposal': return await this._service.createProposal();
        case 'GetProposal': return await this._service.getProposal();
        case 'ListProposals': return await this._service.listProposals();
        case 'Vote': return await this._service.vote();
        case 'GetVotes': return await this._service.getVotes();
        case 'Tally': return await this._service.tally();
        default: return { error: { code: 400, message: 'Invalid action.' } };
      }
    } catch (e) {
      return { error: { code: 500, message: e && e.message ? e.message : 'Internal error' } };
    }
  }
}

module.exports = VotingController;
