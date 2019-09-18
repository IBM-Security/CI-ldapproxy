/*************************************************************************************
* IBM Security Product Professional Services
* schmidtm@us.ibm.com
*
* A simple ldap proxy to the CIx webservices to provide the following operations
* over an LDA Protocol
* Simple Bind
* Simple user lookup, using the -b attribute and an objectclass=* search
*
* June 2019
*
*/
'use strict'
const config = require('./../dev.js');
const ldap = require('ldapjs');
const log = require('tracer').colorConsole({level: config.log});
const CIRequest = require('./CIRequest.js');
const cache = require('js-cache');
// log levels are log - trace - debug - info - warn - error


// Variables we need:
var req = new CIRequest();

// authenticate user
async function authUser(id, pwd) {
    log.debug('authUser(id,pwd) (%s,%s)',id,pwd);

    try {
      return await req.post('/v1.0/authnmethods/password/'+config.tenant.registry, {
        "username": id,
        "password": pwd
      });
    } catch (e) {
      log.error('try catch is ', e);
      return null;
    }
  }

// Build a string of group names
function buildGroups(ga) {
  let gl = [];
  if (ga != undefined) {
    ga.forEach(function(item){
      gl.push('cn='+item.displayName+','+config.ldap.root)
    })
  }
  return gl;
}
// Convert the JSON result from the CIx call to a object to be sent via ldap
// This will build a "fake" ldap entry, and from here we control how much is returned
// In most cases it is some basic attributes with the groups entry, for fine
// grained access control.
function converttoLDAP(data) {
  log.debug('entry: ' + data);

  var obj = {
    dn: config.ldap.type+data.id+","+config.ldap.root,
    attributes: {
      objectclass: ['top','person'],
      memberof: buildGroups(data.groups),
      }
  }
  return(obj);
}

// Define the ldap server functions and properties - last step is to kick it.
function runLDAPServer() {
  log.debug('entry');
  var server = ldap.createServer();

  server.bind(config.ldap.root, function(req, res, next) {
    log.debug('Bind');
    
    // get the user name and the password provided by the simple bind
    // note we need to cut out the user name, which is between the first
    // = and the first ,  uid=bob,xxx
    let id=req.dn.toString();
    id=id.substring(id.indexOf('=')+1);
    id=id.substring(0,id.indexOf(','));
    let pwd=req.credentials;
    log.trace('Login %s - %s', id, pwd);

    authUser(id, pwd).then( status => {
      if (status == null) {
        log.error('Failed authentication')
        return next(new ldap.InvalidCredentialsError());
      }
      // Stash this in the cache.
      cache.set(id,status,config.cache.ttl*1000);

      log.trace(status);
      res.end();
      return next();
    });
  });

  // most of the work happens as part of searches, we will not enable all kinds
  // of searches but only the ones needed specifically for this implementation
  // we only support a search where -b is  uid=bob,o=pps
  // In general the -D and the -b must be the same.
  // NOTE that the config.ldap.root is case sensitive, so we use a lower case!
  server.search(config.ldap.root, function(req, res, next) {
    log.debug('entry');
    let filter=req.filter.toString();
    log.trace('search filter = ', filter);
    let dn=req.baseObject.toString();
    log.trace('search dn = ', dn);

    // We do not support searches, these are really lookups
    // in other words, the username is part of the DN
    var id = dn.substring(dn.indexOf('=')+1);
    id=id.substring(0,id.indexOf(','));
    log.trace('search id in dn = ', id);
    
    // Lets lookup in the cache!
    var data = cache.get(id);
    if (data == undefined) {
      log.trace("data is: " + data);
      res.end();
      return next();

    }

    var obj =  converttoLDAP(data);

    res.send(obj);
    res.end();
    return next();
    
  });

  // Kick the server
  server.listen(config.ldap.port, function() {
    console.log('%s : LDAP server listening at %s', new Date().toLocaleString(), server.url);
  });
}

// Main Program
async function main() {
    log.info('start');
    // Initialize the request but does not wait for it !
    req.init(config);
    
    // Run the actual Server
    runLDAPServer();
    log.info('exit');
}

// Main Start
main();
