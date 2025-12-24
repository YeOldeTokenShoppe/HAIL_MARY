// API route to help set up Lighter API keys
import { setupLighterApiKey, saveApiKeyConfig } from '../../lighter/setup-api-key';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { ethPrivateKey, baseUrl, apiKeyIndex, seed } = req.body;
  
  if (!ethPrivateKey) {
    return res.status(400).json({ error: 'ETH private key is required' });
  }
  
  try {
    const result = await setupLighterApiKey({
      baseUrl: baseUrl || 'https://testnet.zklighter.elliot.ai',
      ethPrivateKey,
      apiKeyIndex: apiKeyIndex || 3,
      seed
    });
    
    if (result.success) {
      // Generate the env content
      const envContent = saveApiKeyConfig(result.config);
      
      return res.status(200).json({
        success: true,
        message: result.message,
        config: result.config,
        envContent
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error setting up API key:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}