FROM node:10-alpine

RUN apk add --update python g++ make
WORKDIR /opt/app

# Install NPM dependencies before the code (save time on builds)
COPY ./package*.json /opt/app/
RUN npm install 

# Install our app code
COPY ./ /opt/app/

# Expose the ldap port
EXPOSE 389

CMD npm start
