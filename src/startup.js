const HotPocket = require('hotpocket-nodejs-contract');
const Controller = require('./controller');
const DBInitializer = require('./Data.Deploy/initDB');
const SharedService = require('./Services/Common.Services/SharedService');

const contract = async (ctx) => {
  console.log('Voting contract is running.');
  SharedService.context = ctx;

  if (!ctx.readonly) {
    ctx.unl.onMessage((node, msg) => {
      try {
        const obj = JSON.parse(msg.toString());
        if (obj.type) SharedService.nplEventEmitter.emit(obj.type, node, msg);
      } catch (e) { /* ignore */ }
    });
  }

  try { await DBInitializer.init(); } catch (e) { console.error('DB init error', e); }

  const controller = new Controller();
  for (const user of ctx.users.list()) {
    for (const input of user.inputs) {
      const buf = await ctx.users.read(input);
      let message = null;
      try { message = JSON.parse(buf); } catch (e) { try { const bson = require('bson'); message = bson.deserialize(buf); } catch (e2) { message = null; } }
      if (!message || typeof message !== 'object') message = {};
      await controller.handleRequest(user, message, ctx.readonly);
    }
  }
};

const hpc = new HotPocket.Contract();
hpc.init(contract, HotPocket.clientProtocols.JSON, true);
