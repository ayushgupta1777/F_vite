import { io } from 'socket.io-client';

let socket;
// SocketContext.jsx
// import React, { createContext, useContext, useEffect, useState } from 'react';
// import { useAuth } from '../context/AuthContext';

// const SocketContext = createContext();

// export const SocketProvider = ({ children }) => {
//   const [socket, setSocket] = useState(null);
//   const { token, isAuthenticated } = useAuth();
  
//   useEffect(() => {
//     if (isAuthenticated && token) {
//       // Connect to the socket server
//       const newSocket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000', {
//         auth: { token }
//       });
      
//       setSocket(newSocket);
      
//       // Clean up on unmount
//       return () => {
//         newSocket.disconnect();
//       };
//     }
//   }, [isAuthenticated, token]);
  
//   return (
//     <SocketContext.Provider value={socket}>
//       {children}
//     </SocketContext.Provider>
//   );
// };

export const useSocket = () => {
  return useContext(SocketContext);
};

export const initSocket = (token) => {
  if (socket) {
    // If socket exists and is connected, return it
    if (socket.connected) {
      return socket;
    }
    // Otherwise disconnect to create a new one
    socket.disconnect();
  }
  
  console.log("Initializing socket with token:", token ? "Token exists" : "No token");
  
  socket = io('http://localhost:5000', {
    auth: {
      token
    },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });
  
  // Add error handlers
  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });
  
  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
  
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });
  
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('token');
    if (token) {
      return initSocket(token);
    }
    throw new Error('Socket not initialized');
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};