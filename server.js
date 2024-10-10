require("dotenv").config(); 
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const marked = require("marked");
const express = require("express");
const db = require("better-sqlite3")("ourApp.db"); 
db.pragma("journal_mode = WAL");
const sanitizeHTML=require("sanitize-html");


// database setup 
const createTables = db.transaction(()=>{
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username STRING NOT NULL UNIQUE,
        password STRING NOT NULL 
        )
        `).run()

    db.prepare(`
        CREATE TABLE IF NOT EXISTS posts(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        createdDate TEXT,
        title STRING NOT NULL UNIQUE,
        body TEXT NOT NULL,
        authorid INTEGER,
        FOREIGN KEY (authorid) REFERENCES users (id)
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
    // make our markdown function available
    res.locals.filterUserHTML=function(content){
        return sanitizeHTML(marked.parse(content),{
            allowedTags:["p","br","ul","li","ol","strong","bold","i","em","h1","h2","h3"],
            allowedAttributes:{}
        });
    }

    res.locals.errors=[];

    // trying to decode incoming cookie
    try {
        const decoded = jwt.verify(req.cookies.ourSimpleApp,process.env.JWTSECRET);
        req.user = decoded; //either evalutes to true or else false
    } catch (error) {
        req.user = false
    }
    
    res.locals.user = req.user
   
    


    next();
})

// to get data from form
app.use(express.urlencoded({extended:false}))

app.get('/',(req,res)=>{
   if(req.user){
    const postsStatement = db.prepare("SELECT * FROM posts WHERE authorid = ? ORDER BY createdDate DESC");
    const posts = postsStatement.all(req.user.userid);
    return res.render("dashboard",{posts})
   }
   res.render("homepage")
});

app.get('/login',(req,res)=>{
    res.render("login")
});

// logOut 
app.get('/logout',(req,res)=>{
    res.clearCookie("ourSimpleApp")
    res.redirect("/")
});

