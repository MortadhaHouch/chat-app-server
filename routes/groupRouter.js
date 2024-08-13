let express = require('express');
let jwt = require("jsonwebtoken")
let dotenv = require("dotenv");
let bcrypt = require('bcrypt');
let groupRouter = express.Router();
let Request = require("../models/friendRequest");
let GroupRequest = require("../models/groupRequest");
const User = require('../models/user');
const File = require('../models/file');
const Room = require('../models/room');
const Message = require('../models/message');
let Notification = require("../models/notification");
const { isValidObjectId } = require('mongoose');
dotenv.config();
groupRouter.get("/joined", async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(user){
                let joinedGroups = [];
                for (const el of user.groups) {
                    let group = await Room.findById(el._id);
                    if(group){
                        let groupAvatar = await File.findById(group.avatar);
                        let onlineUsersCount = 0;
                        for (const element of group.users) {
                            let groupElement = await User.findById(element);
                            if(groupElement.isLoggedIn){
                                onlineUsersCount++;
                            }
                        }
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
                                onlineUsersCount
                            }
                            messages.push(messageObject);
                        }
                        let groupObject = {
                            groupName:group.name,
                            groupAvatar:groupAvatar.path,
                            unseenMessagesCount:messages.filter((item)=>!item.isSeen).length,
                            messages
                        }
                        joinedGroups.push(groupObject);
                    }
                }
                let token = jwt.sign({joinedGroups},process.env.SECRET_KEY);
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
groupRouter.get("/requests", async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(user){
                let groups = await Room.find({admin:user._id});
                let groupRequests = await GroupRequest.find({to:user._id});
                let items = [];
                for (const item of groups) {
                    let foundItem = groupRequests.find((el,index)=>{
                        return el.groupId.toString() == item._id.toString();
                    })
                    if(foundItem){
                        let requestSender = await User.findById(foundItem.from);
                        let requestSenderAvatar = await File.findById(requestSender.avatar);
                        let groupAvatar = await File.findById(item.avatar);
                        let groupRequestObject = {
                            requestSender:`${requestSender.firstName} ${requestSender.lastName}`,
                            requestSenderAvatar:requestSenderAvatar.path,
                            email:requestSender.email,
                            groupAvatar:groupAvatar.path,
                            userId:requestSender._id,
                            groupName:item.name,
                            userIsLoggedIn:requestSender.isLoggedIn,
                            id:item._id,
                        }
                        items.push(groupRequestObject)
                    }
                }
                let token = jwt.sign({items},process.env.SECRET_KEY);
                res.status(200).json({token})
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
groupRouter.get("/search", async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(user){
                let foundGroups = [];
                let groups = await Room.find({name:req.query.name});
                for (const el of groups) {
                    let groupAvatar = await File.findById(el.avatar);
                    let groupRequest = await GroupRequest.findOne({groupId:el._id,from:user._id});
                    let groupObject = {
                        groupName:el.name,
                        groupAvatar:groupAvatar.path,
                        usersCount:el.users.length,
                        isPrivate:el.isPrivate,
                        isMyGroup:el.admin.toString() == user._id.toString(),
                        IamJoined:el.users.includes(user._id),
                        id:el._id
                    }
                    if(groupRequest){
                        groupObject.isPending = true
                    }
                    foundGroups.push(groupObject);
                }
                let token = jwt.sign({foundGroups},process.env.SECRET_KEY);
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
groupRouter.post("/create", async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let {avatar,name,isPrivate} = jwt.verify(req.body.body,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(user){
                let foundGroup = await Room.findOne({name});
                if(foundGroup){
                    let token = jwt.sign({error:"group with this name already exists"},process.env.SECRET_KEY);
                    res.status(201).json({token})
                }else{
                    let groupAvatar = await File.create({path:avatar});
                    let room =new Room({
                        name,
                        avatar:groupAvatar._id,
                        isPrivate,
                        admin:user._id
                    })
                    room.users.push(user._id);
                    user.groups.push(room._id);
                    await room.save();
                    await user.save();
                    let token = jwt.sign({message:"group created successfully"},process.env.SECRET_KEY);
                    res.status(201).json({token})
                }
            }
        }else{
            let token = jwt.sign({error:"something went wrong XD"},process.env.SECRET_KEY);
            res.status(404).json({token});
        }
    } catch (error) {
        console.log(error);
    }
})
groupRouter.post("/toggle-join-group",async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(user){
                let {id} = jwt.verify(req.body.body,process.env.SECRET_KEY);
                let group = await Room.findById(id);
                if(group){
                    if(group.users.includes(user._id)){
                        let token = jwt.sign({error:"you are already in this group"},process.env.SECRET_KEY);
                        res.json({token});
                    }else{
                        let request = await GroupRequest.create({
                            from:user._id,
                            to:group.admin,
                            groupId:group._id
                        })
                        let token = jwt.sign({message:"group request sent, please wait for the response"},process.env.SECRET_KEY);
                        res.status(201).json({token});
                    }
                }else{
                    let token = jwt.sign({error:"group not found"},process.env.SECRET_KEY);
                    res.status(404).json({token})
                }
            }else{
                let token = jwt.sign({error:"resource not authorized"},process.env.SECRET_KEY);
                res.status(403).json({token})
            }
        }
    } catch (error) {
        console.log(error);
    }
})
groupRouter.post("/toggle-accept-user",async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let {approve,id,userId} = jwt.verify(req.body.body,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(user){
                let group = await Room.findById(id);
                let requestSender = await User.findById(userId);
                if(group){
                    if(group.admin.toString() == user._id.toString()){
                        if(approve){
                            if(!group.users.includes(requestSender._id)){
                                group.users.push(requestSender._id);
                                requestSender.groups.push(group._id);
                                let notification = await Notification.create({
                                    handler:group.admin,
                                    for:requestSender._id,
                                    content:`Your request to join the ${group.name} has been approved`
                                });
                                await group.save();
                                await requestSender.save();
                                await GroupRequest.findOneAndDelete({groupId:group._id});
                                let token = jwt.sign({message:"congrats, you have been added to the group"},process.env.SECRET_KEY);
                                res.json({token});
                            }
                        }else{
                            let notification = await Notification.create({
                                handler:group.admin,
                                for:requestSender._id,
                                content:`Your request to join the ${group.name} has been rejected`
                            });
                            await GroupRequest.findOneAndDelete({groupId:group._id});
                            let token = jwt.sign({error:"OOPS !! your request has been rejected by the admin"},process.env.SECRET_KEY);
                            res.json({token});
                        }
                    }else{
                        let token = jwt.sign({error:"you are not allowed to access this resource"},process.env.SECRET_KEY);
                        res.status(403).json({token});
                    }
                }else{
                    let token = jwt.sign({error:"group not found"},process.env.SECRET_KEY);
                    res.status(404).json({token})
                }
            }else{
                let token = jwt.sign({error:"resource not authorized"},process.env.SECRET_KEY);
                res.status(403).json({token})
            }
        }
    } catch (error) {
        console.log(error);
    }
})
groupRouter.put("/leave-group",async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let {id} = jwt.verify(req.body.body,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(user){
                let group = await Room.findById(id);
                if(group){
                    group.users.splice(group.users.indexOf(user._id),1);
                    user.groups.splice(user.groups.indexOf(group._id),1);
                    await group.save();
                    await user.save();
                    let token = jwt.sign({message:"successfully left the group"},process.env.SECRET_KEY);
                    res.json({token});
                }
            }
        }else{
            let token = jwt.sign({error:"resource is unauthorized"},process.env.SECRET_KEY);
            res.status(403).json({token});
        }
    } catch (error) {
        console.log(error);
    }
})
groupRouter.delete("/cancel-request/:groupId",async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(user){
                if(isValidObjectId(req.params.groupId)){
                    await GroupRequest.findOneAndDelete({groupId:req.params.groupId});
                    let token = jwt.sign({message:"request cancelled"},process.env.SECRET_KEY);
                    res.json({token});
                }
            }else{
                let token = jwt.sign({error:"resource unauthorized"},process.env.SECRET_KEY);
                res.status(403).json({token})
            }
        }
    } catch (error) {
        console.log(error);
    }
})
module.exports = groupRouter