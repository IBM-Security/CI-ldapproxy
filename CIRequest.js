/*************************************************************************************
* IBM Security Product Professional Services
* schmidtm@us.ibm.com
*
* A class that performs requests to the CI web services
*
* May 2019
*
*/
'use strict'
const request = require('request-promise-native');
const log = require('tracer').colorConsole({level:'info'});
const CIToken = require('./CIToken.js');

var token = new CIToken();

module.exports = class CIRequest {
  constructor() {
  }

  /**
   * Method to create the connection object to be used here.
   * @param {*} conf
   */
  async init(conf) {
    log.debug('CIRequest.init()');
    this.config = conf;
    token.init(conf.tenant.ui,conf.tenant.id,conf.tenant.secret);
  }

  async get(url = '/') {
    log.debug('(url): ',url);

    var options = {
      uri: this.config.tenant.ui+url,
      method: "GET",
      headers: { "authorization": "Bearer "+token.get() },
    }

    return await request(options);
  }

  async post(url = '/', Inbody) {
      log.debug('(url): ', url);
      log.trace('(body):', Inbody)

      var options = {
          uri: this.config.tenant.ui+url,
          method: "POST",
          json: true,
          headers: { "Accept": "application/json", "Content-Type": "application/json", "authorization": "Bearer "+token.get()},
          body: Inbody
      }

      return await request(options);
  }


}