// login
app.post('/login',(req,res)=>{
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
     // check for empty fields
     if(!req.body.password){
        errors.push(" You must provide a password")
    }

    if (errors.length){
        // making the errors accessible in the view file
        return res.render("login",{errors})
    }

    const userInQuestionStatement = db.prepare(" SELECT * FROM USERS WHERE username = ? ")
    const userInQuestion = userInQuestionStatement.get(req.body.username)

    if(!userInQuestion){
     errors = ["Invalid username/password."]
     return res.render("login",{errors})
    }


    const matchOrNot = bcrypt.compareSync(req.body.password,userInQuestion.password)

    if(!matchOrNot){
       errors = ["Invalid username/password."]
       return res.render("login",{errors})
    }

    // give them a cookie
     // log the user in by giving them a cookie
     const ourTokenValue = jwt.sign({exp: Math.floor(Date.now() / 1000) + 60 * 60 *60, userid: userInQuestion.id, username: userInQuestion.username },process.env.JWTSECRET);
 
    res.cookie("ourSimpleApp", ourTokenValue,{
        httpOnly: true,
        secure : true,
        sameSite:"strict", // eleminates to some extent, the need to setup csrf tokens 
        maxAge:1000*60*60*24 // cookie to be live for 24 hours
    })

    // redirect 
    res.redirect("/")
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

    // check if username already exists
    const usernameStatement = db.prepare("SELECT * FROM USERS WHERE username = ?");
    const usernameCheck = usernameStatement.get(req.body.username)
    if (usernameCheck){
        errors.push("that username is already taken")
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
    
     

        res.cookie("ourSimpleApp", ourTokenValue,{
            httpOnly: true,
            secure : true,
            sameSite:"strict", // eleminates to some extent, the need to setup csrf tokens 
            maxAge:1000*60*60*24 // cookie to be live for 24 hours
        })

    res.send("Thank You")
});

// check if user is logged in before they can access the crud routes

function mustBeLoggedIn(req,res,next){
    if(req.user){
        return next()
    }
    return res.redirect("/")
}

//******* CRUD ********
app.get("/create-post",mustBeLoggedIn,(req,res)=>{
    res.render("create");
})

function sharedPostValidation(req){
    const errors = []
    
     // changing type of input info to strings
     if (typeof req.body.title !== "string"){
        req.body.username=""
    }
    if (typeof req.body.body !== "string"){
        req.body.password =""
    }

    // trim white spaces
    req.body.title = sanitizeHTML(req.body.title.trim(),{
        allowedTags:[],
        allowedAttributes:{}
    })
    req.body.body = sanitizeHTML(req.body.body.trim(),{
        allowedTags:[],
        allowedAttributes:{}
    })
    
    // check for empty fields
    if(!req.body.title || !req.body.body){
        errors.push(" You must fill the empty space")
    }

    return errors;
}

app.post("/create-post",mustBeLoggedIn,(req,res)=>{
    const errors = sharedPostValidation(req)

    if(errors.length){
       return  res.render("create-post",{errors});
    }

    // save into database
    const ourStatement = db.prepare(" INSERT INTO posts (title,body,authorid,createdDate ) VALUES (?,?,?,?)");
    const result = ourStatement.run(req.body.title,req.body.body,req.user.userid, new Date().toISOString());

    const getPostStatement = db.prepare("SELECT * FROM posts WHERE ROWID = ?")
    const realPost = getPostStatement.get(result.lastInsertRowid)

   res.redirect(`/post/${realPost.id}`)
})

app.get("/post/:id",(req,res)=>{
    const statement = db.prepare(`
        SELECT posts.*, users.username FROM posts INNER JOIN users ON posts.authorid = users.id WHERE posts.id = ?
        `)
    const post = statement.get(req.params.id);

    if (!post){
        return res.redirect("/"); 
    }

    const isAuthor = post.authorid === req.user.userid;
    res.render("single-post",{post,isAuthor})
})

// edit

app.get("/edit-post/:id",mustBeLoggedIn,(req,res)=>{
    // try to look up the post in question
    const statement = db.prepare("SELECT * FROM posts WHERE id = ?");
    const post = statement.get(req.params.id);

    // if post does not exist
    if(!post){
        return res.redirect("/");
    }

    // if you're not the post in question, redirect to homepage
    if (post.authorid !== req.user.userid){
        return res.redirect("/");
    }

  

    // otherwise, render the post template
    res.render("edit-post",{post})
});

app.post("/edit-post/:id",mustBeLoggedIn,(req,res)=>{
     // try to look up the post in question
     const statement = db.prepare("SELECT * FROM posts WHERE id = ?");
     const post = statement.get(req.params.id);
 
     // if post does not exist
     if(!post){
         return res.redirect("/");
     }
 
     // if you're not the post in question, redirect to homepage
     if (post.authorid !== req.user.userid){
         return res.redirect("/");
     }

     const errors = sharedPostValidation(req);

     if(errors.length){
        return res.render("edit-post",{errors})
     }

     const updateStatement = db.prepare("UPDATE posts SET title = ?, body = ? WHERE ID = ?");
     updateStatement.run(req.body.title, req.body.body,req.params.id);

     res.redirect(`/post/${req.params.id}`);
})

// delete
app.post("/delete-post/:id",mustBeLoggedIn,(req,res)=>{
     // try to look up the post in question
     const statement = db.prepare("SELECT * FROM posts WHERE id = ?");
     const post = statement.get(req.params.id);
 
     // if post does not exist
     if(!post){
         return res.redirect("/");
     }
 
     // if you're not the post in question, redirect to homepage
     if (post.authorid !== req.user.userid){
         return res.redirect("/");
     }

     const deleteStatement = db.prepare("DELETE FROM posts WHERE id =  ?")
     deleteStatement.run(req.params.id);

     res.redirect("/")
})

app.listen(5000,console.log("listening on port 5000..."))