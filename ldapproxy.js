/*************************************************************************************
* IBM Security Product Professional Services
* schmidtm@us.ibm.com
*
* A simple ldap proxy to the CIx webservices to provide the following operations
* over an LDA Protocol
* Simple Bind
* Simple Search (no wild cards, i.e. a person lookup)
* Simple User create using ldif
*
* April 2019
*
*/
'use strict'
const config = require('./config/dev.js');
const CIToken = require('./CIToken.js');
const ldap = require('ldapjs');
const request = require('request-promise-native');
const log = require('tracer').colorConsole({level: config.log});
// log levels are log - trace - debug - info - warn - error


// Variables we need:
var token = new CIToken();

// authenticate user
async function authUser(id, pwd) {
    log.debug('authUser(id,pwd) (%s,%s)',id,pwd);

    var options = {
      uri: config.tenant.ui+'/v1.0/authnmethods/password/'+config.tenant.registry,
      method: "POST",
      json: true,
      headers: { "Accept": "application/json", "Content-Type": "application/json", "authorization": "Bearer "+token.get() },
      body: {
        "username": id,
        "password": pwd
      }
    }

    try {
      return await request(options);
    } catch (e) {
      log.error('try catch is ', e);
      return null;
    }
  }

// get a single user by name
async function getUserbyName(id) {
    log.debug('(id) (%s)', id);

    var options = {
      uri: config.tenant.ui+'/v2.0/Users?filter=userName eq "' + id + '"',
      method: "GET",
      headers: { "authorization": "Bearer "+token.get() },
    }

    try {
      let cred = await request(options);
      cred = JSON.parse(cred);

      // if we do not find a user we do not throw any error so check if result is 0
      if (cred.totalResults != 1) {
          log.warn('Error with totalResults %s', cred.totalResults);
          return null;
      }
      return cred;
    } catch (e) {
      log.error('try catch is %s', e);
      return null;
    }
}

// get a single user by id
async function getUser(id) {
  log.debug('(id) (%s)', id);
  var options = {
    uri: config.tenant.ui+'/v2.0/Users/' + id,
    method: "GET",
    headers: { "authorization": "Bearer "+token.get() },
  }

  try {
    let cred = await request(options);
    return JSON.parse(cred);
  } catch (e) {
    log.error('try catch is ', e);
    return null;
  }
}

// add a single user
async function addUser(user) {
  log.trace('user:', user);

  var options = {
    uri: config.tenant.ui+'/v2.0/Users',
    method: "POST",
    headers: { "authorization": "Bearer "+token.get(), "Content-Type":"application/scim+json" },
    body: JSON.stringify(user)
  }

  try {
    return await request(options);
  } catch (e) {
    // if we already have the user, ignore it.
    // surpress the long error message and just display the short.
    log.info('Failed with ',e.message)
    log.trace('try catch is', e);
    
    return e.statusCode;
  }
}
// Build a string of group names
function buildGroups(ga) {
  let gl = [];
  if (ga != undefined) {
    ga.forEach(function(item){
      gl.push(item.displayName)
    })
  }
  return gl;
}
// Build a string of emails
function buildEMails(ea) {
  let el = [];
  if (ea != undefined) {
    ea.forEach(function(item){
      el.push(item.type+'-'+item.value)
    })
  }
  return el;
}
// Convert the JSON result from the CIx call to a object to be sent via ldap
// This will build a "fake" ldap entry, and from here we control how much is returned
// In most cases it is some basic attributes with the groups entry, for fine
// grained access control.
// We only print a single entry, all others will fail i.e. 0 or 2 or more.
function converttoLDAP(dn, user, id) {
  log.debug('entry');
  log.trace(JSON.stringify(user.Resources[0]));

  var obj = {
    dn: config.ldap.type+dn+","+config.ldap.root,
    attributes: {
      objectclass: ['top','person','organizationalPerson','inetOrgPerson','ePerson'],
      cn: dn,
      uid: dn,
      sn: dn,
      description: '',
      sn: user.Resources[0].name.familyName,
      givenName: user.Resources[0].name.givenName,
      active: user.Resources[0].active,
      id: user.Resources[0].id,
      userName: user.Resources[0].name.userName,
      email: buildEMails(id.emails),
      phone: buildEMails(id.phoneNumbers),
      memberof: buildGroups(id.groups),
      created: id.meta.created,
      lastModified: id.meta.lastModified,
      pwdChangedTime: id['urn:ietf:params:scim:schemas:extension:ibm:2.0:User'].pwdChangedTime,
      userCategory: id['urn:ietf:params:scim:schemas:extension:ibm:2.0:User'].userCategory,
      twoFactorauth: id['urn:ietf:params:scim:schemas:extension:ibm:2.0:User'].twoFactorAuthentication,
      realm: id['urn:ietf:params:scim:schemas:extension:ibm:2.0:User'].realm
    }
  }
  return(obj);
}

