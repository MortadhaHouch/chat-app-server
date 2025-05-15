const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
require('dotenv').config();

// Models
const Notification = require('../models/notification');
const User = require('../models/user');
const File = require('../models/file');

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.jwt_token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    req.user = await User.findById(decoded.userId).select('-password');
    
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized - Invalid user' });
    }
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
};

// Get all notifications for authenticated user
router.get('/', authenticate, async (req, res) => {
  try {
    // Get notifications with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ for: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'handler',
        select: 'firstName lastName',
        populate: {
          path: 'avatar',
          select: 'path'
        }
      });

    // Format response
    const formattedNotifications = notifications.map(notification => ({
      id: notification._id,
      content: notification.content,
      createdAt: notification.createdAt,
      isRead: notification.isRead,
      handler: {
        id: notification.handler?._id,
        name: notification.handler ? 
          `${notification.handler.firstName} ${notification.handler.lastName}` : 
          'Deleted User',
        avatar: notification.handler?.avatar?.path || null
      }
    }));

    // Count total for pagination info
    const total = await Notification.countDocuments({ for: req.user._id });

    res.status(200).json({
      notifications: formattedNotifications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { 
        _id: req.params.id, 
        for: req.user._id 
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.status(200).json({ 
      message: 'Notification marked as read',
      notificationId: notification._id
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete notification
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      for: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.status(200).json({ 
      message: 'Notification deleted',
      notificationId: notification._id
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;