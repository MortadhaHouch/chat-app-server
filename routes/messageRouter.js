let express = require("express");
let messageRouter = express.Router();
let Message = require("../models/message");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
let Discussion = require("../models/discussion");
require("dotenv").config();
let File = require("../models/file");
messageRouter.get("/:id/:p?",async(req,res)=>{
    try {
        if(req.cookies.jwt_token){
            let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(user){
                let friend = await User.findById(req.params.id);
                let discussion = await Discussion.findOne({
                    members:{
                        $in:[user._id,friend._id]
                    }
                })
                let messages = [];
                if(discussion.messages.length <= 10){
                    for await (const element of discussion.messages) {
                        let message = await Message.findById(element._id);
                        let messageFiles = [];
                        for await (const f of message.files) {
                            let file = await File.findById(f);
                            messageFiles.push({
                                size:file.size,
                                name:file.name
                            });
                        }
                        messages.push({
                            id:element._id,
                            content:message.content,
                            files:messageFiles
                        })
                    }
                }else{
                    if(req.params.p && !isNaN(Number(req.params.p))){
                        for await (const element of discussion.messages.slice(Number(req.params.p),Number(req.params.p) + 10)) {
                            let message = await Message.findById(element._id);
                            let messageFiles = [];
                            for await (const f of message.files) {
                                let file = await File.findById(f);
                                messageFiles.push({
                                    size:file.size,
                                    name:file.name
                                });
                            }
                            messages.push({
                                id:element._id,
                                content:message.content,
                                files:messageFiles
                            })
                        }
                    }else{
                        for await (const element of discussion.messages.slice(0,10)) {
                            let message = await Message.findById(element._id);
                            let messageFiles = [];
                            for await (const f of message.files) {
                                let file = await File.findById(f);
                                messageFiles.push({
                                    size:file.size,
                                    name:file.name
                                });
                            }
                            messages.push({
                                id:element._id,
                                content:message.content,
                                files:messageFiles
                            })
                        }
                    }
                }
                let token = jwt.sign({messages},process.env.SECRET_KEY);
                res.status(200).json({token});
            }
        }
    } catch (error) {
        console.log(error);
    }
})
messageRouter.post("/add",async(req,res)=>{
    try {
        let {email} = jwt.verify(req.cookies.jwt_token,process.env.SECRET_KEY);
        let user = await User.findOne({email});
        if(user){
            let {files} = req;
            let {userId,discussionId,content} = req.body;
            let discussion = await Discussion.findById(discussionId);
            let message = new Message({
                content,
                from:user._id,
            })
            message.to.push(userId);
            for await (const element of files) {
                let file = await File.create({
                    name:element.originalname,
                    path:element.path,
                    size:element.size
                });
                message.files.push(file._id);
            }
            await message.save();
            discussion.messages.push(message._id);
            await discussion.save();
            let token = jwt.sign({message},process.env.SECRET_KEY);
            res.status(201).json({token});
        }
    } catch (error) {
        console.log(error);
    }
})



module.exports = messageRouter