// Convert the object to JSON 
function convertfromLDAP(user) {
  log.debug('entry');
  log.trace(JSON.stringify(user));
  let obj;

  try {
    obj = {
      userName: user.uid[0],
      displayName: user.displayname[0],
      name: {
        givenName: user.givenname[0],
        familyName: user.sn[0],
      },
      active: true,
      emails: [{
        type: "work",
        value: user.email[0]
      }], 
      schemas: [ "urn:ietf:params:scim:schemas:core:2.0:User",
                 "urn:ietf:params:scim:schemas:extension:ibm:2.0:Notification" ]
    }
  } catch (e) {
    log.error('Error building entry: ',e);
  }
  return(obj);
}
// Define the ldap server functions and properties - last step is to kick it.
function runLDAPServer() {
    log.debug('entry');
    var server = ldap.createServer();

    // Use this for debugging, remove later
    /**server.use(function(req, res, next) {
      log.log();
      log.log('USE req  = ', req);
      log.log('USE res  = ', res);
      return next();
    });*/


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
    let status = authUser(id, pwd).then( status => {
      if (status == null) {
        log.error('Failed authentication')
        return next(new ldap.InvalidCredentialsError());
      }
      res.end();
      return next();
    });
  });

  // the compare should not be need, included here as a place holder
  server.compare(config.ldap.root, function(req, res, next) {
    log.trace('===> DN: ', req.dn.toString());
    log.trace('===> attribute name: ', req.attribute);
    log.trace('===> attribute value: ', req.value);
    res.end(req.value === 'foo');
    return next();
  });

  // most of the work happens as part of searches, we will not enable all kinds
  // of searches but only the ones needed specifically for this implementation
  // this sample is tuned for searches done by ISAM using a federated registry
  // and basic user
  // we will use a combination of filter and dn to identify the response we need
  // to create.
  // NOTE that the config.ldap.root is case sensitive, so we use a lower case!
  server.search(config.ldap.root, function(req, res, next) {
    log.debug('entry');
    let filter=req.filter.toString();
    log.trace('search filter = ', filter);
    let dn=req.baseObject.toString();
    log.trace('search dn = ', dn);

    // We do not supconfig.ldap.port searches, these are really lookups
    // in other words, the username is either part of the filter,
    // or it is part of the DN
    if (filter=='(|(objectclass=eperson)(objectclass=person))') {
      var id = dn.substring(dn.indexOf('=')+1);
      id=id.substring(0,id.indexOf(','));
      log.trace('search id in dn = ', id);
    } else {
      var id = filter.substring(filter.indexOf('=')+1);
      id=id.substring(0,id.indexOf(')'));
      log.trace('search id in filter = ', id);
    }

    getUserbyName(id).then( status => {
      if (status == null) {
        log.warn('search with getUserbyName == null');
        res.end();
        return next();
      }
      getUser(status.Resources[0].id).then( status2 => {
        if (status2 == null) {
          log.warn('search with getUser == null');
          res.end();
          return next();
        }

        var obj = converttoLDAP(id, status, status2);

        res.send(obj);
        res.end();
        return next();
      });
    });
  });

// Search for the root base!
// We just return our root base.
// if the base search has a filter that looks for members, return nothing!
  server.search('', function(req, res, next) {
    log.debug('BASE search');
    let filter=req.filter.toString();
    log.trace('BASE search filter = ', filter);
    let dn=req.baseObject.toString();
    log.trace('BASE search dn = ', dn);

    // We do not supconfig.ldap.port searches for groups, so if the filter includes a
    // substring like member= we will return nothing.
    if (filter.indexOf('member=') > -1) {
      log.log('BASE SEARCH not allowed member filter');
      res.end();
      return next();
    }

    let obj = {
      dn: config.ldap.root,
      attributes: {
        objectclass: ['organization','top'],
        o: config.ldap.root.substring(config.ldap.root.indexOf('=')+1)
      }
    }

    res.send(obj);
    res.end();
    return next();
  });

  // An add example
  server.add(config.ldap.root, function(req, res, next) {
    log.debug('ADD entry');
    log.trace('DN: ' + req.dn.toString());
    log.trace('Entry attributes: ', req.toObject().attributes);
 
    addUser(convertfromLDAP(req.toObject().attributes)).then( r => {
      log.trace('add result is ',r);
      if (r==undefined) {
        return next(new ldap.UnwillingToPerformError());
      }
      if (r==409) {
        log.trace('Handling the 409')
        return next(new ldap.EntryAlreadyExistsError(req.dn.toString()));
      }
      res.end();      
      return next();
    })
  });

  // Kick the server
  server.listen(config.ldap.port, function() {
    console.log('%s : LDAP server listening at %s and using token %s', new Date().toLocaleString(), server.url, token.get());
  });
}

// Main Program
async function main() {
    log.info('start');
    // Initialize the token
    token.init(config.tenant.ui,config.tenant.id,config.tenant.secret);
    // Run the actual Server
    runLDAPServer();

    log.info('exit');
}

// Main Start
main();
