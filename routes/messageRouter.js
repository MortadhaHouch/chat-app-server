const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
require("dotenv").config();

// Models
const Message = require("../models/message");
const User = require("../models/user");
const Discussion = require("../models/discussion");
const File = require("../models/file");

// Constants
const MESSAGES_PER_PAGE = 10;

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

// Get messages with pagination
router.get("/:id/:page?", authenticate, async (req, res) => {
  try {
    const { id: friendId } = req.params;
    const page = parseInt(req.params.page) || 0;
    
    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const discussion = await Discussion.findOne({
      members: { $all: [req.user._id, friendId] }
    }).populate({
      path: 'messages',
      options: {
        skip: page * MESSAGES_PER_PAGE,
        limit: MESSAGES_PER_PAGE,
        sort: { createdAt: -1 }
      },
      populate: {
        path: 'files',
        select: 'size name'
      }
    });

    if (!discussion) {
      return res.status(404).json({ error: "Discussion not found" });
    }

    const messages = discussion.messages.map(message => ({
      id: message._id,
      content: message.content,
      files: message.files.map(file => ({
        size: file.size,
        name: file.name
      })),
      isMine: message.from.toString() === req.user._id.toString(),
      createdAt: message.createdAt
    }));

    res.status(200).json({
      messages,
      hasMore: discussion.messages.length > (page + 1) * MESSAGES_PER_PAGE
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Add new message
router.post("/add", authenticate, async (req, res) => {
  try {
    const { userId, discussionId, content } = req.body;
    const files = req.files || [];

    if (!mongoose.Types.ObjectId.isValid(discussionId)) {
      return res.status(400).json({ error: "Invalid discussion ID" });
    }

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return res.status(404).json({ error: "Discussion not found" });
    }

    if (!discussion.members.includes(req.user._id)) {
      return res.status(403).json({ error: "Not a discussion member" });
    }

    // Create files first
    const fileUploads = files.map(file => 
      File.create({
        name: file.originalname,
        path: file.path,
        size: file.size
      })
    );

    const uploadedFiles = await Promise.all(fileUploads);

    // Create message with files
    const message = new Message({
      content,
      from: req.user._id,
      to: [userId],
      files: uploadedFiles.map(file => file._id)
    });

    // Save message and update discussion in transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const savedMessage = await message.save({ session });
      discussion.messages.push(savedMessage._id);
      await discussion.save({ session });
      
      await session.commitTransaction();
      
      // Prepare response without populating (faster)
      const response = {
        id: savedMessage._id,
        content: savedMessage.content,
        files: uploadedFiles.map(file => ({
          size: file.size,
          name: file.name
        })),
        createdAt: savedMessage.createdAt
      };

      res.status(201).json(response);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Add message error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;