CogniCity
===========
**Open Source GeoSocial Intelligence Framework**

#### cognicity-server: NodeJS server for CogniCity data and web files.

Travis build status: [![Travis Build Status](https://travis-ci.org/smart-facility/cognicity-server.svg?branch=master)](https://travis-ci.org/smart-facility/cognicity-server)

Jenkins build status: [![Jenkins build status](https://smart-analytics.eis.uow.edu.au/jenkins/buildStatus/icon?job=cognicity-server)](https://smart-analytics.eis.uow.edu.au/jenkins/buildStatus/icon?job=cognicity-server)

DOI for current stable release [v1.0.4](https://github.com/smart-facility/cognicity-server/releases/tag/v1.0.4): [![DOI](https://zenodo.org/badge/19201/smart-facility/cognicity-server.svg)](https://zenodo.org/badge/latestdoi/19201/smart-facility/cognicity-server)

### About
Cognicity-server is the NodeJS server module for the CogniCity framework, responsible for serving reports and web content. For detailed framework documentation see [http://cognicity.info](http://cognicity.info)

### API Documentation
[http://cognicity.info/cognicity/api-docs/cognicity-server/index.html](http://cognicity.info/cognicity/api-docs/cognicity-server/index.html)

### Dependencies
* [NodeJS](http://nodejs.org) version 0.10.16 or later
* [PostgreSQL](http://www.postgresql.org) version 9.2 or later, with [PostGIS](http://postgis.net/) version 2.0 or later

#### Node Modules
* [Express](http://expressjs.com/) version 4.13.3 or compatible
* [Node-Postgres](https://github.com/brianc/node-postgres) version 3.0.0 or compatible
* [Memory-Cache](https://github.com/ptarjan/node-cache) version 0.0.5 or compatible
* [topojson](https://github.com/mbostock/topojson) version 1.6.19 or compatible
* [winston](https://github.com/flatiron/winston) version 0.8.3 or compatible
* [moment](https://github.com/moment/moment) version 2.10.6 or compatible
* [morgan](https://github.com/expressjs/morgan) version 1.6.1 or compatible

#### Dev Modules
* [jshint](https://github.com/jshint/node-jshint) version 2.8.0 or compatible
* [unit.js](http://unitjs.com/) version 2.0.0 or compatible
* [mocha](http://mochajs.org/) version 2.3.3 or compatible
* [jsdoc](https://github.com/jsdoc3/jsdoc) version 3.3.3 or compatible
* [istanbul](https://github.com/gotwarlost/istanbul) version 0.4.0 or compatible

### Installation
Download the source code for cognicity-server from github: [https://github.com/smart-facility/cognicity-server](https://github.com/smart-facility/cognicity-server) or view the CogniCity installation documentation at [http://cognicity.info](http://cognicity.info).
To check it out using git, run `git clone --recursive git@github.com:smart-facility/cognicity-server`, which will also check out the default web site submodule [https://github.com/smart-facility/petajakarta-web](https://github.com/smart-facility/petajakart-web), which if you fork you can change to your own set of pages (refer to config.public_dir and config.url_prefix in the config.js file). If you have already cloned the repository, and want to check out the submodule, then run
```shell
git submodule init
git submodule update
```
To update the submodule, first `cd petajakarta-web` then `git pull origin master`, then `cd ..` to move back to the main cognicity-server directory and then `git commit` and `git push` along with any other changes.

#### Platform-specific notes ####
To build on OS X we recommend using [homebrew](http://brew.sh) to install node, npm, and required node modules as follows:
```shell
brew install node
npm install
```

To build on Windows we recommend installing all dependencies (making sure to use all 32 bit or all 64 bit, depending on your architecture) plus following the instructions (for Windows 7 follow the Windows 7/8 instructions) for [node-gyp](https://github.com/TooTallNate/node-gyp) and then:
* You need to add *C:\Program Files\PostgreSQL\9.3\bin* (modifying that location if necessary to point to the installed version of PostgreSQL) to path so the build script finds `pg_config`, and
* You need to create the *%APPDATA%\npm* folder and run cmd (and hence npm) as administrator. *%APPDATA%* is usually under *C:\Users\your_username\AppData\Remote*.
* You may need to specify the version of the build tools installed by adding the argument `--msvs_version=2013` to the `npm` command (substituting the appropriate version)
Then you can run `npm install`.

For the petajakarta-web submodule, install the node dependencies in package.json using NPM as follows
```shell
cd petajakarta-web
npm install
```
You can then run `grunt` if you need to rebuild the build products following changes to its source.

### Configuration
Server configuration parameters are stored in a configuration file which is parsed by server.js. See config.js for an example configuration. It is possible to run multiple server instances using different configuration files so long as a unique port is assigned to each instance.
Some that you probably want to change:
* config.pg.conString - the database connection string that can include username and password as well as the hostname and database name. If you're deploying to [AWS Elastic Beanstalk](http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/Welcome.html) you will need to configure a property with name DB_NAME and value set to the database name, under Configuration -> Software configuration.
* config.compression - If true, enable Express compression middleware to gzip responses. If deploying standalone then you probably want to set this to true. If deploying behind a reverse proxy+cache like [nginx](http://nginx.org) then you will want to leave this config option set to false and enable compressing using the caching server. For Elastic Beanstalk using nginx this is configured automatically using the Elastic Beanstalk [config file](https://github.com/smart-facility/cognicity-server/blob/master/.ebextensions/nginx.config) (note if deploying standalone then this file actually contains only a fragment of an nginx config plus the Elastic Beanstalk headers).
* config.logger.logDirectory - the location of the log file for the server. The default is the current working directory, and the default location + name are set up in the [cloud-log-init.config](https://github.com/smart-facility/cognicity-server/blob/master/.ebextensions/cloud-log-init.config) file for easy export of the log file in Elastic Beanstalk.

#### API
* aggregates.archive.level - The key of the aggregate level ('config.pg.aggregate_levels') to use for archive aggregate response data

#### Postgres connection
* conString - PostgreSQL connection string [see node-postgres module documenation](https://github.com/brianc/node-postgres)
* reconnectionDelay - Delay between reconnection attempts if postgres connection lost
* reconnectionAttempts - Number of times to attempt to reconnect before dying
* aggregate_levels - Database tables, keys are the label and values are the table name
* infrastructure_tbls - Database tables, keys are the label and values are the table name
* limit - Max number of confirmed reports to return
* uc_limit - Max number of unconfirmed reports to return

Cognicity-server requires a database that conforms to the [Cognicity framework schema](https://github.com/smart-facility/cognicity-schema).

#### Serving web content
* The `config.public_dir` parameter is the location of public HTML, CSS, JS web pages to serve.
* By default pages are served at [http://localhost:8081/project-name/], the optional prefix URL can be changed using the `config.url_prefix` configuration parameter.
* The `config.root_redirect` parameter defines where a client is redirected to if they request the root path of the server

#### Data Routes
The following routes exist:
* `/data/api/v2/reports/confirmed` - Confirmed reports
* `/data/api/v2/floodwatch/reports` - Floodwatch reports
* `/data/api/v2/infrastructure/*` - Infrastructure data

A URL parameter of `format=topojson` can be appended to any route to receive the response data in topojson format.

Data routes can be disabled (e.g. for testing) by setting the `config.data` parameter to false.
Aggregate routes can be disabled by setting the `config.aggregates` parameter to false.

#### Caching
Requests are cached either temporarily (with a timeout set by the `config.cache_timeout` parameter) or permanently depending on the route.

### Run
The server is launched by node.js directly. In production, software on the server should manage launching, health checking and restarting) of the process.

```shell
$ cd cognicity-server/
$ node server.js config.js
```

### Logging
Winston logger writes to `[config.instance].log`. The log directory is configurable.

#### Logging parameters
* level - info or debug are most useful here, debug will give you more verbose logging output
* maxFileSize - max size (in bytes) of each log file before a new one is created
* maxFiles - number of log files to retain
* logDirectory - Specify a full path to the log directory. If not specified, the application directory will be used.

### Development

#### Git Hooks
There is a git pre-commit hook which will run the 'npm test' command before your commit and will fail the commit if testing fails.

To use this hook, copy the file from 'git-hooks/pre-commit' to '.git/hooks/pre-commit' in your project folder.

```shell
cp git-hooks/pre-commit .git/hooks/
```

#### Documentation

To build the JSDoc documentation run the following npm script:

```shell
npm run-script build-docs
```

This will build the HTML API documentation in the folder `docs` where you can open it with a web browser.

#### Test Coverage

To build test code coverage documentation, run the following npm script:

```shell
npm run-script coverage
```

This will run istanbul code coverage over the full mocha test harness and produce HTML documentation in the directory `coverage` where you can open it with a web browser.

#### testing

To test make sure nothing is running on tcp port 8082. Note this is different to the default port of 8081, to avoid a conflict while testing on the same system the server is running on. Then run:
```shell
npm test
```

#### Release

The release procedure is as follows:
* Update the CHANGELOG.md file with the newly released version, date, and a high-level overview of changes. Commit the change.
* Update JSDoc documentation if required (see above).
* Create a tag in git from the current head of master. The tag version should be the same as the version specified in the package.json file - this is the release version.
* Update the version in the package.json file and commit the change.
* Further development is now on the updated version number until the release process begins again.
* The deployed version is always in origin/master.

### License
This software is released under the GPLv3 License. See License.txt for details.
