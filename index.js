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
app.use((req,res,next)=>{
    console.log(req.method,req.url,new Date().toLocaleDateString());
    next()
})
app.use("/user",userRouter);
app.use("/notifications",checkUserAuth,notificationsRouter);
app.use("/groups",checkUserAuth,groupRouter);
app.use("/message",checkUserAuth,messageRouter);
server.listen(process.env.PORT,()=>{
    console.log("server running on port "+process.env.PORT);
})
io.on("connection",(socket)=>{
    socket.on("join-room", async ({ discussionId }) => {
        console.log(discussionId);
        const rooms = Array.from(socket.rooms);
        if (!rooms.includes(discussionId)) {
            socket.join(discussionId);
            console.log(`Socket ${socket.id} joined room ${discussionId}`);
            io.emit("room-joined", { discussionId });
        } else {
            console.log(`Socket ${socket.id} is already in room ${discussionId}`);
        }
    });
    socket.on("send-message", async (data) => {
        try {
            if (!socket.handshake.auth.token || !data?.discussionId) {
                return socket.emit("error", "Missing authentication or discussion ID");
            }
            const [decoded, discussion] = await Promise.all([
                jwt.verify(socket.handshake.auth.token, process.env.SECRET_KEY),
                Discussion.findById(data.discussionId)
            ]);
            if (!decoded?.email || !discussion) {
                return socket.emit("error", "Invalid token or discussion");
            }
            const user = await User.findById(decoded.userId);
            if (!user || !discussion.members.includes(user._id)) {
                return socket.emit("error", "User not authorized");
            }
            const message = await Message.create({
                content: data.message,
                from: user._id,
                to: discussion.members.filter(id => id.toString() !== user._id.toString())
            });
            await Discussion.updateOne(
                { _id: data.discussionId },
                { $push: { messages: message._id } }
            );
            if (!socket.rooms.has(data.discussionId)) {
                socket.join(data.discussionId);
            }
            io.to(data.discussionId).emit("receive-message", {
                id: message._id,
                content: message.content,
                senderId: user._id,
                createdAt: message.createdAt,
                isMine:message.from.toString() == user._id.toString(),
                filesCount: 0,
                reactions: []
            });
        } catch (error) {
            console.error("Message send error:", error);
            socket.emit("error", "Message sending failed");
        }
    });
    socket.on("connect-to-user",(id)=>{
        socket.emit("connected-to-user",id);
    })
})
app.get("/",(req,res)=>{
    res.status(200).json({message:"connected"})
})