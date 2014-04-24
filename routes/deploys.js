var db = require('../services/db'),
  expressValidator = require('express-validator'),
  q = require('q');

expressValidator.validator.isSubset = function(value, array) {
  if (!Array.isArray(value)) {
    return array.indexOf(expressValidator.validator.toString(value)) >= 0;
  }
  else{
    var res = true;

    value.forEach(function(v){
      res = res && expressValidator.validator.isIn(v, array);
    });

    return res;
  }
};

function handleError(err, req, res){
  // TODO: Log error
  console.error(err);

  res.send("Oops, something went wrong server-side. Try again later.", 500);
}

exports.appHome = function(req, res){
  var appId = req.subdomains.length && req.subdomains[req.subdomains.length - 1];

  db.getDeployedApp(appId, function(err, app){
    if(err) {
      handleError(err, req, res);

      return;
    }

    if(!app) {
      res.send(404, "app not found");

      return;
    }

    var topLevelNavLinks = app.navLinks.links.filter(function(navLink){ return !navLink.parentId; });

    topLevelNavLinks.forEach(function(navLink){
      navLink.children = app.navLinks.links.filter(function(nL){ return nL.parentId === navLink.id; });
    });

    res.render("appHome", {title: "Home", vm: { app: app }, navLinks: topLevelNavLinks, showLinks: app.navLinks.showLinks, username: req.cookies.username });
  });
};

exports.appLoginGET = function(req, res){
  var appId = req.subdomains.length && req.subdomains[req.subdomains.length - 1];

  db.getDeployedApp(appId, function(err, app){
    if(err) {
      handleError(err, req, res);

      return;
    }

    if(!app) {
      res.send(404, "app not found");

      return;
    }

    var topLevelNavLinks = app.navLinks.links.filter(function(navLink){ return !navLink.parentId; });

    topLevelNavLinks.forEach(function(navLink){
      navLink.children = app.navLinks.links.filter(function(nL){ return nL.parentId === navLink.id; });
    });

    if(req.query.registered){
      var success = "Successfully registered.";
    }

    var error;

    if(req.query.invalid){
      error = "Invalid username or password";
    }
    else if(req.query.requiresAuthentication){
      error = "You need to be logged in to perform that action.";
    }

    res.render("appLogin", {title: "Login", vm: { app: app, error: error, success: success }, navLinks: topLevelNavLinks, showLinks: app.navLinks.showLinks, username: req.cookies.username });
  });
};

exports.appLoginPOST = function(req, res){
  var appId = req.subdomains.length && req.subdomains[req.subdomains.length - 1];

  var loginForm = req.body;

  db.authenticateAppUser(appId, loginForm, function(err, isValidLogin){
    if(err) {
      handleError(err, req, res);

      return;
    }

    if(isValidLogin) {
      res.cookie("username", loginForm.id);

      res.redirect("/");
    }
    else{
      res.redirect("/login?invalid=true");
    }
  });
};

exports.appRegisterGET = function(req, res){
  var appId = req.subdomains.length && req.subdomains[req.subdomains.length - 1];

  db.getDeployedApp(appId, function(err, app){
    if(err) {
      handleError(err, req, res);

      return;
    }

    if(!app) {
      res.send(404, "app not found");

      return;
    }

    if(app.registration.type !== "open") {
      res.send("page not found", 404);

      return;
    }

    var topLevelNavLinks = app.navLinks.links.filter(function(navLink){ return !navLink.parentId; });

    topLevelNavLinks.forEach(function(navLink){
      navLink.children = app.navLinks.links.filter(function(nL){ return nL.parentId === navLink.id; });
    });

    if(req.query.passwordMatchFail){
      var error = "Password and Confirm Password fields must match.";
    }

    res.render("appRegister", {title: "Register", vm: { app: app, error: error }, navLinks: topLevelNavLinks, showLinks: app.navLinks.showLinks, username: req.cookies.username });
  });
};

