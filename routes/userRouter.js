let express = require('express');
let jwt = require("jsonwebtoken")
let userRouter = express.Router();
let dotenv = require("dotenv");
const User = require('../models/user');
let bcrypt = require('bcrypt');
const File = require('../models/file');
const Room = require('../models/room');
const Message = require('../models/message');
let Notification = require('../models/notification');
let requestIP = require("request-ip");
let multer = require("multer");
let path = require('path');
let Request = require("../models/friendRequest");
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
userRouter.get("/search-friends", async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(req.query.name){
                if(req.query.name.split(" ").length == 1){
                    let usersByFirstName = await User.find({firstName: req.query.name});
                    if(usersByFirstName.length === 0){
                        let usersByLastName = await User.find({lastName: req.query.name});
                        if(usersByLastName.length === 0){
                            let token = jwt.sign({not_found:"No users matching the given name"},process.env.SECRET_KEY);
                            res.json({token})
                        }else{
                            let items = [];
                            for (const element of usersByLastName) {
                                let friendAvatar = await File.findById(element.avatar);
                                let requestObject = null;
                                let friendRequest = await Request.findOne({
                                    from:user._id,
                                    to:element._id
                                }); 
                                if(friendRequest){
                                    requestObject = {
                                        from:friendRequest.from,
                                        to:friendRequest.to,
                                    }
                                }
                                let elementObject = {
                                    email:element.email,
                                    name:`${element.firstName} ${element.lastName}`,
                                    friendAvatar:friendAvatar.path,
                                    isLoggedIn:element.isLoggedIn,
                                    isMyFriend:user.friends.includes(element._id),
                                    isBlocked:user.friends.includes(element._id) && user.blockedUsers.includes(element._id),
                                    id:element._id,
                                    requestObject
                                }
                                items.push(elementObject);
                            }
                            let token = jwt.sign({items},process.env.SECRET_KEY);
                            res.status(200).json({token})
                        }
                    }else{
                        let items = [];
                        for (const element of usersByFirstName) {
                            let requestObject = null;
                            let friendRequest = await Request.findOne({
                                from:user._id,
                                to:element._id
                            }); 
                            if(friendRequest){
                                requestObject = {
                                    from:friendRequest.from,
                                    to:friendRequest.to,
                                }
                            }
                            let friendAvatar = await File.findById(element.avatar);
                            let elementObject = {
                                email:element.email,
                                name:`${element.firstName} ${element.lastName}`,
                                friendAvatar:friendAvatar.path,
                                isLoggedIn:element.isLoggedIn,
                                isVideoCalling:element.isVideoCalling,
                                isAudioCalling:element.isAudioCalling,
                                id:element._id,
                                requestObject
                            }
                            items.push(elementObject);
                        }
                        let token = jwt.sign({items},process.env.SECRET_KEY);
                        res.status(200).json({token})
                    }
                }else if(req.query.name.split(" ").length == 2){
                    let users = await User.find({firstName: req.query.name[0],lastName: req.query.name[1]});
                    if(users.length === 0){
                        let usersInv = await User.find({firstName: req.query.name[1],lastName: req.query.name[0]});
                        if(usersInv.length === 0){
                            let token = jwt.sign({not_found:"No users matching the given name"},process.env.SECRET_KEY);
                            res.json({token})
                        }else{
                            let items = [];
                            for (const element of usersInv) {
                                let requestObject = null;
                                let friendRequest = await Request.findOne({
                                    from:user._id,
                                    to:element._id
                                }); 
                                if(friendRequest){
                                    requestObject = {
                                        from:friendRequest.from,
                                        to:friendRequest.to,
                                    }
                                }
                                let friendAvatar = await File.findById(element.avatar);
                                let elementObject = {
                                    email:element.email,
                                    name:`${element.firstName} ${element.lastName}`,
                                    friendAvatar:friendAvatar.path,
                                    isLoggedIn:element.isLoggedIn,
                                    isVideoCalling:element.isVideoCalling,
                                    isAudioCalling:element.isAudioCalling,
                                    id:element._id,
                                    requestObject
                                }
                                items.push(elementObject);
                            }
                            let token = jwt.sign({items},process.env.SECRET_KEY);
                            res.status(200).json({token})
                        }
                    }else{
                        let items = [];
                        for (const element of users) {
                            let requestObject = null;
                            let friendRequest = await Request.findOne({
                                from:user._id,
                                to:element._id
                            }); 
                            if(friendRequest){
                                requestObject = {
                                    from:friendRequest.from,
                                    to:friendRequest.to,
                                }
                            }
                            let friendAvatar = await File.findById(element.avatar);
                            let elementObject = {
                                email:element.email,
                                name:`${element.firstName} ${element.lastName}`,
                                friendAvatar:friendAvatar.path,
                                isLoggedIn:element.isLoggedIn,
                                isVideoCalling:element.isVideoCalling,
                                isAudioCalling:element.isAudioCalling,
                                id:element._id,
                                requestObject
                            }
                            items.push(elementObject);
                        }
                        let token = jwt.sign({items},process.env.SECRET_KEY);
                        res.status(200).json({token})
                    }
                }
            }
            let token = jwt.sign({data:req.query},process.env.SECRET_KEY);
            res.json({token})
        }else{
            let token = jwt.sign({error:"something went wrong XD"},process.env.SECRET_KEY);
            res.status(404).json({token});
        }
    } catch (error) {
        console.log(error);
    }
})
userRouter.post("/toggle-add-friend", async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let friendId = jwt.verify(req.body.body,process.env.SECRET_KEY).id;
            let user = await User.findOne({email});
            let friend = await User.findById(friendId);
            if(user.friends.includes(friend._id)){
                user.friends.splice(user.friends.indexOf(friendId), 1);
                friend.friends.splice(friend.friends.indexOf(user._id), 1);
                await user.save();
                await friend.save();
                let notification = await Notification.create({
                    for:friend._id,
                    content:`${user.firstName} ${user.lastName} have removed you from the friends list`,
                    handler:user._id
                })
                let token = jwt.sign({message:"successfully removed from friends list"},process.env.SECRET_KEY);
                res.json({token});
            }else{
                let friendRequest = await Request.create({
                    from:user._id,
                    to:friend._id,
                    isSent:true
                })
                let notification = await Notification.create({
                    for:friend._id,
                    content:`Friend request received from ${user.firstName} ${user.lastName}`,
                    handler:user._id
                })
                user.friendRequests.push(friendRequest._id);
                await user.save();
                let token = jwt.sign({message:"request sent"},process.env.SECRET_KEY);
                res.status(201).json({token});
            }
        }else{
            res.status(400).json({message:"bad request"})
        }
    } catch (error) {
        console.log(error);
    }
})
userRouter.post("/toggle-block-friend", async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let friendId = jwt.verify(req.body.body,process.env.SECRET_KEY);
            let friend = await User.findById(friendId);
            let user = await User.findOne({email});
            if(user.blockedUsers.includes(friendId)){
                user.friends.splice(user.friends.indexOf(friendId), 1);
                let notification = await Notification.create({
                    content:`You have been unblocked by ${user.firstName} ${user.lastName}`,
                    handler:user._id,
                    for:friend._id
                })
                await user.save();
                let token = jwt.sign({message:"friend removed from blocked list"},process.env.SECRET_KEY);
                res.json({token});
            }else{
                user.friends.push(friendId);
                let notification = await Notification.create({
                    content:`You have been blocked by ${user.firstName} ${user.lastName}`,
                    handler:user._id,
                    for:friend._id
                })
                await user.save();
                let token = jwt.sign({message:"friend added to blocked list"},process.env.SECRET_KEY);
                res.json({token});
            }
        }
    } catch (error) {
        console.log(error);
    }
})
userRouter.get("/requests",async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            let requests = await Request.find({to:user._id});
            let friendRequests = [];
            for (const element of requests) {
                let requestSender = await User.findById(element.from);
                let senderAvatar = await File.findById(requestSender.avatar);
                let requestObject = {
                    senderAvatar:senderAvatar.path,
                    requestSender:`${requestSender.firstName} ${requestSender.lastName}`,
                    id:element._id
                }
                friendRequests.push(requestObject);
            }
            let token = jwt.sign({friendRequests},process.env.SECRET_KEY);
            res.status(200).json({token});
        }
    } catch (error) {
        console.log(error);
    }
})
userRouter.put("/requests-toggle",async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let {id,approve} = jwt.verify(req.body.body,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            let request = await Request.findById(id);
            let requestSender = await User.findById(request.from);
            let requestReceiver = await User.findById(request.to);
            if(approve){
                let notificationForSender = await Notification.create({
                    for:requestSender._id,
                    content:`Friend request accepted by ${requestReceiver.firstName} ${requestReceiver.lastName}`,
                    handler:requestReceiver._id
                });
                let notificationForReceiver = await Notification.create({
                    for:requestReceiver._id,
                    content:`${requestSender.firstName} ${requestSender.lastName} has been added to your friends list`,
                    handler:requestReceiver._id
                });
                let token = jwt.sign({message_success:"friend added"},process.env.SECRET_KEY);
                res.json({token});
            }else{
                let notificationForSender = await Notification.create({
                    for:user._id,
                    content:`Friend request rejected by ${requestReceiver.firstName} ${requestReceiver.lastName}`,
                    handler:requestReceiver._id
                });
                let notificationForReceiver = await Notification.create({
                    for:user._id,
                    content:`${requestSender.firstName} ${requestSender.lastName} request has been rejected`,
                    handler:requestReceiver._id
                });
                let token = jwt.sign({message_failure:"friend removed"},process.env.SECRET_KEY);
                res.json({token});
            }
        }else{
            res.status(400).json({message:"bad request"})
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
userRouter.post("/toggle-join-group", async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            let groupId = jwt.verify(req.body.body,process.env.SECRET_KEY).id;
            let group = await Room.findById(groupId);
            if(group.users.includes(user._id)){
                group.users.splice(group.users.indexOf(user._id),1);
            }
        }else{
            let token = jwt.sign({error:"something went wrong"},process.env.SECRET_KEY);
            res.status(404).json({token});
        }
    } catch (error) {
        console.log(error);
    }
})
userRouter.get("/notifications", async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            let userNotifications = [];
            let notifications = await Notification.find({
                for:user._id,
            })
            for (const element of notifications) {
                let notificationHandler = User.findById(element.handler);
                let notificationHandlerAvatar = await File.findById(notificationHandler.avatar);
                let notificationObject = {
                    content:element.content,
                    createdAt:element.createdAt,
                    handler:notificationHandler._id,
                    notificationHandlerAvatar:notificationHandlerAvatar.path
                }
                userNotifications.push(notificationObject);
            }
            let token = jwt.sign({userNotifications},process.env.SECRET_KEY);
            res.status(200).json({token});
        }else{
            let token = jwt.sign({error:"something went wrong"},process.env.SECRET_KEY);
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