import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { db, collection, query, orderBy, limit, onSnapshot } from '@/lib/firebaseClient';

export function AnimatedChatPhoneTexture({ 
  meshRef,
  hoveredOffering = null,
  justLitOffering = null,
  hasActiveClick = false,
  user = null
}) {
  const canvasRef = useRef(document.createElement('canvas'));
  const textureRef = useRef();
  const materialRef = useRef();
  const canvasContextRef = useRef(null);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const messageQueueRef = useRef([]);
  const currentMessageIndexRef = useRef(0);
  const typingAnimationRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const targetScrollRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const messageHeightsRef = useRef({});
  
  // Notification state
  const [notifications, setNotifications] = useState([]);
  const notificationTimeoutRef = useRef(null);
  const notificationImagesRef = useRef({});
  
  // Animation timing
  const TYPING_DURATION = 1500; // Show typing indicator for 1.5s
  const MESSAGE_APPEAR_DELAY = 3500; // Delay between messages
  const SCROLL_SPEED = 0.15; // Smooth scroll speed
  const NOTIFICATION_DURATION = 4000; // Show notification for 4 seconds
  
  // Initialize canvas and texture
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 640;
    canvas.height = 1280;
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.flipY = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = 16;
    textureRef.current = texture;
    
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.FrontSide,
      transparent: false,
      toneMapped: true,
      color: 0xeeeeee,
    });
    materialRef.current = material;
    
    if (meshRef && materialRef.current) {
      meshRef.material = materialRef.current;
    }
    
    return () => {
      if (texture && !texture.disposed) {
        texture.dispose();
      }
      if (material && material.dispose) {
        material.dispose();
      }
    };
  }, [meshRef]);
  
  // Subscribe to Firebase offerings
  useEffect(() => {
    // Start with some example messages for testing
    const exampleMessages = [
      {
        id: 'example-1',
        text: 'Please watch over my family during these difficult times',
        username: 'Maria',
        type: 'petition',
        tokensBurned: '100',
        align: 'left',
        timestamp: new Date(),
        showTyping: true
      },
      {
        id: 'example-2',
        text: 'Thank you for the blessings received today',
        username: 'John',
        type: 'appreciation',
        tokensBurned: '50',
        align: 'right',
        timestamp: new Date(),
        showTyping: true
      },
      {
        id: 'example-3',
        text: 'I seek guidance in my career decisions',
        username: 'Sarah',
        type: 'petition',
        tokensBurned: '75',
        align: 'left',
        timestamp: new Date(),
        showTyping: true
      },
       {
        id: 'example-4',
        text: 'Pump my bags, please 😩',
        username: 'Maria',
        type: 'petition',
        tokensBurned: '100',
        align: 'left',
        timestamp: new Date(),
        showTyping: true
      },
      {
        id: 'example-5',
        text: 'Forgive me all the bad stuff i did',
        username: 'John',
        type: 'appreciation',
        tokensBurned: '50',
        align: 'right',
        timestamp: new Date(),
        showTyping: true
      },
      {
        id: 'example-6',
        text: 'Should i sell now or hodl?',
        username: 'Sarah',
        type: 'petition',
        tokensBurned: '75',
        align: 'left',
        timestamp: new Date(),
        showTyping: true
      },
      {
        id: 'example-7',
        text: 'Please make number go up',
        username: 'Sarah',
        type: 'petition',
        tokensBurned: '75',
        align: 'left',
        timestamp: new Date(),
        showTyping: true
      }
    ];
    
    // Set initial example messages
    setMessages(exampleMessages);
    
    const offeringsRef = collection(db, 'offerings');
    const q = query(
      offeringsRef,
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.message) {
          newMessages.push({
            id: doc.id,
            text: data.message,
            username: data.name || 'Anonymous',
            userImageUrl: data.userImageUrl || null,
            type: data.type || 'petition',
            tokensBurned: data.tokensBurned || '1',
            align: data.prayerFor === 'self' ? 'right' : 'left',
            timestamp: data.createdAt,
            showTyping: true
          });
        }
      });
      
      // If we have real messages, use them instead of examples
      if (newMessages.length > 0) {
        // Reverse to show oldest first (like a real chat)
        setMessages(newMessages.reverse());
      }
    }, (error) => {
      console.error('Error fetching offerings:', error);
      // Keep example messages on error
    });
    
    return () => unsubscribe();
  }, []);
  
  // Process message queue with typing animation
  useEffect(() => {
    if (messages.length === 0) return;
    
    // If this is first load or messages have changed significantly
    if (displayedMessages.length === 0 || messages.length !== messageQueueRef.current.length) {
      messageQueueRef.current = [...messages];
      currentMessageIndexRef.current = 0;
      
      const processNextMessage = () => {
        if (currentMessageIndexRef.current >= messageQueueRef.current.length) {
          return;
        }
        
        const currentMessage = messageQueueRef.current[currentMessageIndexRef.current];
        
        // Show typing indicator
        setDisplayedMessages(prev => [...prev, { ...currentMessage, isTyping: true }]);
        
        // After typing duration, show actual message
        setTimeout(() => {
          setDisplayedMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...currentMessage, isTyping: false };
            return updated;
          });
          
          // Auto-scroll to bottom
          const totalHeight = Object.values(messageHeightsRef.current).reduce((sum, h) => sum + h, 0);
          targetScrollRef.current = Math.max(0, totalHeight - 800);
          
          currentMessageIndexRef.current++;
          
          // Process next message after delay
          setTimeout(processNextMessage, MESSAGE_APPEAR_DELAY);
        }, TYPING_DURATION);
      };
      
      // Start processing immediately
      processNextMessage();
    }
  }, [messages]);
  
  // Draw chat interface
  const drawChatInterface = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvasContextRef.current) {
      canvasContextRef.current = canvas.getContext('2d', { 
        alpha: false,
        desynchronized: false,
        willReadFrequently: false
      });
    }
    const ctx = canvasContextRef.current;
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Save and flip
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);
    
    // Background - lighter chat background
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, width, height);
    
    // Draw status bar
    ctx.fillStyle = '#999';
    ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('9:41', 40, 50);
    ctx.fillText('📶 🔋', width - 110, 50);
    
    // Draw app header background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 70, width, 120);
    
    // Header shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 70, width, 120);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    
    // Back arrow
    ctx.fillStyle = '#fff';
    ctx.font = '36px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('‹', 30, 140);
    
    // Profile circle in header
    ctx.beginPath();
    ctx.arc(90, 130, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#8a2be2';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨', 90, 140);
    ctx.textAlign = 'left';
    
    // Chat name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Our Lady of Perpetual Profit', 130, 125);
    
    // Active status
    ctx.fillStyle = '#00ff66';
    ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('● Active now', 130, 155);
    
    // Three dots menu
    ctx.fillStyle = '#fff';
    ctx.font = '36px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('⋯', width - 70, 140);
    
    // Chat container area - adjusted for new header
    const chatStartY = 200;
    const chatEndY = height - 120; // Leave space for footer
    const chatHeight = chatEndY - chatStartY;
    const padding = 20;
    
    // Save context state before clipping
    ctx.save();
    
    // Create clipping region for chat messages
    ctx.beginPath();
    ctx.rect(0, chatStartY, width, chatHeight);
    ctx.clip();
    
    // Draw messages within clipped area
    let currentY = chatStartY - scrollPositionRef.current + 10; // Small padding from top
    
    displayedMessages.forEach((message, index) => {
      const isRight = message.align === 'right';
      const bubbleMaxWidth = width * 0.7;
      
      // Measure text for bubble size
      ctx.font = '30px -apple-system, BlinkMacSystemFont, sans-serif';
      const words = message.isTyping ? '' : message.text.split(' ');
      const lines = [];
      let currentLine = '';
      
      if (!message.isTyping) {
        for (const word of words) {
          const testLine = currentLine + word + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > bubbleMaxWidth - 40 && currentLine) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine.trim());
      }
      
      const lineHeight = 40;
      const bubbleHeight = message.isTyping ? 60 : (lines.length * lineHeight) + 30;
      const bubbleWidth = message.isTyping ? 100 : Math.min(
        Math.max(...lines.map(line => ctx.measureText(line).width)) + 40,
        bubbleMaxWidth
      );
      
      // Only draw if visible (clipping will handle boundaries)
      if (currentY + bubbleHeight > 0 && currentY < height) {
        // Draw message bubble
        const bubbleX = isRight ? width - bubbleWidth - padding - 20 : padding + 20;
        const bubbleY = currentY;
        
        // Bubble background with better colors
        if (isRight) {
          // Green for sent messages (user's prayers)
          ctx.fillStyle = '#00d757';
        } else {
          // Gray for received messages (others' prayers)
          ctx.fillStyle = '#211fb7ff';
        }
        
        ctx.beginPath();
        ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 18);
        ctx.fill();
        
        // Typing indicator or message text
        if (message.isTyping) {
          // Draw typing dots animation
          const time = Date.now() / 500;
          for (let i = 0; i < 3; i++) {
            const dotAlpha = (Math.sin(time - i * 0.3) + 1) / 2;
            ctx.fillStyle = `rgba(255, 255, 255, ${dotAlpha})`;
            ctx.beginPath();
            ctx.arc(bubbleX + 30 + i * 15, bubbleY + bubbleHeight/2, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Draw message text
          ctx.fillStyle = isRight ? '#000' : '#fff';
          ctx.font = '30px -apple-system, BlinkMacSystemFont, sans-serif';
          lines.forEach((line, lineIndex) => {
            ctx.fillText(line, bubbleX + 20, bubbleY + 25 + lineIndex * lineHeight);
          });
        }
        
        // Small tokens indicator below bubble
        if (!message.isTyping && message.tokensBurned && parseInt(message.tokensBurned) > 10) {
          ctx.fillStyle = '#666';
          ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
          const tokenText = `🔥 ${message.tokensBurned}`;
          const tokenX = isRight ? bubbleX + bubbleWidth - 60 : bubbleX;
          ctx.fillText(tokenText, tokenX, bubbleY + bubbleHeight + 20);
        }
      }
      
      // Store message height for scrolling
      const totalHeight = bubbleHeight + 30;
      messageHeightsRef.current[index] = totalHeight;
      currentY += totalHeight;
    });
    
    // Restore context state (removes clipping)
    ctx.restore();
    
    // Draw header and footer AFTER messages (on top)
    // Re-draw header background to cover any messages that might peek through
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 70, width, 120);
    
    // Re-draw header elements
    ctx.fillStyle = '#fff';
    ctx.font = '36px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('‹', 30, 140);
    
    ctx.beginPath();
    ctx.arc(90, 130, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#8a2be2';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨', 90, 140);
    ctx.textAlign = 'left';
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Our Lady of Perpetual Profit', 130, 125);
    
    ctx.fillStyle = '#00ff66';
    ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('● Active now', 130, 155);
    
    ctx.fillStyle = '#fff';
    ctx.font = '36px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('⋯', width - 70, 140);
    
    // Draw footer background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, chatEndY, width, 120);
    
    // Footer shadow at top
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = -2;
    ctx.fillRect(0, chatEndY, width, 2);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    
    // Draw input field
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.roundRect(80, chatEndY + 25, width - 160, 60, 30);
    ctx.fill();
    
    // Camera button on left
    ctx.fillStyle = '#666';
    ctx.font = '36px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('📷', 25, chatEndY + 60);
    
    // Placeholder text in input
    ctx.fillStyle = '#666';
    ctx.font = '26px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Type a prayer...', 100, chatEndY + 60);
    
    // Send button on right
    ctx.beginPath();
    ctx.arc(width - 50, chatEndY + 55, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#00d757';
    ctx.fill();
    
    // Arrow in send button
    ctx.fillStyle = '#fff';
    ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('↑', width - 50, chatEndY + 63);
    ctx.textAlign = 'left';
    
    // Draw notification popup if active
    if (notifications.length > 0) {
      const notif = notifications[0];
      const elapsed = Date.now() - notif.timestamp;
      
      // Slide and fade animation
      let slideY = 0;
      let opacity = 1;
      
      if (elapsed < 300) {
        // Slide in from top
        slideY = -100 + (elapsed / 300) * 100;
        opacity = elapsed / 300;
      } else if (elapsed > NOTIFICATION_DURATION - 300) {
        // Fade out
        const fadeTime = elapsed - (NOTIFICATION_DURATION - 300);
        opacity = 1 - (fadeTime / 300);
        slideY = 0;
      }
      
      // Notification position
      const notifY = 220 + slideY;
      const notifX = 40;
      const notifWidth = width - 80;
      const notifHeight = 80;
      
      // Draw notification background with shadow
      ctx.save();
      ctx.globalAlpha = opacity;
      
      // Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 5;
      
      // Background gradient
      const notifGradient = ctx.createLinearGradient(notifX, notifY, notifX, notifY + notifHeight);
      notifGradient.addColorStop(0, '#8a2be2');
      notifGradient.addColorStop(1, '#6a1ba2');
      
      ctx.fillStyle = notifGradient;
      ctx.beginPath();
      ctx.roundRect(notifX, notifY, notifWidth, notifHeight, 15);
      ctx.fill();
      
      // Reset shadow
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      
      // Draw user avatar or initial
      const avatarSize = 50;
      const avatarX = notifX + 15;
      const avatarY = notifY + 15;
      
      // Check if we have a loaded image for this notification
      const userImage = notificationImagesRef.current[notif.id];
      
      if (userImage && userImage.complete) {
        // Draw actual user image
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        // Draw the image
        ctx.drawImage(userImage, avatarX, avatarY, avatarSize, avatarSize);
        
        // Add a border
        ctx.restore();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Fallback to initial
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        
        // Draw initial in avatar
        ctx.fillStyle = '#8a2be2';
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initial = notif.username ? notif.username[0].toUpperCase() : '?';
        ctx.fillText(initial, avatarX + avatarSize/2, avatarY + avatarSize/2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
      
      // Draw notification text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`${notif.username}`, avatarX + avatarSize + 15, notifY + 35);
      
      ctx.fillStyle = '#ffeb3b';
      ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('🔥 New Candle Alert!', avatarX + avatarSize + 15, notifY + 58);
      
      // Draw token amount
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`${notif.tokensBurned} RL80`, notifWidth - 80, notifY + 45);
      
      ctx.restore();
    }
    
    // Update texture
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
    
    ctx.restore();
  }, [displayedMessages, hasActiveClick, notifications]);
  
  // Animation loop
  useFrame(() => {
    const now = Date.now();
    
    // Smooth scrolling
    if (Math.abs(targetScrollRef.current - scrollPositionRef.current) > 0.5) {
      scrollPositionRef.current += (targetScrollRef.current - scrollPositionRef.current) * SCROLL_SPEED;
    }
    
    // Redraw every frame for smooth animations
    if (now - lastUpdateTimeRef.current > 16) { // ~60fps
      drawChatInterface();
      lastUpdateTimeRef.current = now;
    }
  });
  
  // Handle new offerings (justLitOffering) - show notification IMMEDIATELY
  useEffect(() => {
    if (justLitOffering) {
      const notifId = `notif-${Date.now()}`;
      
      // Create notification with NO DELAY
      const newNotification = {
        id: notifId,
        username: justLitOffering.name || justLitOffering.recipientName || user?.firstName || 'Anonymous',
        userImage: justLitOffering.userImageUrl || justLitOffering.userImage || null,
        tokensBurned: justLitOffering.tokensBurned || '1',
        message: justLitOffering.message || 'Lit a candle',
        timestamp: Date.now()
      };
      
      // Load user image if provided (but don't wait for it)
      if (newNotification.userImage) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          notificationImagesRef.current[notifId] = img;
          // Force a redraw when image loads
          if (textureRef.current) {
            textureRef.current.needsUpdate = true;
          }
        };
        img.onerror = () => {
          console.error('Failed to load notification image:', newNotification.userImage);
        };
        img.src = newNotification.userImage;
      }
      
      // Set notification IMMEDIATELY
      setNotifications([newNotification]);
      
      // Clear notification after duration
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      notificationTimeoutRef.current = setTimeout(() => {
        setNotifications([]);
        // Clean up image
        delete notificationImagesRef.current[notifId];
      }, NOTIFICATION_DURATION);
      
      // Also add as a message if it has text
      if (justLitOffering.message) {
        // Add message immediately to the queue
        const newMessage = {
          id: `just-lit-${Date.now()}`,
          text: justLitOffering.message,
          username: justLitOffering.name || user?.firstName || 'You',
          type: justLitOffering.type || 'petition',
          tokensBurned: justLitOffering.tokensBurned || '1',
          align: 'right',
          timestamp: new Date(),
          showTyping: false,
          isSpecial: true
        };
        
        // Add to displayed messages immediately
        setDisplayedMessages(prev => [...prev, newMessage]);
        
        // Auto-scroll to bottom
        requestAnimationFrame(() => {
          const totalHeight = Object.values(messageHeightsRef.current).reduce((sum, h) => sum + h, 0);
          targetScrollRef.current = Math.max(0, totalHeight - 800);
        });
      }
    }
  }, [justLitOffering, user]);
  
  return null;
}