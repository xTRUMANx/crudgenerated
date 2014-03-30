var db = require('../services/db'),
  expressValidator = require('express-validator');

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

exports.appHome = function(req, res){
  var appId = req.params.appId;

  db.getDeployedApp(appId, function(app){
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
  var appId = req.params.appId;

  db.getDeployedApp(appId, function(app){
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
  var appId = req.params.appId;
  var loginForm = req.body;

  db.authenticateUser(appId, loginForm, function(isValidLogin){
    if(isValidLogin) {
      res.cookie("username", loginForm.id);

      res.redirect("/deploys/" + appId);
    }
    else{
      res.redirect("/deploys/" + appId + "/login?invalid=true");
    }
  });
};

exports.appRegisterGET = function(req, res){
  var appId = req.params.appId;

  db.getDeployedApp(appId, function(app){
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
  var appId = req.params.appId;
  var registrationForm = req.body;

  db.getDeployedApp(appId, function(app){
    if(!app) {
      res.send(404, "app not found");

      return;
    }

    if(app.registration.type !== "open") {
      res.send("page not found", 404);

      return;
    }

    if(registrationForm.password === registrationForm.confirmPassword){
      db.saveUser(appId, registrationForm, function(){
        res.redirect("/deploys/" + appId + "/login?registered=true");
      });
    }
    else{
        res.redirect("/deploys/" + appId + "/register?passwordMatchFail=true");
    }
  });
};

exports.appLogoutGET = function(req, res){
  var appId = req.params.appId;

  res.clearCookie("username");

  res.redirect("/deploys/" + appId);
};

exports.appForm = function(req, res){
  createAppFormView(req, res);
};

function createAppFormView(req, res){
  var appId = req.params.appId;

  db.getDeployedApp(appId, function(app){
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

    if(form.authenticationRules.create && !req.cookies.username){
      res.redirect("/deploys/" + appId + "/login?requiresAuthentication=true");

      return;
    }

    if(form.authenticationRules.view && req.query.formDataId && !req.cookies.username){
      res.redirect("/deploys/" + appId + "/login?requiresAuthentication=true");

      return;
    }

    form.fields = form.fields.sort(function(a,b){ return a.order > b.order; });
    req.locals = req.locals || {};

    if(req.query.formDataId && !req.locals.formData){
      db.getFormData(appId, formId, req.query.formDataId, function(formData){
        res.render("appForm", {title: form.name, vm: { app: app, formData: formData, errors: req.locals.errors }, navLinks: topLevelNavLinks, showLinks: app.navLinks.showLinks, form: form, saved: req.query.saved, username: req.cookies.username });
      });
    }
    else{
      res.render("appForm", {title: form.title, vm: { app: app, formData: req.locals.formData || {}, errors: req.locals.errors }, navLinks: topLevelNavLinks, showLinks: app.navLinks.showLinks, form: form, saved: req.query.saved, username: req.cookies.username });
    }
  });
}

exports.saveAppForm = function(req, res){
  // Make model out of form data using Schema
  var appId = req.params.appId;
  var formId = req.params.formId;
  var formData = req.body;

  db.getDeployedForm(appId, formId, function(form){
    if(!form) {
      res.send(404, "form not found");

      return;
    }

    if(form.authenticationRules.update && formData.id && !req.cookies.username){
      res.redirect("/deploys/" + appId + "/login?requiresAuthentication=true");

      return;
    }

    validateForm(appId, formId, req, function(err){
      if(!err.length) {
        // if valid, pass to db.saveForm

        db.saveFormData(appId, formId, formData, req.body.id, function(){
          var url = "/deploys/" + appId + "/forms/" + formId.toString() + "?saved=true";

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

function validateForm(appId, formId, req, cb){
  var errors = [];
  db.getForm(appId, formId, function(form){
    if(!form) {
      errors.push({msg: "Form not found."});
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

      var err = validationErrors ? errors.concat(validationErrors) : errors;

      cb(err);
    }
  });
}

exports.appListing = function(req, res){
  // Get listing
  var appId = req.params.appId;
  var listingId = req.params.listingId;

  db.getDeployedListing(appId, listingId, function(listing){
    if(!listing) {
      res.send(404, "listing not found");

      return;
    }

    if(listing.requiresAuthentication && !req.cookies.username){
      res.redirect("/deploys/" + appId + "/login?requiresAuthentication=true");

      return;
    }

    if(listing){
      // Get listing data
      db.getFormData(appId, listing.formId, null, function(data){
        var fieldIds = [];

        for(var key in listing.fields) {
          if(listing.fields[key]) fieldIds.push(key);
        }

        db.getForm(appId, listing.formId, function(form){
          var listingFields = form.fields.filter(function(field){ return fieldIds.indexOf(field.id) > -1});

          listingFields.forEach(function(field){
            field.order = listing.order.filter(function(f){ return f.id === field.id; })[0].order;
          });

          listingFields.sort(function(a,b){ return a.order > b.order; });

          db.getDeployedApp(appId, function(app){
            var topLevelNavLinks = app.navLinks.links.filter(function(navLink){ return !navLink.parentId; });

            topLevelNavLinks.forEach(function(navLink){
              navLink.children = app.navLinks.links.filter(function(nL){ return nL.parentId === navLink.id; });
            });

            var vm = { app: app, listing: listing, data: data, listingFields: listingFields };

            res.render("appListing", { title: listing.title, vm: vm, navLinks: topLevelNavLinks, showLinks: app.navLinks.showLinks, username: req.cookies.username });
          });
        });
      });
    }
    else{
      res.send("listing not found", 404)
    }
  });
};
