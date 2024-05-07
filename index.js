require("./utils.js");

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const app = express();

const Joi = require("joi");

const expireTime = 1 * 60 * 60 * 1000; //expires after 1 hour  (hours * minutes * seconds * millis)

app.use(express.urlencoded({ extended: false }));

const port = process.env.PORT || 3000;


/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const mongodb_database = process.env.MONGODB_DATABASE;
const node_session_secret = process.env.NODE_SESSION_SECRET;

/* END secret section */

var { database } = include('databaseConnection');

const userCollection = database.db(mongodb_database).collection('users');

app.use(express.urlencoded({ extended: false }));

var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
    crypto: {
        secret: mongodb_session_secret
    }
})

app.use(session({
    secret: node_session_secret,
    store: mongoStore,
    saveUninitialized: false,
    resave: true
}
));

app.get('/', (req, res) => {
    var html = '';

    if (!req.session.authenticated) {
        html += `
        <button onclick="location.href='/signup';">Sign Up</button><br>
        <button onclick="location.href='/login';">Login</button><br>
        `;
    } else {
        html += `Hello, ` + req.session.name + `<br>
        <button onclick="location.href='/members';">Go to Members Area</button><br>
        <button onclick="location.href='/logout';">Logout</button><br>
        `
    }
    res.send(html);
});



app.get('/signup', (req, res) => {
    var missingName = req.query.name;
    var missingPass = req.query.pass;
    var missingEmail = req.query.email;
    var nameTaken = req.query.taken;

    var html = `
        create user<br>
        <form action='/submitUser' method='post'>            
            <input name='name' type='text' placeholder='name'><br>
            <input name='email' type='email' placeholder='email'><br>
            <input name='password' type='password' placeholder='password'><br>
            <button>Submit</button>
        </form>
    `;
    if (missingName) {
        html += "<br> name is required";
    }
    if (nameTaken) {
        html += "<br> name already taken";
    }
    if (missingPass) {
        html += "<br> password is required";
    }
    if (missingEmail) {
        html += "<br> email is required";
    }

    res.send(html);
});

app.post('/submitUser', async (req, res) => {
    var name = req.body.name;
    var password = req.body.password;
    var email = req.body.email;
    var redirectString = '/signup?';
    var redirectFlag = 0;
    var result = await userCollection.find({ name: name })

    if (!name) {
        redirectString += '&name=1'
        redirectFlag = 1;
    }

    if(result == true) {
        redirectString += '&taken=1'
        redirectFlag = 1;
    }

    if (!password) {
        redirectString += '&pass=1'
        redirectFlag = 1;
    }

    if (!email) {
        redirectString += '&email=1'
        redirectFlag = 1;
    }

    if (redirectFlag == 1) {
        res.redirect(redirectString);

    } else {

        const schema = Joi.object(
            {
                name: Joi.string().alphanum().max(20).required(),
                password: Joi.string().max(20).required(),
                email: Joi.string().email({ minDomainSegments: 2, tlds: { allow: ['com', 'net'] } })
            });

        const validationResult = schema.validate({ name, password, email });
        if (validationResult.error != null) {
            console.log(validationResult.error);
            res.redirect("/signup");
            return;
        }

        var hashedPassword = await bcrypt.hashSync(password, saltRounds);

        await userCollection.insertOne({ name: name, email: email, password: hashedPassword });
        console.log("Inserted user");
        req.session.authenticated = true;
        req.session.name = name;
        req.session.cookie.maxAge = expireTime;

        res.redirect("/members");
    }
});

app.get('/login', (req, res) => {
    var html = `
    log in
    <form action='/loggingin' method='post'>
    <input name='name' type='text' placeholder='name'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.post('/loggingin', async (req, res) => {
    var name = req.body.name;
    var password = req.body.password;
    var html = '';

    const schema = Joi.string().max(20).required();
    const validationResult = schema.validate(name);
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.redirect("/login");
        return;
    }

    const result = await userCollection.find({ name: name }).project({ name: 1, password: 1, _id: 1 }).toArray();
    const userName = await userCollection.find({name: name});
    console.log("Username" + userName);
    console.log(result);
    if (result.length != 1) {
        html += "no such user<br> <a href='./login'>return</a>";
        console.log("user not found");
        res.send(html);
        return;
    }
    if (await bcrypt.compare(password, result[0].password)) {
        console.log("correct password");
        req.session.authenticated = true;
        req.session.name = name;
        req.session.cookie.maxAge = expireTime;

        res.redirect('/loggedIn');
        return;
    }
    else {
        console.log("incorrect password");
        html += "invalid name/password combination<br> <a href='./login'>return</a>";
        console.log("invalid combo");
        res.send(html);
        return;
    }
});

app.get('/loggedin', (req, res) => {
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else {
        var html = `
    You are logged in!
    <button onclick="location.href='/';">Go Home</button><br>    
    `;
        res.send(html);
    }
});

app.get('/members', (req, res) => {    

    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    var randVal = getRandomInt(0,2);
    
    if (!req.session.authenticated) {
        res.redirect('/');
    } else {
        var html = `
    Howdy, ` + req.session.name + `<br>
    `;
        if (randVal == 0) {
            html+="<img src='/0.gif' style='width:250px;'><br>";
        }
        else if (randVal == 1) {
            html+="<img src='/1.gif' style='width:250px;'><br>";
        }
        else {
            html+="<img src='/2.gif' style='width:250px;'><br>";
        }

        html += `<button onclick="location.href='/logout';">Logout</button><br>
    `;
        res.send(html);
    }

})

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

app.use(express.static(__dirname + "/public"));

app.get("*", (req, res) => {
    res.status(404);
    res.send("<img src='https://imgs.xkcd.com/comics/not_available.png'>");
})


app.listen(port, () => {
    console.log("Node application listening on port " + port);
}); 