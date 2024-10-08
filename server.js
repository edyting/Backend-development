const express = require("express");
const app = express();
app.set("view engine","ejs");

// middleware
app.use(express.static("public"));

// to get data from form
app.use(express.urlencoded({extended:false}))

app.get('/',(req,res)=>{
    res.render("homepage")
});

app.get('/login',(req,res)=>{
    res.render("login")
});

app.post('/register',(req,res)=>{
    console.log(req.body);
    res.send("Thank You")
    
});

app.listen(5000,console.log("listening on port 5000..."))