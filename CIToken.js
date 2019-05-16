/*************************************************************************************
* IBM Security Product Professional Services
* schmidtm@us.ibm.com
*
* A class that gets and manages a CI token for web services
*
* April 2019
*
*/
const request = require('request-promise-native');
const log = require('tracer').colorConsole({level:'warn'});


module.exports = class CIToken {
  constructor() {
    this.token = "";
  }

  async init(uri, clientId, clientSecret) {
    log.debug('CIToken.init()');
    let options = {
        uri: uri+"/v2.0/endpoint/default/token",
        form: {
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials'
        }
    }
    try {
      let req = await request.post(options);
      this.token = JSON.parse(req).access_token;
      log.info('CIToken.init() token is - [%s]', this.token);
      setTimeout(async () => this.init(uri, clientId, clientSecret), (JSON.parse(req).expires_in - 5) * 1000);
    } catch (e) {
      log.error('CIToken.init() try catch is ', e);
    }
  }

  get() {
    return this.token;
  }
}
