# CI-ldapproxy
A nodejs based ldapproxy to the CI web services as a docker image.
For a deeper discussion on the general topic of why this may be needed and how it fits into your overal Consumer IAM, see the following blog series here:
https://community.ibm.com/community/user/security/blogs/martin-schmidt1/2019/07/12/modernizing-your-b2c-portal-security-ciam

## Setting up the cloud environment

Make sure you setup your CIC cloud tenant as described in the blog entry above, and have obtained the following information:

* tenant ui
* tenant id
* tenant secret
* tenant registry

## Download the code

Pull the code from this registry and place it on a system that has docker and nodejs installed.

## Configure the local environment

Modify the dev.js file to include the information collected from the cloud environment, and set the ldap proxy settings.

```
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
```

## Build the node environment

Use the following command to install the application locally for node.

```
npm install .
```

This will download and install all the dependencies locally in preperation for the docker build.

You can validate the install using the command, and should show this result:

```
npm test
> ci_ldap_proxy@0.0.2 test /Users/schmidtm/Desktop/work/CI_Demo/CIldapproxy
> node ./src/test.js

2019-09-18T10:53:38-0500 <info> test.js:21 (main) start test
2019-09-18T10:53:39-0500 <info> CIToken.js:32 (CIToken.init) CIToken.init() token is - [oEyCOmDKhJu7W2PkxqtZ8q1sHaeUVusQQwTEqOcl]
2019-09-18T10:53:39-0500 <info> test.js:31 (main) exit test
```

## Build the Docker image

Using the following command to build the docker image, and to list it.

```
docker build schmidtm/proxy .
```

Verify the image was built.

```
docker images
REPOSITORY            TAG                 IMAGE ID            CREATED             SIZE
schmidtm/proxy        latest              c2f5ff602a5d        24 hours ago        303MB
```

## Running the Docker image and testing the proxy

Use the following command to start the image, mapping the ldap port to the local system port.

```
docker run -p 389:389 -d schmidtm/proxy
```
Get the running container id
```
docker ps
CONTAINER ID        IMAGE               COMMAND                  CREATED             STATUS              PORTS                  NAMES
c06733557187        schmidtm/proxy      "docker-entrypoint.s…"   4 seconds ago       Up 3 seconds        0.0.0.0:389->389/tcp   angry_herschel
```
Connecting to the running image as needed with container id, this will open a shell
```
docker exec -it c06733557187 /bin/sh
```
Tailing the output of stdout and stderr from the host, using the container id
```
docker logs c06733557187 -f

> ci_ldap_proxy@0.0.2 start /opt/app
> node ./src/proxy.js

2019-09-18T15:59:39+0000 <info> proxy.js:141 (main) start
2019-09-18T15:59:39+0000 <debug> CIRequest.js:28 (CIRequest.init) CIRequest.init()
2019-09-18T15:59:39+0000 <debug> proxy.js:69 (runLDAPServer) entry
2019-09-18T15:59:39+0000 <info> proxy.js:147 (main) exit
9/18/2019, 3:59:39 PM : LDAP server listening at ldap://0.0.0.0:389
2019-09-18T15:59:40+0000 <info> CIToken.js:32 (CIToken.init) CIToken.init() token is - [Snj78FvSUU1wbBBL2nq3wTzNOLdEe1rRNgc8L0rA]
```
With this tail of the log running, open a second command line with access to an ldapsearch command and run an ldapsearch similar to this (based on your configuration).
```
ldapsearch -h localhost -p 389 -D "uid=schmidtm,o=pps" -w secret123 -b "uid=schmidtm,o=pps" uid=*
```
You should now see additional output shown in the above tail command.

To stop the docker container issue the following command with the container id
```
docker stop c06733557187
```

# License

Copyright 2018 International Business Machines

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
