CogniCity
===========
**Open Source GeoSocial Intelligence Framework**

####cognicity-server: NodeJS server for CogniCity data and web files.


### About
Cognicity-server is the NodeJS server module for the CogniCity framework, responsible for serving reports and web content. For detailed framework documentation see [http://talltom.github.io/cognicity].

### Dependencies
* NodeJS version 0.10.12 or later

#### Node Modules
* Express version 3.2.6 or later
* Node-Daemonize 2 version 0.4.2 or later
* Node-Postgres version 2.0.0 or later
* Memory-Cache version 0.0.5 or later

### Installation
Download the source code for cognicity-server from github: [http://github.com/talltom/cognicity-server] or view the CogniCity installation documentation at [http://talltom.github.io/cognicity]

Install the node dependencies in package.json using NPM: `npm install`

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
Express logger writes to cognicity-server/logs/project-name.log

### License
This software is released under the GPLv3 License. See License.txt

