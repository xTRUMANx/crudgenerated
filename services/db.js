var pg = require("pg");
var crypto = require("crypto");
var config = require("../config");
var connectionString = config.connectionString;

function hasher(password, salt, cb){
  var iterations = 10000;
  var length = 40;

  crypto.pbkdf2(password, salt, iterations, length, function(err, derivedKey){
    if(err) {
      cb(err);

      return;
    }

    var passwordHash = derivedKey.toString("hex");

    cb(err, passwordHash);
  });
}

exports.getDeployedApp = function(id, cb){
  pg.connect(connectionString, function(err, client, done){
    if(err){
      cb(err);

      return;
    }

    var sql = "select data from deployedapps where appid = $1";

    client.query(sql, [id], function(err, result){
      var app;

      if(!err && result.rowCount){
        app = result.rows[0].data;
      }

      cb(err, app);

      done();
    });
  });
};

exports.authenticateAppUser = function(appId, loginForm, cb){
  pg.connect(connectionString, function(err, client, done){
    if(err) {
      cb(err);

      return;
    }

    var sql = "select * from appusers where appid = $1 and username = $2";

    client.query(sql, [appId, loginForm.id], function(err, result){
      done();

      if(err){
        cb(err);

        return;
      }

      if(result.rowCount){
        hasher(loginForm.password, result.rows[0]["salt"], function(err, passwordHash){
          if(err){
            cb(err);

            return;
          }

          var actualPasswordHash = result.rows[0]["passwordhash"];

          var isPasswordCorrect = passwordHash === actualPasswordHash;

          cb(err, isPasswordCorrect);
        })
      }
      else {
        cb(err, false);
      }
    });
  });
};

exports.registerUser = function(appId, user, cb){
  pg.connect(connectionString, function(err, client, done){
    if(err){
      cb(err);

      return;
    }

    var sql = "insert into appusers (appid, username, passwordhash, salt) " +
              "values ((select id " +
                      "from apps " +
                      "where id = $1), " +
                      "$2, $3, $4);";

    var salt = crypto.randomBytes(16).toString("hex");

    hasher(user.password, salt, function(err, passwordHash){
      if(err){
        cb(err);

        done();

        return;
      }

      client.query(sql, [appId, user.id, passwordHash, salt], function(err){
        cb(err);

        done();
      });
    });
  });
};

exports.getDeployedForm = function(appId, formId, cb){
  formId = Number(formId);

  exports.getDeployedApp(appId, function(err, app){
    if(err){
      cb(err);

      return;
    }

    if(app){
      var form = app.forms.filter(function(form) { return form.id === formId; })[0];

      cb(null, form);
    }
    else {
      cb();
    }
  });
};

exports.getDeployedListing = function(appId, listingId, cb){
  listingId = Number(listingId);

  exports.getDeployedApp(appId, function(err, app){
    if(err){
      cb(err);

      return;
    }

    if(app){
      var listing = app.listings.filter(function(listing) { return listing.id === listingId; })[0];

      if(listing){
        listing.order.sort(function(a,b){ return a.order > b.order});
      }

      cb(null, listing);
    }
    else {
      cb();
    }
  });
};

exports.saveFormData = function(appId, formId, formData, id, cb){
  if(id){
    updateFormData();
  }
  else{
    createFormData();
  }

  function updateFormData(){
    pg.connect(connectionString, function(err, client, done){
      if(err){
        cb(err);

        return;
      }

      var sql = "update formdata set data = $1 where id = $2;";

      client.query(sql, [formData, id], function(err){
        cb(err);

        done();
      });
    });
  }

  function createFormData(){
    pg.connect(connectionString, function(err, client, done){
      if(err){
        cb(err);

        return;
      }

      var sql = "insert into formdata (appid, formid, data) values ($1, $2, $3);";

      client.query(sql, [appId, formId, formData], function(err){
        cb(err);

        done();
      });
    });
  }
};

exports.getFormData = function(appId, formId, formDataId, cb){
  pg.connect(connectionString, function(err, client, done){
    if(err){
      cb(err);

      done();
    }

    var sql = "select id, data from formdata where appid = $1 and formid = $2";

    var parameters = [appId, formId];

    if(formDataId){
      sql += " and id = $3";

      parameters.push(formDataId);
    }

    var query = client.query(sql, parameters);
    var formData = [];

    query.on("error", function(err){
      cb(err);

      done();
    });

    query.on("row", function(row){
      var data = row.data;
      data.id = row.id;
      formData.push(row.data);
    });

    query.on("end", function(){
      if(formDataId) {
        formData = formData[0];
      }

      cb(null, formData);

      done();
    });
  });
};
