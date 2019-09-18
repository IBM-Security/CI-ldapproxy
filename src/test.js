/*************************************************************************************
* IBM Security Product Professional Services
* schmidtm@us.ibm.com
*
* Test script, takes the config input and creates the access token
* September 2019
*
*/
'use strict'
const config = require('./../dev.js');
const log = require('tracer').colorConsole({level: config.log});
const CIToken = require('./CIToken.js');
// log levels are log - trace - debug - info - warn - error


// Variables we need:
var token = new CIToken();

// Main Program
async function main() {
    log.info('start test');
    // Initialize the request but does not wait for it !

    await token.init(config.tenant.ui,config.tenant.id,config.tenant.secret)
    
    if (token.token == "") {
      log.info("Failed TEST");
      process.exit(1);
    }

    log.info('exit test');
    process.exit(0);
}

// Main Start
main();
