let express = require('express');
let jwt = require("jsonwebtoken")
let userRouter = express.Router();
let dotenv = require("dotenv");
const User = require('../models/user');
let bcrypt = require('bcrypt');
const File = require('../models/file');
const Room = require('../models/room');
const Message = require('../models/message');
let requestIP = require("request-ip");
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
        let {email,password} = jwt.verify(req.body.body,process.env.SECRET_KEY);
        let user = await User.findOne({email});
        if(user){
            let validPassword = await bcrypt.compare(password,user.password);
            if(validPassword){
                let avatar = await File.findById(user.avatar);
                let friends = [];
                for (const friend of user.friends) {
                    let friendObject = await User.findById(friend._id);
                    let friendAvatar = await File.findById(friendObject.avatar);
                    friends.push({
                        email:friendObject.email,
                        firstName:friendObject.firstName,
                        lastName:friendObject.lastName,
                        friendAvatar:friendAvatar.path,
                        isLoggedIn:friendObject.isLoggedIn
                    })
                }
                let token = jwt.sign({
                    email, 
                    password,
                    avatar:avatar.path,
                    friends,
                    isLoggedIn:true
                },process.env.SECRET_KEY);
                user.isLoggedIn = true;
                await user.save();
                res.status(200).json({token});
            }else{
                let token = jwt.sign({password_error:"please verify your password"},process.env.SECRET_KEY);
                res.status(200).json({token});
            }
        }else{
            let token = jwt.sign({email_error:"user with this email does not exist please verify your password and try again or create an account"},process.env.SECRET_KEY);
            res.status(200).json({token});
        }
    } catch (error) {
        console.log(error);
    }
})
userRouter.post("/signup", async(req,res)=>{
    try {
        let {email,password,firstName,lastName,avatar,date} = jwt.verify(req.body.body,process.env.SECRET_KEY);
        
        let user = await User.findOne({email});
        if(user){
            let token = jwt.sign({email_error:"user with this email does exist"},process.env.SECRET_KEY);
            res.status(400).json({token})
        }else{
            let userAvatar = await File.create({
                path:avatar
            })
            let createdUser = await User.create({
                email,
                firstName,
                lastName,
                password,
                avatar:userAvatar._id,
                isLoggedIn:true,
                dateOfBirth:date,
                currentIp:requestIP.getClientIp(req)
            })
            let token = jwt.sign({email,firstName,lastName,avatar,isLoggedIn:createdUser.isLoggedIn,isVerified:true,dateOfBirth:date},process.env.SECRET_KEY);
            res.status(201).json({token});
        }
    } catch (error) {
        console.log(error);
    }
})
userRouter.post("/logout",async(req,res)=>{
    try {
        let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
        let user = await User.findOne({email});
        if(user){
            user.isLoggedIn = false;
            await user.save();
            let token = jwt.sign({message:"logged out successfully"},process.env.SECRET_KEY);
            res.status(200).json({token});
        }else{
            let token = jwt.sign({error:"something went wrong"},process.env.SECRET_KEY);
            res.status(400).json({token});
        }
    } catch (error) {
        console.log(error);
    }
})
module.exports = userRouter;