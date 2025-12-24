import { useEffect, useState, useRef } from 'react';

// Mock agent messages for demonstration
// In production, these would come from your actual AI agents
const mockMessages = [
  { agent: 'Kimura', message: 'BTC showing bullish divergence', sentiment: 'positive', time: '14:32' },
  { agent: 'Macro', message: 'Fed signals dovish stance', sentiment: 'positive', time: '14:31' },
  { agent: 'Tekno', message: 'ETH gas fees spiking', sentiment: 'warning', time: '14:30' },
  { agent: 'Sentiment', message: 'Fear index at 28', sentiment: 'neutral', time: '14:29' },
  { agent: 'Kimura', message: 'Support holding at 95k', sentiment: 'positive', time: '14:28' },
  { agent: 'Macro', message: 'DXY weakening further', sentiment: 'positive', time: '14:27' },
  { agent: 'Tekno', message: 'L2 volume increasing', sentiment: 'neutral', time: '14:26' },
  { agent: 'Sentiment', message: 'Whale accumulation detected', sentiment: 'positive', time: '14:25' },
];

const AgentChatScreen = () => {
  const [messages, setMessages] = useState([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const animationFrameRef = useRef();

  // Simulate new messages coming in
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex(prev => (prev + 1) % mockMessages.length);
    }, 3000); // New message every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Update messages array when index changes
  useEffect(() => {
    setMessages(prev => {
      const newMessages = [...prev, mockMessages[currentMessageIndex]];
      // Keep only last 6 messages
      if (newMessages.length > 6) {
        return newMessages.slice(-6);
      }
      return newMessages;
    });
  }, [currentMessageIndex]);

  // Drawing loop
  useEffect(() => {
    const draw = () => {
      // @ts-ignore
      const canvas = window['__screen1LCanvas'];
      // @ts-ignore
      const texture = window['__screen1LTexture'];

      if (!canvas || !texture) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      const t = performance.now() / 1000;

      // Clear canvas with dark background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 256, 512);

      // Draw scan line effect
      const scanlineY = (t * 50) % 512;
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, scanlineY);
      ctx.lineTo(256, scanlineY);
      ctx.stroke();

      // Header
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('⟨ AGENT COMMS ⟩', 10, 20);

      // Draw divider
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, 30);
      ctx.lineTo(246, 30);
      ctx.stroke();

      // Draw messages
      messages.forEach((msg, i) => {
        const y = 50 + (i * 75);
        const isNew = i === messages.length - 1;
        
        // Message fade-in effect for new messages
        const alpha = isNew ? Math.min((t * 2) % 1, 1) : 1;

        // Agent name with color based on sentiment
        const agentColor = {
          positive: '#00ff00',
          negative: '#ff0000',
          warning: '#ffaa00',
          neutral: '#00ffff'
        }[msg.sentiment] || '#ffffff';

        ctx.fillStyle = agentColor;
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`[${msg.agent}]`, 10, y);

        // Time
        ctx.fillStyle = '#666666';
        ctx.font = '10px monospace';
        ctx.fillText(msg.time, 200, y);

        // Message text with word wrap
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha * 0.9;
        ctx.font = '10px monospace';
        
        // Simple word wrap
        const words = msg.message.split(' ');
        let line = '';
        let lineY = y + 15;
        
        words.forEach((word, wordIndex) => {
          const testLine = line + word + ' ';
          const metrics = ctx.measureText(testLine);
          const testWidth = metrics.width;
          
          if (testWidth > 230 && line !== '') {
            ctx.fillText(line, 10, lineY);
            line = word + ' ';
            lineY += 12;
          } else {
            line = testLine;
          }
        });
        ctx.fillText(line, 10, lineY);

        // Sentiment indicator
        ctx.globalAlpha = alpha;
        ctx.fillStyle = agentColor;
        ctx.beginPath();
        ctx.arc(240, y - 5, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
      });

      // Footer with activity indicator
      const pulseAlpha = (Math.sin(t * 3) + 1) / 2;
      ctx.fillStyle = `rgba(0, 255, 0, ${pulseAlpha})`;
      ctx.font = '10px monospace';
      ctx.fillText('● LIVE', 10, 500);

      // Update texture
      texture.needsUpdate = true;

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [messages]);

  return null;
};

export default AgentChatScreen;