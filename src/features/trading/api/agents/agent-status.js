// API endpoint to check agent status
import { getAgentStatus, printAgentStatus } from '../../agents/configs/agent-config';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get the current status
  const status = getAgentStatus();
  
  // Also log to server console for debugging
  printAgentStatus();
  
  return res.status(200).json(status);
}