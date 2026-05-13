const { Tables } = require('../../Constants/Tables');
const SharedService = require('../Common.Services/SharedService');
const { SqliteDatabase } = require('../Common.Services/dbHandler');
const settings = require('../../settings.json').settings;

class VotingService {
  constructor(message, user) {
    this._message = message;
    this._user = user;
    this._db = new SqliteDatabase(settings.dbPath);
  }

  _userPubHex() {
    const pk = this._user && (this._user.pubKey || this._user.publicKey);
    return Buffer.isBuffer(pk) ? Buffer.from(pk).toString('hex') : (typeof pk === 'string' ? pk : '');
  }

  async createProposal() {
    const m = this._message.data || {};
    if (!m.title || !Array.isArray(m.options) || m.options.length < 1) {
      return { error: { code: 400, message: 'title and options[] required' } };
    }
    const deadline = m.deadline || null; // ISO8601 or null
    const optionsText = JSON.stringify(m.options);
    const creator = this._userPubHex();

    this._db.open();
    try {
      const data = {
        Title: m.title,
        Description: m.description || '',
        Options: optionsText,
        CreatorPubKey: creator || 'unknown',
        Deadline: deadline,
        Status: 'Open',
        ConcurrencyKey: SharedService.generateConcurrencyKey()
      };
      const res = await this._db.insertValue(Tables.PROPOSALS, data);
      return { success: { id: res.lastId } };
    } finally {
      this._db.close();
    }
  }

  async getProposal() {
    const id = (this._message.data && this._message.data.id) || null;
    if (!id) return { error: { code: 400, message: 'id required' } };
    this._db.open();
    try {
      const rows = await this._db.getValues(Tables.PROPOSALS, { Id: id });
      if (!rows.length) return { error: { code: 404, message: 'Not found' } };
      const p = rows[0];
      return { success: this._mapProposal(p) };
    } finally { this._db.close(); }
  }

  async listProposals() {
    this._db.open();
    try {
      const rows = await this._db.getValues(Tables.PROPOSALS, {});
      return { success: rows.map((p) => this._mapProposal(p)) };
    } finally { this._db.close(); }
  }

  async vote() {
    const m = this._message.data || {};
    const id = m.proposalId;
    const choice = m.choice;
    if (!id || typeof choice === 'undefined') return { error: { code: 400, message: 'proposalId and choice required' } };

    const voter = this._userPubHex();
    this._db.open();
    try {
      const props = await this._db.getValues(Tables.PROPOSALS, { Id: id });
      if (!props.length) return { error: { code: 404, message: 'Proposal not found' } };
      const prop = props[0];
      if (prop.Status !== 'Open') return { error: { code: 400, message: 'Proposal is not open' } };
      if (prop.Deadline) {
        const now = new Date(SharedService.getCurrentTimestamp());
        if (now > new Date(prop.Deadline)) return { error: { code: 400, message: 'Deadline passed' } };
      }
      const options = JSON.parse(prop.Options || '[]');
      if (!options.includes(choice)) return { error: { code: 400, message: 'Invalid choice' } };

      const dup = await this._db.getValues(Tables.VOTES, { ProposalId: id, VoterPubKey: voter });
      if (dup.length) return { error: { code: 400, message: 'Already voted' } };

      const voteData = {
        ProposalId: id,
        VoterPubKey: voter || 'unknown',
        Choice: choice,
        Weight: 1,
        ConcurrencyKey: SharedService.generateConcurrencyKey()
      };
      const res = await this._db.insertValue(Tables.VOTES, voteData);
      return { success: { id: res.lastId } };
    } finally { this._db.close(); }
  }

  async getVotes() {
    const id = (this._message.data && this._message.data.proposalId) || null;
    if (!id) return { error: { code: 400, message: 'proposalId required' } };
    this._db.open();
    try {
      const rows = await this._db.getValues(Tables.VOTES, { ProposalId: id });
      return { success: rows.map((v) => ({ id: v.Id, voterPubKey: v.VoterPubKey, choice: v.Choice, weight: v.Weight })) };
    } finally { this._db.close(); }
  }

  async tally() {
    const id = (this._message.data && this._message.data.proposalId) || null;
    if (!id) return { error: { code: 400, message: 'proposalId required' } };
    this._db.open();
    try {
      const props = await this._db.getValues(Tables.PROPOSALS, { Id: id });
      if (!props.length) return { error: { code: 404, message: 'Proposal not found' } };
      const prop = props[0];
      const options = JSON.parse(prop.Options || '[]');
      const rows = await this._db.getValues(Tables.VOTES, { ProposalId: id });
      const counts = {};
      for (const opt of options) counts[opt] = 0;
      for (const v of rows) { counts[v.Choice] = (counts[v.Choice] || 0) + (v.Weight || 1); }

      // Close if deadline passed
      let status = prop.Status;
      if (prop.Deadline) {
        const now = new Date(SharedService.getCurrentTimestamp());
        if (now > new Date(prop.Deadline)) {
          await this._db.updateValue(Tables.PROPOSALS, { Status: 'Closed' }, { Id: id });
          status = 'Closed';
        }
      }
      return { success: { proposalId: id, status: status, counts: counts } };
    } finally { this._db.close(); }
  }

  _mapProposal(p) {
    return {
      id: p.Id,
      title: p.Title,
      description: p.Description,
      options: JSON.parse(p.Options || '[]'),
      creatorPubKey: p.CreatorPubKey,
      deadline: p.Deadline,
      status: p.Status,
      createdOn: p.CreatedOn,
      lastUpdatedOn: p.LastUpdatedOn
    };
  }
}

module.exports = VotingService;
