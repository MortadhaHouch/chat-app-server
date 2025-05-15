const express = require('express');
const jwt = require("jsonwebtoken");
const userRouter = express.Router();
const dotenv = require("dotenv");
const User = require('../models/user');
const bcrypt = require('bcrypt');
const File = require('../models/file');
const Message = require('../models/message');
const Notification = require('../models/notification');
const requestIP = require("request-ip");
const multer = require("multer");
const path = require('path');
const Request = require("../models/friendRequest");
const Discussion = require("../models/discussion");

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "../uploads")
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + "." + path.extname(file))
    }
});

const uploads = multer({ storage });
dotenv.config();

// Helper function to verify JWT token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.SECRET_KEY);
    } catch (error) {
        return null;
    }
};

// Login endpoint
userRouter.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(400).json({ email_error: "User with this email does not exist" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: "Invalid password" });
        }

        const avatar = await File.findById(user.avatar);
        const friends = await Promise.all(user.friends.map(async (friendId) => {
            const friendObject = await User.findById(friendId);
            const friendAvatar = await File.findById(friendObject.avatar);
            return {
                email: friendObject.email,
                firstName: friendObject.firstName,
                lastName: friendObject.lastName,
                friendAvatar: friendAvatar.path,
                isLoggedIn: friendObject.isLoggedIn,
                isVideoCalling: friendObject.isVideoCalling,
                isAudioCalling: friendObject.isAudioCalling,
            };
        }));

        const token = jwt.sign({
            email,
            userId:user._id
        }, process.env.SECRET_KEY,
        { 
            expiresIn:60*60*24*3,
        });
        
        user.isLoggedIn = true;
        user.inactiveSince = "";
        await user.save();
        
        res.status(200).json({
            isVerified:true,
            token,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: avatar.path,
            dateOfBirth: user.dateOfBirth,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Signup endpoint
userRouter.post("/signup", async (req, res) => {
    try {
        const { email, password, firstName, lastName, avatar, date } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "User with this email already exists" });
        }

        const userAvatar = await File.create({ path: avatar });
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user= await User.create({
            email,
            firstName,
            lastName,
            password: hashedPassword,
            avatar: userAvatar._id,
            isLoggedIn: true,
            dateOfBirth: date,
            currentIp: requestIP.getClientIp(req),
            inactiveSince: ""
        });

        const token = jwt.sign({
            email,
            userId:user._id
        }, process.env.SECRET_KEY,
        { 
            expiresIn:60*60*24*3,
        });
        
        user.isLoggedIn = true;
        user.inactiveSince = "";
        await user.save();
        
        res.status(200).json({
            isVerified:true,
            token,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: avatar.path,
            dateOfBirth: user.dateOfBirth,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get friends endpoint
userRouter.get("/friends", async (req, res) => {
    try {
        const token = req.cookies.jwt_token;
        if (!token) {
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: "Invalid token" });
        }

        const user = await User.findOne({ email: decoded.email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const friends = await Promise.all(user.friends.map(async (friendId) => {
            const friend = await User.findById(friendId);
            if (!friend) return null;

            const foundDiscussion = await Discussion.findOne({
                members: { $all: [friend._id, user._id] }
            });

            if (!foundDiscussion) return null;

            const messages = await Promise.all(foundDiscussion.messages.map(async (messageId) => {
                const message = await Message.findById(messageId);
                if (!message) return null;
                
                return {
                    messageIsMine: message.from.toString() === user._id.toString(),
                    filesCount: message.files.length,
                    reactions: message.reactions.length,
                    unseenMessagesCount: foundDiscussion.messages.length,
                    content: message.content,
                    createdAt: message.createdAt,
                    id: message._id
                };
            }));

            const friendAvatar = await File.findById(friend.avatar);
            return {
                isLoggedIn: friend.isLoggedIn,
                isVideoCalling: friend.isVideoCalling,
                isAudioCalling: friend.isAudioCalling,
                email: friend.email,
                username: `${friend.firstName} ${friend.lastName}`,
                friendAvatar: friendAvatar.path,
                discussionId: foundDiscussion._id,
                id: friend._id,
                messages: messages.filter(m => m !== null)
            };
        }));

        res.status(200).json({ friends: friends.filter(friend => friend !== null) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Search friends endpoint
userRouter.get("/search-friends", async (req, res) => {
    try {
        const token = req.cookies.jwt_token;
        if (!token) {
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: "Invalid token" });
        }

        const user = await User.findOne({ email: decoded.email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (!req.query.name) {
            return res.status(400).json({ error: "Name parameter is required" });
        }

        let users = [];
        const nameParts = req.query.name.split(" ");

        if (nameParts.length === 1) {
            users = await User.find({ 
                $or: [
                    { firstName: nameParts[0] },
                    { lastName: nameParts[0] }
                ]
            });
        } else if (nameParts.length === 2) {
            users = await User.find({
                $or: [
                    { firstName: nameParts[0], lastName: nameParts[1] },
                    { firstName: nameParts[1], lastName: nameParts[0] }
                ]
            });
        }

        if (users.length === 0) {
            return res.status(404).json({ error: "No users matching the given name" });
        }

        const items = await Promise.all(users.map(async (element) => {
            const friendAvatar = await File.findById(element.avatar);
            const friendRequest = await Request.findOne({
                from: user._id,
                to: element._id
            });

            const similarFriendsCount = element.friends.filter(friendId => 
                user.friends.includes(friendId)
            ).length;

            return {
                email: element.email,
                name: `${element.firstName} ${element.lastName}`,
                friendAvatar: friendAvatar.path,
                isLoggedIn: element.isLoggedIn,
                isMyFriend: user.friends.includes(element._id),
                isBlocked: user.blockedUsers.includes(element._id),
                isAudioCalling: element.isAudioCalling,
                isVideoCalling: element.isVideoCalling,
                isMe: user._id.toString() === element._id.toString(),
                similarFriendsCount,
                id: element._id,
                requestObject: friendRequest ? {
                    from: friendRequest.from,
                    to: friendRequest.to,
                } : null
            };
        }));

        res.status(200).json({ items });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Toggle add friend endpoint
userRouter.post("/toggle-add-friend", async (req, res) => {
    try {
        const token = req.cookies.jwt_token;
        if (!token) {
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: "Invalid token" });
        }

        const user = await User.findOne({ email: decoded.email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const { id: friendId } = req.body;
        const friend = await User.findById(friendId);
        if (!friend) {
            return res.status(404).json({ error: "Friend not found" });
        }

        if (user.friends.includes(friend._id)) {
            // Remove friend
            user.friends.pull(friendId);
            friend.friends.pull(user._id);
            
            await Notification.create({
                for: friend._id,
                content: `${user.firstName} ${user.lastName} have removed you from the friends list`,
                handler: user._id
            });

            await user.save();
            await friend.save();
            
            return res.json({ message: "Successfully removed from friends list" });
        } else {
            // Add friend request
            const friendRequest = await Request.create({
                from: user._id,
                to: friend._id,
                isSent: true
            });

            await Notification.create({
                for: friend._id,
                content: `Friend request received from ${user.firstName} ${user.lastName}`,
                handler: user._id
            });

            user.friendRequests.push(friendRequest._id);
            await user.save();
            
            return res.status(201).json({ message: "Request sent" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Toggle block friend endpoint
userRouter.post("/toggle-block-friend", async (req, res) => {
    try {
        const token = req.cookies.jwt_token;
        if (!token) {
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: "Invalid token" });
        }

        const user = await User.findOne({ email: decoded.email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const { id: friendId } = req.body;
        const friend = await User.findById(friendId);
        if (!friend) {
            return res.status(404).json({ error: "Friend not found" });
        }

        if (user.blockedUsers.includes(friendId)) {
            // Unblock
            user.blockedUsers.pull(friendId);
            
            await Notification.create({
                content: `You have been unblocked by ${user.firstName} ${user.lastName}`,
                handler: user._id,
                for: friend._id
            });
            
            await user.save();
            return res.json({ message: "Friend removed from blocked list" });
        } else {
            // Block
            user.blockedUsers.push(friendId);
            
            await Notification.create({
                content: `You have been blocked by ${user.firstName} ${user.lastName}`,
                handler: user._id,
                for: friend._id
            });
            
            await user.save();
            return res.json({ message: "Friend added to blocked list" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get friend requests endpoint
userRouter.get("/requests", async (req, res) => {
    try {
        const token = req.cookies.jwt_token;
        if (!token) {
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: "Invalid token" });
        }

        const user = await User.findOne({ email: decoded.email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const requests = await Request.find({ to: user._id });
        const friendRequests = await Promise.all(requests.map(async (request) => {
            const requestSender = await User.findById(request.from);
            const senderAvatar = await File.findById(requestSender.avatar);
            
            return {
                senderAvatar: senderAvatar.path,
                requestSender: `${requestSender.firstName} ${requestSender.lastName}`,
                isMine: requestSender._id.toString() === user._id.toString(),
                id: request._id,
            };
        }));

        res.status(200).json({ friendRequests });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Handle friend request response endpoint
userRouter.put("/requests-toggle", async (req, res) => {
    try {
        const token = req.cookies.jwt_token;
        if (!token) {
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: "Invalid token" });
        }

        const user = await User.findOne({ email: decoded.email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const { id, approve } = req.body;
        const request = await Request.findById(id);
        if (!request) {
            return res.status(404).json({ error: "Request not found" });
        }

        const requestSender = await User.findById(request.from);
        const requestReceiver = await User.findById(request.to);

        if (approve) {
            // Approve request
            await Notification.create({
                for: requestSender._id,
                content: `Friend request accepted by ${requestReceiver.firstName} ${requestReceiver.lastName}`,
                handler: requestReceiver._id
            });

            await Notification.create({
                for: requestReceiver._id,
                content: `${requestSender.firstName} ${requestSender.lastName} has been added to your friends list`,
                handler: requestReceiver._id
            });

            const discussion = new Discussion({
                members: [requestReceiver._id, requestSender._id]
            });
            await discussion.save();

            requestSender.friendRequests.pull(request._id);
            requestReceiver.friendRequests.pull(request._id);
            await Request.findByIdAndDelete(request._id);

            requestSender.friends.push(requestReceiver._id);
            requestReceiver.friends.push(requestSender._id);

            await requestSender.save();
            await requestReceiver.save();

            return res.json({ message: "Friend added" });
        } else {
            // Reject request
            await Notification.create({
                for: requestSender._id,
                content: `Friend request rejected by ${requestReceiver.firstName} ${requestReceiver.lastName}`,
                handler: requestSender._id
            });

            await Notification.create({
                for: requestReceiver._id,
                content: `${requestSender.firstName} ${requestSender.lastName} request has been rejected`,
                handler: requestSender._id
            });

            requestSender.friendRequests.pull(request._id);
            requestReceiver.friendRequests.pull(request._id);
            await Request.findByIdAndDelete(request._id);

            await requestSender.save();
            await requestReceiver.save();

            return res.json({ message: "Request rejected" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Logout endpoint
userRouter.post("/logout", async (req, res) => {
    try {
        const token = req.cookies.jwt_token;
        if (!token) {
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: "Invalid token" });
        }

        const user = await User.findOne({ email: decoded.email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.isLoggedIn = false;
        user.inactiveSince = Date.now().toString();
        await user.save();

        res.json({ message: "Successfully logged out" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = userRouter;