const Message = require('../models/Message');
const Chat = require('../models/Chat');
const mongoose = require('mongoose');

// Store the IO instance for emitting events
let io;

// Function to inject Socket.IO instance
exports.injectIO = (socketIO) => {
  io = socketIO;
};

// Get messages between the current user and another user
exports.getMessages = async (req, res) => {
  try {
    const currentUserMobile = req.user.mobile;
    const otherUserMobile = req.params.mobile;

    // Find or create chat
    let chat = await Chat.findOne({
      participants: { $all: [currentUserMobile, otherUserMobile] }
    });

    if (!chat) {
      // Create new chat if it doesn't exist
      chat = new Chat({
        participants: [currentUserMobile, otherUserMobile],
        unreadCounts: {}
      });
      await chat.save();
    }

    // Find all messages between these two users
    const messages = await Message.find({
      chatId: chat._id
    }).sort({ timestamp: 1 });

    // Reset unread count for the current user
    if (chat.unreadCounts && chat.unreadCounts[currentUserMobile] > 0) {
      const unreadCounts = chat.unreadCounts;
      unreadCounts[currentUserMobile] = 0;
      chat.unreadCounts = unreadCounts;
      await chat.save();
      
      // Mark messages as read in database
      await Message.updateMany(
        { 
          chatId: chat._id, 
          sender: otherUserMobile, 
          receiver: currentUserMobile, 
          read: false 
        },
        { $set: { read: true } }
      );

      // Emit event to notify message was read (only if the other user is connected)
      if (io) {
        io.to(otherUserMobile).emit('messages_read', { 
          chatId: chat._id, 
          reader: currentUserMobile 
        });
      }
    }

    res.json({ 
      messages, 
      chatId: chat._id 
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { receiver, text, chatId } = req.body;
    const sender = req.user.mobile;
    
    // Find or create chat
    let chat;
    
    if (chatId) {
      chat = await Chat.findById(chatId);
      if (!chat) {
        return res.status(404).json({ message: 'Chat not found' });
      }
    } else {
      chat = await Chat.findOne({
        participants: { $all: [sender, receiver] }
      });
      
      if (!chat) {
        // Create a new chat
        chat = new Chat({
          participants: [sender, receiver],
          unreadCounts: {}
        });
        
        await chat.save();
      }
    }
    
    // Create message
    const message = new Message({
      chatId: chat._id,
      sender,
      receiver,
      text,
      timestamp: Date.now()
    });
    
    await message.save();
    
    // Update chat's last message and increment unread count
    chat.lastMessage = message._id;
    chat.updatedAt = Date.now();
    
    // Initialize unreadCounts if not exists
    if (!chat.unreadCounts) {
      chat.unreadCounts = {};
    }
    
    // Increment unread count for receiver
    chat.unreadCounts[receiver] = (chat.unreadCounts[receiver] || 0) + 1;
    
    await chat.save();
    
    // Emit socket event if IO is available
    if (io) {
      // Format message for frontend
      const messageData = {
        _id: message._id,
        chatId: chat._id,
        sender,
        receiver,
        text,
        createdAt: message.timestamp
      };
      
      // Send to receiver
      io.to(receiver).emit('receive_message', messageData);
      
      // Send notification with unread count
      io.to(receiver).emit('new_message_notification', {
        chatId: chat._id,
        sender,
        unreadCount: chat.unreadCounts[receiver],
        lastMessage: {
          _id: message._id,
          text,
          sender,
          createdAt: message.timestamp
        }
      });
    }
    
    res.status(201).json({ 
      message: 'Message sent successfully',
      messageId: message._id,
      chatId: chat._id
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
};