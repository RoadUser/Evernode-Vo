const fs = require('fs');
const SharedService = require('./SharedService');
const { Tables } = require('../../Constants/Tables');
const settings = require('../../settings.json').settings;
const { SqliteDatabase } = require('./dbHandler');

class UpgradeService {
  constructor(message) {
    this._message = message;
    this._db = new SqliteDatabase(settings.dbPath);
  }

  async upgradeContract() {
    let resObj = {};
    try {
      const zipData = this._message.data; // { version, description, zipBase64, zipSignatureHex }
      this._db.open();
      let row = await this._db.getLastRecord(Tables.CONTRACTVERSION);
      if (!row) row = { Version: 1.0 };

      const incomingVersion = parseFloat(zipData.version);
      const currentVersion = parseFloat(row.Version);
      if (!(incomingVersion > currentVersion)) {
        resObj.error = { code: 403, message: 'Contract version must be greater than current version.' };
        return resObj;
      }

      const zipBuffer = Buffer.from(zipData.zipBase64, 'base64');
      fs.writeFileSync(settings.newContractZipFileName, zipBuffer);

      const shellScriptContent = `#!/bin/bash\
\
echo \"Running post upgrade script...\"\
\
! command -v unzip &>/dev/null && apt-get update && apt-get install --no-install-recommends -y unzip\
\
zip_file=\"${settings.newContractZipFileName}\"\
\
unzip -o -d ./ \"$zip_file\" >>/dev/null\
\
rm \"$zip_file\" >>/dev/null\
`;
      fs.writeFileSync(settings.postExecutionScriptName, shellScriptContent);
      fs.chmodSync(settings.postExecutionScriptName, 0o777);

      const data = {
        Version: incomingVersion,
        Description: zipData.description || '',
        CreatedOn: SharedService.context.timestamp,
        LastUpdatedOn: SharedService.context.timestamp
      };
      const res = await this._db.insertValue(Tables.CONTRACTVERSION, data);
      resObj.success = { message: 'Contract upgraded', id: res.lastId };
    } catch (e) {
      resObj.error = { code: 500, message: 'Failed to upgrade contract.' };
    } finally {
      this._db.close();
    }
    return resObj;
  }
}

module.exports = UpgradeService;