exports.appRegisterPOST = function(req, res){
  var appId = req.subdomains.length && req.subdomains[req.subdomains.length - 1];

  var registrationForm = req.body;

  db.getDeployedApp(appId, function(err, app){
    if(err) {
      handleError(err, req, res);

      return;
    }

    if(!app) {
      res.send(404, "app not found");

      return;
    }

    if(app.registration.type !== "open") {
      res.send("page not found", 404);

      return;
    }

    if(registrationForm.password === registrationForm.confirmPassword){
      db.registerUser(appId, registrationForm, function(){
        res.redirect("/login?registered=true");
      });
    }
    else{
        res.redirect("/register?passwordMatchFail=true");
    }
  });
};

exports.appLogoutGET = function(req, res){
  res.clearCookie("username");

  res.redirect("/");
};

exports.appForm = function(req, res){
  createAppFormView(req, res);
};

function createAppFormView(req, res){
  var appId = req.subdomains.length && req.subdomains[req.subdomains.length - 1];

  db.getDeployedApp(appId, function(err, app){
    if(err) {
      handleError(err, req, res);

      return;
    }

    if(!app) {
      res.send(404, "app not found");

      return;
    }

    var topLevelNavLinks = app.navLinks.links.filter(function(navLink){ return !navLink.parentId; });

    topLevelNavLinks.forEach(function(navLink){
      navLink.children = app.navLinks.links.filter(function(nL){ return nL.parentId === navLink.id; });
    });

    var formId = Number(req.params.formId);
    var form = app.forms.filter(function(form) { return form.id === formId; })[0];

    if(!form) {
      res.send(404, "form not found");

      return;
    }

    if(form.authenticationRules && form.authenticationRules.create && !req.cookies.username){
      res.redirect("/login?requiresAuthentication=true");

      return;
    }

    if(form.authenticationRules && form.authenticationRules.view && req.query.formDataId && !req.cookies.username){
      res.redirect("/login?requiresAuthentication=true");

      return;
    }

    form.fields = form.fields.sort(function(a,b){ return a.order > b.order; });
    req.locals = req.locals || {};

    if(req.query.formDataId && !req.locals.formData){
      db.getFormData(appId, formId, req.query.formDataId, function(err, formData){
        if(err){
          handleError(err, req, res);

          return;
        }

        res.render("appForm", {title: form.title, vm: { app: app, formData: formData, errors: req.locals.errors }, navLinks: topLevelNavLinks, showLinks: app.navLinks.showLinks, form: form, saved: req.query.saved, username: req.cookies.username });
      });
    }
    else{
      res.render("appForm", {title: form.title, vm: { app: app, formData: req.locals.formData || {}, errors: req.locals.errors }, navLinks: topLevelNavLinks, showLinks: app.navLinks.showLinks, form: form, saved: req.query.saved, username: req.cookies.username });
    }
  });
}

exports.saveAppForm = function(req, res){
  // Make model out of form data using Schema
  var appId = req.subdomains.length && req.subdomains[req.subdomains.length - 1];

  var formId = req.params.formId;
  var formData = req.body;

  db.getDeployedForm(appId, formId, function(err, form){
    if(err) {
      handleError(err, req, res);

      return;
    }

    if(!form) {
      res.send(404, "form not found");

      return;
    }

    if(form.authenticationRules && form.authenticationRules.update && formData.id && !req.cookies.username){
      res.redirect("/login?requiresAuthentication=true");

      return;
    }

    validateForm(appId, formId, req, res, function(err){
      if(!err.length) {
        // if valid, pass to db.saveForm

        db.saveFormData(appId, formId, formData, req.body.id, function(err){
          if(err){
            handleError(err, req, res);

            return;
          }

          var url = "/forms/" + formId.toString() + "?saved=true";

          res.redirect(url);
        });
      }
      else{
        req.locals = req.locals || {};
        req.locals.errors = err;
        req.locals.formData = formData;

        createAppFormView(req, res);
      }
    });
  });
};

