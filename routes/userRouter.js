let express = require('express');
let jwt = require("jsonwebtoken")
let userRouter = express.Router();
let dotenv = require("dotenv");
const User = require('../models/user');
let bcrypt = require('bcrypt');
const File = require('../models/file');
const Room = require('../models/room');
const Message = require('../models/message');
let multer = require("multer");
let path = require('path');
let storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "../uploads")
    },
    filename: function (req, file, cb) {
        cb(null,file.fieldname+"."+path.extname(file))
    }
})
let uploads = multer({storage});
dotenv.config();
userRouter.post("/login",async(req,res)=>{
    try {
        console.log(req.body);
        res.status(200).json({body:req.body});
    } catch (error) {
        console.log(error);
    }
})
userRouter.post("/signup",uploads.single("file"), async(req,res)=>{
    try {
        console.log(req.body);
        res.status(200).json({body:req.body});
    } catch (error) {
        console.log(error);
    }
})
module.exports = userRouter;