let express = require("express")
let app = express()
let {createServer} = require("http")
let server = createServer(app)
let socket = require("socket.io")
let bodyParser = require("body-parser");
let cors = require("cors");
let userRouter = require("./routes/userRouter");
let database = require("./database/database");
require("dotenv").config();
database();
let io = socket(server,{
    cors:{
        origin:"http://localhost:5173"
    }
})
app.use(express.json({limit:"100mb"}));
app.use(bodyParser.json({limit:"100mb"}))
app.use(bodyParser.urlencoded({extended:true}));
app.use(cors({
    methods:["GET","POST","PUT","DELETE","PATCH","OPTIONS"],
    origin:"http://localhost:5173",
    credentials:true
}))
app.use("/user",userRouter);
server.listen(process.env.PORT,()=>{
    console.log("server running on port "+process.env.PORT);
})
// io.on("connection",(socket)=>{
//     let connections = 0;
//     connections++;
//     socket.emit("connection-established",connections)
//     socket.on("message",(data)=>{
//         if(data.room){
//             socket.to(data.room).emit("message-received",{...data,connections});
//         }else{
//             socket.emit("message-received",{...data,connections});
//         }
//     })
//     socket.on("is-typing",(data)=>{
//         socket.to(data.room).emit("is-user-typing",{...data,connections});
//     })
//     socket.on("is-not-typing",(data)=>{
//         socket.to(data.room).emit("user-not-typing",{...data,connections});
//     })
//     socket.on("join-room",(data)=>{
//         connections++;
//         socket.join(data.room);
//         socket.emit("room-joined","room joined successfully",{...data,connections});
//     })
//     socket.on("disconnect-user",(data)=>{
//         connections--;
//         socket.join(data.room);
//         socket.to(data.room).emit("user-disconnection-encountered","user disconnected",{...data,connections});
//     })
//     socket.on("server-error",(data)=>{
//         connections--;
//         socket.join(data.room);
//         socket.emit("server-error-encountered","server error",{...data,connections})
//     })
//     socket.on("ping-timeout",(data)=>{
//         connections--;
//         socket.join(data.room);
//         socket.emit("response-timeout-encountered","response timeout error",{...data,connections})
//     })
//     socket.on("transport-close",(data)=>{
//         connections--;
//         socket.join(data.room);
//         socket.emit("transport-closure-encountered","transport closure error",{...data,connections})
//     })
//     socket.on("transport-error",(data)=>{
//         connections--;
//         socket.join(data.room);
//         socket.emit("transport-error-encountered","transport error",{...data,connections})
//     })
//     socket.on("connect-to-user",(id)=>{
//         socket.join(id);
//         socket.emit("connected-to-user",id);
//     })
//     socket.on("disconnect-user",(id)=>{
//         socket.emit("user-disconnected",id);
//     })
// })
app.get("/",(req,res)=>{
    res.status(200).json({message:"connected"})
})