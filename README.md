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
* Express version 3.2.6 or compatible
* Node-Daemonize 2 version 0.4.2 or compatible
* Node-Postgres version 2.0.0 or compatible
* Memory-Cache version 0.0.5 or compatible
* topojson version 1.6.14 or compatible
* winston version 0.8.1 or compatible

#### External Node software
* [Grunt](http://gruntjs.com)

### Installation
Download the source code for cognicity-server from github: [http://github.com/smart-facility/cognicity-server](https://github.com/smart-facility/cognicity-server) or view the CogniCity installation documentation at [http://cognicity.info](http://cognicity.info).
To check it out using git, run `git clone --recursive git@github.com:smart-facility/cognicity-server`, which will also check out the default web site submodule [https://github.com/smart-facility/petajakarta-web](https://github.com/smart-facility/petajakart-web), which if you fork you can change to your own set of pages (refer to config.public_dir and config.url_prefix in the config.js file). If you have already cloned the repository, and want to check out the submodule, then run
```shell
git submodule init
git submodule update
```

#### Platform-specific notes ####
To build on OS X we recommend using [homebrew](http://brew.sh) to install node, npm, and required node modules as follows:
```shell
brew install node
npm install
```

To build on Windows we recommend installing all dependencies (making sure to use all 32 bit or all 64 bit, depending on your architecture) plus following the instructions (for Windows 7 follow the Windows 7/8 instructions) for [node-gyp](https://github.com/TooTallNate/node-gyp) and then:
* You need to add *C:\Program Files\PostgreSQL\9.3\bin* (modifying that location if necessary to point to the installed version of PostgreSQL) to path so the build script finds `pg_config`, and
* You need to create the *%APPDATA%\npm* folder and run cmd (and hence npm) as administrator. *%APPDATA%* is usually under *C:\Users\your_username\AppData\Remote*.
Then you can run `npm install`.

For the petajakarta-web submodule, install the node dependencies in package.json using NPM as follows
```shell
cd petajakarta-web
npm install
```
You can then run `grunt` if you need to rebuild the build products following changes to its source.

### Configuration
Server configuration parameters are stored in a configuration file which is parsed by server.js. See config.js for an example configuration. It is possible to run multiple server instances using different configuration files so long as a unique port is assigned to each instance.

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
$ node daemon.js start
project-name daemon started. PID 2953
project-name running on port: 8081

$node daemon.js sample-config.js status
project-name running on port: 8081

$node daemon.js sample-config.js stop
project-name daemon stopped
```

### Logging
Winston logger writes to `[config.instance].log`

#### Logging parameters
* level - info or debug are most useful here, debug will give you more verbose logging output
* maxFileSize - max size (in bytes) of each log file before a new one is created
* maxFiles - number of log files to retain
* path - Specify a full path to the log directory. The default is the current directory which is the application's directory when launched via node.

### License
This software is released under the GPLv3 License. See License.txt for details.
