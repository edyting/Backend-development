require("dotenv").config(); 
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const express = require("express");
const db = require("better-sqlite3")("ourApp.db"); 
db.pragma("journal_mode = WAL");

// database setup 
const createTables = db.transaction(()=>{
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username STRING NOT NULL UNIQUE,
        password STRING NOT NULL 
        )
        `).run()
});

createTables();
// database ends here

const app = express();
app.set("view engine","ejs");

// middleware ****
app.use(express.static("public"));

app.use(cookieParser());

// to make errors array global and accessible before the form is submitted else there will b e an error of errors undefined
app.use((req,res,next)=>{
    res.locals.errors=[];

    // trying to decode incoming cookie
    try {
        const decoded = jwt.verify(req.cookies.ourSimpleApp,process.env.JWTSECRET);
        req.user = decoded;
    } catch (error) {
        req.user = false
    }
    
    res.locals.user = req.user
    console.log(req.user);
    


    next();
})

// to get data from form
app.use(express.urlencoded({extended:false}))

app.get('/',(req,res)=>{
    res.render("homepage")
});

app.get('/login',(req,res)=>{
    res.render("login")
});

app.post('/register',(req,res)=>{
    const errors =[];

    // changing type of input info to strings
    if (typeof req.body.username !== "string"){
        req.body.username=""
    }
    if (typeof req.body.password !== "string"){
        req.body.password =""
    }

    // trim white spaces
    req.body.username = req.body.username.trim();
    // check for empty fields
    if(!req.body.username){
        errors.push(" You must provide a username")
    }
    // username must be between 3 and 20
    if(req.body.username && req.body.username.length < 3){
        errors.push(" username must be at least three (3) characters long")
    }
    if(req.body.username && req.body.username.length > 20){
        errors.push(" username must not exceed 20 characters")
    }
    // to check for extra characters except letters and numbers
    if(req.body.username && !req.body.username.match(/^[a-zA-Z0-9]+$/)){
        errors.push(" username can only be letters and numbers")
    }

    // password
    if(req.body.password && req.body.password.length < 8){
        errors.push(" Password must be at least eight (8) characters long")
    }
    if(req.body.password && req.body.password.length > 70){
        errors.push(" Password must not exceed  characters")
    }
    // verifying if validation rules are met
    if (errors.length){
        // making the errors accessible in the view file
        return res.render("homepage",{errors})
    }

    // save new user to database

    // **** hashing passwords with bcrypt
    const salt = bcrypt.genSaltSync(10);
    req.body.password = bcrypt.hashSync(req.body.password,salt);

    const ourStatement = db.prepare(" INSERT INTO users (username,password) VALUES (?,?)")
        const result = ourStatement.run(req.body.username,req.body.password);

        // get the id of user to set cookie
        const lookupStatement = db.prepare("SELECT * FROM users WHERE ROWID = ? ")

        const ourUser = lookupStatement.get(result.lastInsertRowid);

    // log the user in by giving them a cookie
    const ourTokenValue = jwt.sign({exp: Math.floor(Date.now() / 1000) + 60 * 60 *60, userid: ourUser.id, username: ourUser.username },process.env.JWTSECRET);
    console.log(ourUser);
     

        res.cookie("ourSimpleApp", ourTokenValue,{
            httpOnly: true,
            secure : true,
            sameSite:"strict", // eleminates to some extent, the need to setup csrf tokens 
            maxAge:1000*60*60*24 // cookie to be live for 24 hours
        })

    res.send("Thank You")
});

app.listen(5000,console.log("listening on port 5000..."))