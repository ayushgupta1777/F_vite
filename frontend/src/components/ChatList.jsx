
// ChatList.jsx - This component shows the list of chats on the home page
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../services/socket';

const ChatList = () => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, token } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch all chats for the current user
    const fetchChats = async () => {
      try {
        const response = await axios.get('/api/users/chats/all', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setChats(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching chats:', error);
        setLoading(false);
      }
    };

    fetchChats();

    // Listen for new message notifications
    if (socket) {
      socket.on('new_message_notification', (data) => {
        setChats(prevChats => {
          return prevChats.map(chat => {
            if (chat._id === data.chatId) {
              // Update the unread count for this chat
              return { 
                ...chat, 
                unreadCount: data.unreadCount,
                // If we received the lastMessage data, update it as well
                lastMessage: data.lastMessage ? data.lastMessage : chat.lastMessage
              };
            }
            return chat;
          });
        });
      });

      // Listen for when messages are marked as read
      socket.on('messages_read', (data) => {
        setChats(prevChats => {
          return prevChats.map(chat => {
            if (chat._id === data.chatId) {
              // Clear the unread count for this chat
              return { ...chat, unreadCount: 0 };
            }
            return chat;
          });
        });
      });
    }

    return () => {
      if (socket) {
        socket.off('new_message_notification');
        socket.off('messages_read');
      }
    };
  }, [socket, token]);

  const handleChatClick = (chat) => {
    // Get the other participant's mobile number
    const otherParticipantMobile = chat.participants.find(
      p => p.mobile !== user.mobile
    ).mobile;
    
    // Navigate to the chat page
    navigate(`/chat/${otherParticipantMobile}`);
  };

  if (loading) {
    return <div className="loading">Loading chats...</div>;
  }

  return (
    <div className="chat-list">
      <h2>Your Conversations</h2>
      {chats.length === 0 ? (
        <p>No conversations yet. Start chatting!</p>
      ) : (
        chats.map(chat => {
          const otherParticipant = chat.participants.find(
            p => p.mobile !== user.mobile
          );
          
          return (
            <div 
              key={chat._id} 
              className="chat-item" 
              onClick={() => handleChatClick(chat)}
            >
              <div className="chat-avatar">
                {otherParticipant.profilePicture ? (
                  <img src={otherParticipant.profilePicture} alt="Profile" />
                ) : (
                  <div className="default-avatar">
                    {otherParticipant.mobile.substring(0, 2)}
                  </div>
                )}
              </div>
              <div className="chat-info">
                <h3>{otherParticipant.mobile}</h3>
                <p className="last-message">
                  {chat.lastMessage ? chat.lastMessage.text : 'No messages yet'}
                </p>
              </div>
              {/* Display unread count badge if there are unread messages */}
              {chat.unreadCount > 0 && (
                <div className="unread-badge">
                  {chat.unreadCount}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default ChatList;