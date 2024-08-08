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
                        isLoggedIn:friendObject.isLoggedIn,
                        isVideoCalling:friendObject.isVideoCalling,
                        isAudioCalling:friendObject.isAudioCalling,
                    })
                }
                let token = jwt.sign({
                    email, 
                    password,
                    firstName:user.firstName,
                    lastName:user.lastName,
                    avatar:avatar.path,
                    friends,
                    isVerified:true,
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
            let token = jwt.sign({
                email,
                firstName,
                lastName,
                avatar,
                isVerified:true,
                dateOfBirth:date
            },
            process.env.SECRET_KEY);
            res.status(201).json({token});
        }
    } catch (error) {
        console.log(error);
    }
})
userRouter.get("/friends", async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(user){
                let friends = [];
                for (const el of user.friends) {
                    let friend = await User.findById(el._id)
                    if(friend){
                        let friendAvatar = await File.findById(friend.avatar);
                        let messages = await Message.find({
                            from:user._id,
                            to:friend._id
                        })
                        let friendObject = {
                            email:friend.email,
                            name:`${friend.firstName} ${friend.lastName}`,
                            friendAvatar:friendAvatar.path,
                            unseenMessagesCount:messages.filter((item)=>!item.isSeen).length,
                            messageIsMine:messages[messages.length - 1].from.toString()===user._id.toString(),
                            lastMessage:messages[messages.length - 1].content,
                            files:messages[messages.length - 1].files.length,
                            isLoggedIn:friend.isLoggedIn,
                            isVideoCalling:friend.isVideoCalling,
                            isAudioCalling:friend.isAudioCalling,
                        }
                        friends.push(friendObject);
                    }
                }
                let token = jwt.sign({friends},process.env.SECRET_KEY);
                res.status(200).json({token});
            }else{
                let token = jwt.sign({error:"something went wrong"},process.env.SECRET_KEY);
                res.status(404).json({token});
            }
        }else{
            let token = jwt.sign({error:"something went wrong XD"},process.env.SECRET_KEY);
            res.status(404).json({token});
        }
    } catch (error) {
        console.log(error);
    }
})
userRouter.get("/groups", async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(user){
                let groups = [];
                for (const el of user.groups) {
                    let group = await Room.findById(el._id)
                    if(group){
                        let groupAvatar = await File.findById(group.avatar);
                        let messages=[];
                        for (const element of group.messages) {
                            let message = await Message.findById(element._id);
                            let messageSender = await User.findById(message.from);
                            let senderAvatar = await File.findById(messageSender.avatar);
                            let messageObject = {
                                senderAvatar:senderAvatar.path,
                                message:message.content,
                                messageSender:`${messageSender.firstName} ${messageSender.lastName}`,
                                messageIsMine:message.from.toString()===user._id.toString(),
                                lastMessage:message.content,
                                files:message.files.length,
                                reactions:message.reactions.length,
                                onlineUsersCount:group.users.length
                            }
                            messages.push(messageObject);
                        }
                        let groupObject = {
                            groupName:group.name,
                            groupAvatar:groupAvatar.path,
                            unseenMessagesCount:messages.filter((item)=>!item.isSeen).length,
                            messages
                        }
                        groups.push(groupObject);
                    }
                }
                let token = jwt.sign({groups},process.env.SECRET_KEY);
                res.status(200).json({token});
            }else{
                let token = jwt.sign({error:"something went wrong"},process.env.SECRET_KEY);
                res.status(404).json({token});
            }
        }else{
            let token = jwt.sign({error:"something went wrong XD"},process.env.SECRET_KEY);
            res.status(404).json({token});
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
            if(req.cookies.jwt_token){
                let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
                let user = await User.findOne({email});
                if(user){
                    let userRooms = await Room.find({users:{$in:[user._id]}});
                    let rooms = [];
                    for (const el of userRooms) {
                        let roomAvatar = await File.findById(el._id);
                        let lastMessage = await Message.findById(el._id);
                        let roomObject = {
                            name:el.name,
                            avatar:roomAvatar.path,
                            activeMembers:el.users.length
                        }
                        rooms.push(roomObject);
                    }
                    let token = jwt.sign({rooms},process.env.SECRET_KEY);
                    res.status(200).json({token});
                }else{
                    let token = jwt.sign({error:"something went wrong"},process.env.SECRET_KEY);
                    res.status(404).json({token});
                }
            }else{
                let token = jwt.sign({error:"something went wrong XD"},process.env.SECRET_KEY);
                res.status(404).json({token});
            }
        }else{
            let token = jwt.sign({error:"something went wrong"},process.env.SECRET_KEY);
            res.status(400).json({token});
        }
    } catch (error) {
        console.log(error);
    }
})
module.exports = userRouter;