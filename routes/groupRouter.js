const express = require('express');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { isValidObjectId } = require('mongoose');
const router = express.Router();

// Models
const Request = require("../models/friendRequest");
const GroupRequest = require("../models/groupRequest");
const User = require('../models/user');
const File = require('../models/file');
const Room = require('../models/room');
const Message = require('../models/message');
const Notification = require("../models/notification");

dotenv.config();

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.jwt_token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    req.user = await User.findOne({ email: decoded.email }).select('-password');
    
    if (!req.user) return res.status(401).json({ error: "Invalid token" });
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Get joined groups
router.get("/joined", authenticate, async (req, res) => {
  try {
    const user = req.user;
    const joinedGroups = await Promise.all(user.groups.map(async (groupId) => {
      const group = await Room.findById(groupId);
      if (!group) return null;

      const [groupAvatar, users] = await Promise.all([
        File.findById(group.avatar),
        User.find({ _id: { $in: group.users } })
      ]);

      const onlineUsersCount = users.filter(u => u.isLoggedIn).length;
      const messages = await Promise.all(group.messages.slice(0, 20).map(async (messageId) => {
        const message = await Message.findById(messageId);
        if (!message) return null;

        const [messageSender, senderAvatar] = await Promise.all([
          User.findById(message.from),
          File.findById(messageSender?.avatar)
        ]);

        return {
          senderAvatar: senderAvatar?.path,
          message: message.content,
          messageSender: messageSender ? `${messageSender.firstName} ${messageSender.lastName}` : 'Deleted User',
          messageIsMine: message.from.toString() === user._id.toString(),
          files: message.files.length,
          reactions: message.reactions.length
        };
      }));

      return {
        groupName: group.name,
        groupAvatar: groupAvatar?.path,
        unseenMessagesCount: messages.filter(m => !m?.isSeen).length,
        messages: messages.filter(m => m !== null),
        onlineUsersCount
      };
    }));

    res.status(200).json({ 
      joinedGroups: joinedGroups.filter(group => group !== null) 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get group requests
router.get("/requests", authenticate, async (req, res) => {
  try {
    const user = req.user;
    const [groups, groupRequests] = await Promise.all([
      Room.find({ admin: user._id }),
      GroupRequest.find({ to: user._id })
    ]);

    const items = await Promise.all(groups.map(async (group) => {
      const foundRequest = groupRequests.find(req => 
        req.groupId.toString() === group._id.toString()
      );
      if (!foundRequest) return null;

      const [requestSender, requestSenderAvatar, groupAvatar] = await Promise.all([
        User.findById(foundRequest.from),
        File.findById(requestSender?.avatar),
        File.findById(group.avatar)
      ]);

      return {
        requestSender: requestSender ? 
          `${requestSender.firstName} ${requestSender.lastName}` : 'Deleted User',
        requestSenderAvatar: requestSenderAvatar?.path,
        email: requestSender?.email,
        groupAvatar: groupAvatar?.path,
        userId: requestSender?._id,
        groupName: group.name,
        userIsLoggedIn: requestSender?.isLoggedIn || false,
        id: group._id
      };
    }));

    res.status(200).json({ 
      items: items.filter(item => item !== null) 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Search groups
router.get("/search", authenticate, async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: "Group name required" });

    const user = req.user;
    const groups = await Room.find({ 
      name: { $regex: name, $options: 'i' } 
    });

    const foundGroups = await Promise.all(groups.map(async (group) => {
      const [groupAvatar, groupRequest] = await Promise.all([
        File.findById(group.avatar),
        GroupRequest.findOne({ groupId: group._id, from: user._id })
      ]);

      return {
        groupName: group.name,
        groupAvatar: groupAvatar?.path,
        usersCount: group.users.length,
        isPrivate: group.isPrivate,
        isMyGroup: group.admin.toString() === user._id.toString(),
        IamJoined: group.users.includes(user._id),
        isPending: !!groupRequest,
        id: group._id
      };
    }));

    res.status(200).json({ foundGroups });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Create group
router.post("/create", authenticate, async (req, res) => {
  try {
    const { avatar, name, isPrivate } = req.body;
    if (!name || typeof isPrivate !== 'boolean') {
      return res.status(400).json({ error: "Invalid input" });
    }

    const user = req.user;
    const existingGroup = await Room.findOne({ name });
    if (existingGroup) {
      return res.status(400).json({ error: "Group name already exists" });
    }

    const groupAvatar = await File.create({ path: avatar });
    const room = new Room({
      name,
      avatar: groupAvatar._id,
      isPrivate,
      admin: user._id,
      users: [user._id]
    });

    user.groups.push(room._id);
    await Promise.all([room.save(), user.save()]);

    res.status(201).json({ message: "Group created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Join group request
router.post("/toggle-join-group", authenticate, async (req, res) => {
  try {
    const { id } = req.body;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const user = req.user;
    const group = await Room.findById(id);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (group.users.includes(user._id)) {
      return res.status(400).json({ error: "Already in this group" });
    }

    await GroupRequest.create({
      from: user._id,
      to: group.admin,
      groupId: group._id
    });

    res.status(201).json({ 
      message: "Join request sent. Waiting for admin approval." 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Accept/Reject group join request
router.post("/toggle-accept-user", authenticate, async (req, res) => {
  try {
    const { approve, id, userId } = req.body;
    if (!isValidObjectId(id) || !isValidObjectId(userId)) {
      return res.status(400).json({ error: "Invalid IDs" });
    }

    const admin = req.user;
    const [group, requestSender] = await Promise.all([
      Room.findById(id),
      User.findById(userId)
    ]);

    if (!group) return res.status(404).json({ error: "Group not found" });
    if (!requestSender) return res.status(404).json({ error: "User not found" });
    if (group.admin.toString() !== admin._id.toString()) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (approve) {
      if (!group.users.includes(requestSender._id)) {
        group.users.push(requestSender._id);
        requestSender.groups.push(group._id);

        await Notification.create({
          handler: group.admin,
          for: requestSender._id,
          content: `Request to join ${group.name} approved`
        });

        await Promise.all([
          group.save(),
          requestSender.save(),
          GroupRequest.deleteOne({ groupId: group._id, from: userId })
        ]);

        return res.json({ message: "User added to group" });
      }
    } else {
      await Notification.create({
        handler: group.admin,
        for: requestSender._id,
        content: `Request to join ${group.name} rejected`
      });

      await GroupRequest.deleteOne({ groupId: group._id, from: userId });
      return res.json({ message: "Join request rejected" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Leave group
router.put("/leave-group", authenticate, async (req, res) => {
  try {
    const { id } = req.body;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const user = req.user;
    const group = await Room.findById(id);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    group.users.pull(user._id);
    user.groups.pull(group._id);
    await Promise.all([group.save(), user.save()]);

    res.json({ message: "Left group successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Cancel join request
router.delete("/cancel-request/:groupId", authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const user = req.user;
    await GroupRequest.deleteOne({ 
      groupId, 
      from: user._id 
    });

    res.json({ message: "Request cancelled" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;