function validateForm(appId, formId, req, res, cb){
  var errors = [];

  db.getDeployedForm(appId, formId, function(err, form){
    if(err){
      handleError(err, res, res);

      return;
    }

    if(!form) {
      err = {msg: "Form not found."};
    }
    else{
      form.fields.forEach(function(field){
        if((field.required || (field.type === 'options' && field.optionType === 'radio')) && !req.body[field.id]) {
          errors.push({param: field.id, msg: field.title + " is required."});
          return;
        }

        switch (field.type){
          case "number":
            if(req.body[field.id]) {
              req.checkBody(field.id, field.title + " must be a number.").isNumeric();
            }
            break;
          case "date":
            if(req.body[field.id]) {
              req.checkBody(field.id, field.title + " must be a date.").isDate();
            }
            break;
          case "boolean":
            if(req.body[field.id]) {
              req.body[field.id] = expressValidator.validator.toBoolean(req.body[field.id]);
            }
            break;
          case "options":
            if(req.body[field.id]) {
              var options = field.options.split("\n");

              req.checkBody(field.id, field.title + " must be one of the options in the list.").isSubset(options);
            }
            break;
          default :
            break;
        }
      });

      var validationErrors = req.validationErrors();

      err = validationErrors ? errors.concat(validationErrors) : errors;
    }

    cb(err);
  });
}

exports.appListing = function(req, res){
  var appId = req.subdomains.length && req.subdomains[req.subdomains.length - 1];

  var listingId = req.params.listingId;

  db.getDeployedListing(appId, listingId, function(err, listing){
    if(err) {
      handleError(err, req, res);

      return;
    }

    if(!listing) {
      res.send(404, "listing not found");

      return;
    }

    if(listing.requiresAuthentication && !req.cookies.username){
      res.redirect("/login?requiresAuthentication=true");

      return;
    }

    if(listing){
      var promises = [];

      var getFormDataDeferred = q.defer();
      promises.push(getFormDataDeferred.promise);

      db.getFormData(appId, listing.formId, null, function(err, data) {
        if(err){
          getFormDataDeferred.reject(err);
        }
        else {
          getFormDataDeferred.resolve(data);
        }
      });

      var getDeployedFormDeferred = q.defer();
      promises.push(getDeployedFormDeferred.promise);

      db.getDeployedForm(appId, listing.formId, function(err, form) {
        if(err){
          getDeployedFormDeferred.reject(err);
        }
        else {
          getDeployedFormDeferred.resolve(form);
        }
      });

      var getDeployedAppDeferred = q.defer();
      promises.push(getDeployedAppDeferred.promise);

      db.getDeployedApp(appId, function(err, app){
        if(err){
          getDeployedAppDeferred.reject(err);
        }
        else {
          getDeployedAppDeferred.resolve(app);
        }
      });

      q.all(promises).
        spread(function(data, form, app){
          var fieldIds = [];

          for(var key in listing.fields) {
            if(listing.fields[key]) fieldIds.push(Number(key));
          }

          var listingFields = form.fields.filter(function(field){ return fieldIds.indexOf(field.id) > -1});

          listingFields.forEach(function(field){
            field.order = listing.order.filter(function(f){ return f.id === field.id; })[0].order;
          });

          listingFields.sort(function(a,b){ return a.order > b.order; });

          var topLevelNavLinks = app.navLinks.links.filter(function(navLink){ return !navLink.parentId; });

          topLevelNavLinks.forEach(function(navLink){
            navLink.children = app.navLinks.links.filter(function(nL){ return nL.parentId === navLink.id; });
          });

          var vm = { app: app, listing: listing, data: data, listingFields: listingFields };

          res.render("appListing", { title: listing.title, vm: vm, navLinks: topLevelNavLinks, showLinks: app.navLinks.showLinks, username: req.cookies.username });
        }).
        fail(function(err){
          if(err){
            handleError(err, req, res);

            return;
          }
        });
    }
    else{
      res.send("listing not found", 404)
    }
  });
};
