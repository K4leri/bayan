FROM node:20.12.1-alpine3.19

# Optionally update npm globally
RUN npm install -g npm@10.5.1

WORKDIR /usr/src/app

# Install Python and build tools needed for any native modules
RUN apk update && apk add --no-cache python3 make g++ \
    && if [ ! -f /usr/bin/python ] || [ ! "$(readlink /usr/bin/python)" = "python3" ]; then ln -sf /usr/bin/python3 /usr/bin/python; fi

# Install Dockerize
ENV DOCKERIZE_VERSION v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz

# Install ALL dependencies (including dev)
COPY package*.json tsconfig.json ./
RUN npm install

# Copy the source code and build the application
COPY . .
RUN npm run build


CMD ["npm", "start"]