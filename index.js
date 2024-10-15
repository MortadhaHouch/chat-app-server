let express = require("express")
let app = express()
let {createServer} = require("http")
let server = createServer(app)
let socket = require("socket.io")
let bodyParser = require("body-parser");
let cookieParser = require("cookie-parser");
let cors = require("cors");
let userRouter = require("./routes/userRouter");
let database = require("./database/database");
const notificationsRouter = require("./routes/notificationsRouter")
const groupRouter = require("./routes/groupRouter")
const messageRouter = require("./routes/messageRouter")
let fileUpload = require("express-fileupload")
const checkUserAuth = require("./middlewares/checkUserAuth")
let User = require("./models/user");
let jwt = require("jsonwebtoken");
let Discussion = require("./models/discussion");
let Message = require("./models/message");
require("dotenv").config();
database();
let io = socket(server,{
    cors:{
        origin:"http://localhost:5173"
    },
})
app.use(express.json({limit:"100mb"}));
app.use(bodyParser.json({limit:"100mb"}))
app.use(bodyParser.urlencoded({extended:true}));
app.use(cookieParser());
app.use(cors({
    methods:["GET","POST","PUT","DELETE","PATCH","OPTIONS"],
    origin:"http://localhost:5173",
    credentials:true
}))
app.use(fileUpload({
    preserveExtension : true,
}));
// io.use(async(socket, next)=>{
//     if(socket.handshake.auth.token.length > 0){
//         let {email} = jwt.verify(socket.handshake.auth.token,process.env.SECRET_KEY);
//         let user = await User.findOne({email});
//         if(user){
//             console.log(`${user.firstName} ${user.lastName} connected`);
//         }
//     }
//     next()
// })
app.use("/user",userRouter);
app.use("/notifications",checkUserAuth,notificationsRouter);
app.use("/groups",checkUserAuth,groupRouter);
app.use("/message",checkUserAuth,messageRouter);
server.listen(process.env.PORT,()=>{
    console.log("server running on port "+process.env.PORT);
})
io.on("connection",(socket)=>{
    socket.on("send-message",async(data)=>{
        if(socket.handshake.auth.token?.length > 0){
            let discussion = await Discussion.findById(data.discussionId);
            let {email} = jwt.verify(socket.handshake.auth.token,process.env.SECRET_KEY);
            let user = await User.findOne({email});
            if(discussion && user && discussion.members.includes(user._id)){
                let message = new Message({
                    content:data.message,
                    from:user._id
                })
                message.to.push(...discussion.members.filter((id)=>id.toString()!==user._id.toString()));
                await message.save();
                discussion.messages.push(message._id);
                await discussion.save();
                if(!socket.rooms.has(data.discussionId)){
                    socket.join(data.discussionId);
                    socket.emit("receive-message",{
                        content:message.content,
                        filesCount:message.files.length,
                        messageIsMine:message.from.toString()===user._id.toString(),
                        reactions:message.reactions.length,
                        unseenMessagesCount:discussion.messages.filter((item)=>!item.isSeen).length,
                        createdAt:message.createdAt,
                        id:message._id
                    });
                }
            }
        }else{
            return;
        }
    })
})
app.get("/",(req,res)=>{
    res.status(200).json({message:"connected"})
})