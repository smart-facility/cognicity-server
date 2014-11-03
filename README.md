CogniCity
===========
**Open Source GeoSocial Intelligence Framework**

####cognicity-server: NodeJS server for CogniCity data and web files.


### About
Cognicity-server is the NodeJS server module for the CogniCity framework, responsible for serving reports and web content. For detailed framework documentation see [http://cognicity.info](http://cognicity.info).

### Dependencies
* [NodeJS](http://nodejs.org) version 0.10.12 or later
* [PostgreSQL](http://www.postgresql.org) version 9.2 or later, with [PostGIS](http://postgis/) version 2.0 or later.

#### Node Modules
* Express version 3.2.6 or later
* Node-Daemonize 2 version 0.4.2 or later
* Node-Postgres version 2.0.0 or later
* Memory-Cache version 0.0.5 or later



### Installation
Download the source code for cognicity-server from github: [http://github.com/smart-facility/cognicity-server](http://github.com/smart-facility/cognicity-server) or view the CogniCity installation documentation at [http://cognicity.info](http://cognicity.info).

Install the node dependencies in package.json using NPM: `npm install`

#### Platform-specific notes ####
To build on OS X we recommend using [homebrew](http://brew.sh) to install node, npm, and required node modules as follows:
```shell
brew install node
npm install
```

To build on Windows we recommend installing all dependencies plus following the instructions (for Windows 7 follow the Windows 7/8 instructions) for [node-gyp](https://github.com/TooTallNate/node-gyp) and then:
* You need to add *C:\Program Files\PostgreSQL\9.3\bin* (modifying that location if necessary to point to the installed version of PostgreSQL) to path so the build script finds `pg_config`, and
* You need to create the *%APPDATA%\npm* folder and run cmd (and hence npm) as administrator. *%APPDATA%* is usually under *C:\Users\your_username\AppData\Remote*.
Then you can run `npm install`.

### Configuration
Server configuration parameters are stored in a configuration file which is parsed by server.js. See sample-config.js for an example configuration. It is possible to run multiple server instances using different configuration files so long as a unique port is assigned to each instance.

#### Serving web content
The `config.public_dir` parameter is the location of public HTML, CSS, JS web pages to serve.
By default pages are served at [http://localhost:8080/project-name/], the optional prefix URL can be changed using the `config.url_prefix` configuration parameter.

#### Data Routes
By default cognicity-server serves confirmed and unconfirmed reports in GeoJson format at:
[http://localhost:8080/project-name/data/reports.json]

The query parameter `type` can be used to select confirmed or unconfirmed reports. For example:
[http://localhost:8080/project-name-data/reports.json?type=unconfirmed]
The default (no query) is to server confirmed reports.

Data routes can be disabled (e.g. for testing) by setting the `config.data` parameter to false.

### Run
The server is run as a background process using the Daemonize 2 library. The process name is set to the configuration instance `config.instance` defined in the configuration file.

```shell
$ cd cognicity-server/
$ node daemon.js sample-config.js start
project-name daemon started. PID 2953
project-name running on port: 8080

$node daemon.js sample-config.js status
project-name running on port: 8080

$node daemon.js sample-config.js stop
project-name daemon stopped
```

### Logging
Express logger writes to project-name.log

### License
This software is released under the GPLv3 License. See License.txt for details.
