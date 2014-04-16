
/**
 * Module dependencies.
 */

var express = require('express');
var http = require('http');
var path = require('path');
var deploys = require('./routes/deploys');
var expressValidator = require('express-validator');
var util = require("util");
var config = require("./config");

var app = express();

function parseDomainFromHost(host){
  //1.crudgen.com:3001/
  var noProtocolHost = host.indexOf("://") > -1 ? host.split("://")[1] : host;

  //1.crudgen.com
  var noPortUrl = noProtocolHost.split(":")[0];
  var port = noProtocolHost.split(":")[1];

  var splitUrl = noPortUrl.split(".");

  var domain = util.format("%s.%s", splitUrl[splitUrl.length - 2], splitUrl[splitUrl.length - 1]);

  return port ? util.format("%s:%s", domain, port) : domain;
}

function validateDomain(req, res, next){
  var domain = parseDomainFromHost(req.headers.host);

  if(domain !== config.deploymentSite){
    res.send(404, "domain not recognized");
  }
  else if(!req.subdomains.length){
    res.send(404, "appId not provided");
  }
  else{
    next();
  }
}

// all environments
app.set('port', process.env.PORT || 3001);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(expressValidator());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', validateDomain, deploys.appHome);
app.get('/login', validateDomain, deploys.appLoginGET);
app.post('/login', validateDomain, deploys.appLoginPOST);
app.get('/register', validateDomain, deploys.appRegisterGET);
app.post('/register', validateDomain, deploys.appRegisterPOST);
app.get('/logout', validateDomain, deploys.appLogoutGET);
app.get('/forms/:formId', validateDomain, deploys.appForm);
app.post('/forms/:formId', validateDomain, deploys.saveAppForm);
app.get('/listings/:listingId', validateDomain, deploys.appListing);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
