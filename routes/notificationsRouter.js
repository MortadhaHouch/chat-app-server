let express = require('express');
let Notification = require('../models/notification');
let notificationsRouter = express.Router();
notificationsRouter.get("/", async(req,res)=>{
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
module.exports = notificationsRouter;