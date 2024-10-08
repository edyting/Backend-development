const express = require("express");
const app = express();
app.set("view engine","ejs");

// middleware
app.use(express.static("public"));

app.get('/',(req,res)=>{
    res.render("homepage")
});

app.get('/login',(req,res)=>{
    res.render("login")
});

app.listen(5000,console.log("listening on port 5000..."))