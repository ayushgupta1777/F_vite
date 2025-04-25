// ChatPage.jsx - This component shows the individual chat conversation
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../services/socket';

const ChatPage = () => {
  const { mobile } = useParams(); // Get the other user's mobile from URL
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const { user, token } = useAuth();
  const socket = useSocket();
  const messagesEndRef = useRef(null);

  // Fetch messages when component mounts or mobile parameter changes
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await axios.get(`/api/messages/${mobile}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        setMessages(response.data.messages);
        setChatId(response.data.chatId);
        setLoading(false);
        
        // Mark messages as read when chat is opened
        if (socket && response.data.chatId) {
          socket.emit('mark_read', {
            chatId: response.data.chatId,
            sender: mobile
          });
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        setLoading(false);
      }
    };

    fetchMessages();
  }, [mobile, token, socket]);

  // Set up socket listeners for real-time messaging
  useEffect(() => {
    if (socket) {
      // Listen for new messages
      socket.on('receive_message', (data) => {
        // Only add the message if it's from the current chat
        if (data.sender === mobile || data.receiver === mobile) {
          setMessages(prevMessages => [...prevMessages, data]);
          
          // Mark message as read immediately if we're in this chat
          socket.emit('mark_read', {
            chatId: data.chatId,
            sender: mobile
          });
        }
      });

      // Clean up socket listeners
      return () => {
        socket.off('receive_message');
      };
    }
  }, [socket, mobile, chatId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    try {
      // Send message via socket for real-time updates
      if (socket) {
        socket.emit('send_message', {
          receiver: mobile,
          text: newMessage,
          chatId: chatId
        });
      } else {
        // Fallback to API if socket isn't available
        await axios.post('/api/messages', {
          receiver: mobile,
          text: newMessage,
          chatId: chatId
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading conversation...</div>;
  }

  return (
    <div className="chat-page">
      <div className="chat-header">
        <h2>Chat with {mobile}</h2>
      </div>
      
      <div className="messages-container">
        {messages.length === 0 ? (
          <p className="no-messages">No messages yet. Say hello!</p>
        ) : (
          messages.map((message) => (
            <div
              key={message._id}
              className={`message ${message.sender === user.mobile ? 'sent' : 'received'}`}
            >
              <div className="message-bubble">
                <p>{message.text}</p>
                <span className="message-time">
                  {new Date(message.timestamp || message.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="message-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default ChatPage;