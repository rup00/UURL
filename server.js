// Import all modules
const express = require("express");
const mongo = require("mongoose");
const ejs = require("ejs");
const port = 8000;
const hostName = "127.0.0.1"; //LoopBack address

// Import DB Data
const db_data = require("./setup/config");

let app = express();

let session = require("express-session");
let MongoDBStore = require("connect-mongodb-session")(session);

let store = new MongoDBStore({
  uri: db_data.url,
  collection: "mySessions",
});

// Catch errors
store.on("error", function (error) {
  console.log(error);
});

let API_LIMIT = 3;

app.use(
  require("express-session")({
    secret: "This is a secret",
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
    store: store,
    // Boilerplate options, see:
    // * https://www.npmjs.com/package/express-session#resave
    // * https://www.npmjs.com/package/express-session#saveuninitialized
    resave: true,
    saveUninitialized: true,
  })
);

// Import Tables
const User = require("./schema/Users");
const URL = require("./schema/Urls");
const Urls = require("./schema/Urls");

// app.use(express.static(location_of_staticcontent))
app.use(express.static(__dirname + "/client"));
app.set("view engine", "ejs");

// For form data collection
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Connect with Database
mongo
  .connect(db_data.url)
  .then(() => {
    console.log("Database Connected");
  })
  .catch((error) => {
    console.log("Error: Database Connection Failed");
  });

// Middleware Functions
function checkAuth(request, response, next) {
  if (request.session.email) {
    next();
  } else {
    response.redirect("/login");
  }
}

function checkAccess(request, response, next) {
  console.log(request.session);

  if (!request.session.email) {
    next();
  } else {
    response.redirect("/urlshorten");
  }
}

// @route: /
// @description: display home page
// @access: public

// URL
app.get("/", homePage);

// Logic
function homePage(request, response) {
  response.send("Welcome to URL Shortener Application");
}

// @route : /register
// @method : GET
// @description : display registration page
// @access : public

app.get("/register", checkAccess, registration);

function registration(request, response) {
  // Response
  response.render("register");
}

// @route : /login
// @method : GET
// @description : display login page
// @access: public

app.get("/login", checkAccess, login);

function login(request, response) {
  // Response
  response.render("login");
}

// @route: /register
// @description: store registration details in database
// @access: public
// @method : POST

app.post("/register", registerDetails);

function registerDetails(request, response) {
  console.log(request.body); //Print all registration details
  // IMP: It will print undefined, we have set some methods, refer line no 16.

  const { name, email, password, subscription } = request.body;

  // Register User
  // First Step : Check whether user is registered or not, email is stored in database or not.
  // @TODO: Hash the password using bcrypt.
  User.findOne({ email: email })
    .then((user) => {
      if (user) {
        // User exists already
        response.json({ status_code: 501, message: "already_registered" });
      } else {
        // New user
        // Create User Object.
        let api_calls = 0;

        let userObject = {
          name,
          email,
          password,
          subscription,
          api_calls,
        };

        // Save this data into the database.
        new User(userObject)
          .save()
          .then(() => {
            console.log("User registered successfully");

            // Store data of a user - {session}
            // Use of session - to track user.
            request.session.email = email;
            request.session.password = password;

            response.json({ status_code: 200, message: "registered" });
          })
          .catch((error) => console.log("Error"));
      }
    })
    .catch((error) => console.log("Error"));
}

app.post("/login", loginDetails);

function loginDetails(request, response) {
  console.log(request.body); //Print all registration details
  // It will print undefined, we have set some methods, refer line no 16.

  // Destructuring body object
  const { email, password } = request.body;

  // Register User
  // First Step : Check whether user is registered or not, email is stored in database or not.
  // @TODO: Compare the password using bcrypt.
  User.findOne({ email: email })
    .then((user) => {
      if (user) {
        // Implement Login Logic
        if (user.password == password) {
          // Create Session
          request.session.email = email;
          request.session.password = password; bb
        
          response.json({ status_code: 200, message: "success" });
        } else {
          response.json({ status_code: 501, message: "password_error" });
        }
      } else {
        response.json({ status_code: 501, message: "register_first" });
      }
    })
    .catch((error) => console.log("Error"));
}

app.get("/logout", (request, response) => {
  request.session.destroy((err) => {
    if (err)
      //If some error happens !
      response.redirect("/admin");
    else response.redirect("/login"); //Logout Successful
  });
});

//https://www.google.com -> 192.168.0.1
// http://localhost/mongo -> https://cloud.mongodb.com/v2/638833d7214d456978f03a27#metrics/replicaSet/6388341e05c0cf062d006db1/explorer/test

// url_mapping = {
//     "mongo" : "https://cloud.mongodb.com/v2/638833d7214d456978f03a27#metrics/replicaSet/6388341e05c0cf062d006db1/explorer/test"
// }

// @access : private
app.get("/urlshorten", checkAuth, (request, response) => {
  response.render("urlshorten", {
    email: request.session.email,
  });
});

app.post("/urlshorten", checkAuth, (request, response) => {
  let { url, slug } = request.body;

  slug = slug.toLowerCase();

  // Check API_CALLS For Free Account

  User.findOne({ email: request.session.email })
    .then((user) => {
      if (user.subscription === "Free") {
        // Check API_LIMIT
        if (user.api_calls >= API_LIMIT) {
          response.json({
            message: "Limit for free account reached, please subscribe !",
          });
        } else {
          // Slug Registration

          URL.findOne({ slug: slug })
            .then((slugDocument) => {
              if (slugDocument) {
                // Exists already
                response.json({ status_code: 502, message: "slug_error" });
              } else {
                // Store the URL-SLUG pair
                const slugObject = {
                  url,
                  slug,
                };

                new Urls(slugObject)
                  .save()
                  .then(() => {

                    // Update api_calls

                    new_api_calls = user.api_calls + 1;

                    User.updateOne({
                        email : request.session.email
                    },{
                        api_calls : new_api_calls
                    },{
                        $new : true
                    })
                    .then(()=>{
                        // After api_call update

                        response.json({
                            status_code: 200,
                            new_url: `http://localhost:8000/${slug}`,
                          });
                    })
                    .catch(err=>console.log("ERROR"));


                   
                  })
                  .catch((error) => console.log("Error"));
              }
            })
            .catch(handleError);

          function handleError() {
            console.log("Error");
          }
        }
      }
    })
    .catch((err) => console.log("Error"));
});

// http://localhost:8000/slug

app.get("/:slug", checkAuth, (request, response) => {
  let { slug } = request.params;

  URL.findOne({ slug: slug })
    .then((slugDocument) => {
      if (slugDocument) {
        // Redirect to original URL
        response.redirect(slugDocument.url);
      } else {
        response.json({ status_code: 502, message: "invalid_url" });
      }
    })
    .catch((error) => console.log("Error"));
});

app.listen(port, hostName, () => {
  console.log("Server is running..");
});
