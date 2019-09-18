// Dev environment for PPSdemo
module.exports = {
    tenant: {
      ui: 'https://ppsdemo.ice.ibmcloud.com',
      id: 'xxxxxx-xxxxxx-xxxx-xxxxx',
      secret: 'yyyyyyyyy',
      registry: 'zzzzzz-zzzzz-zzzzz-zzzzz-zzzzzz'
    },
    ldap: {
      port: 389,
      root: 'o=pps',
      type: 'uid='
    },
    cache: {
      ttl: 60
    },
    log: "log",
  };
  // log levels are log - trace - debug - info - warn - error
