#!/usr/bin/env python3
"""
RL80 Trading Agent - Autonomous trading agent for Lighter DEX
Executes trades based on analysis and market conditions
"""

import lighter
import time
import os
import logging
import json
import requests
from datetime import datetime
from typing import Dict, Any, Optional

# Firebase Admin SDK for Firestore
import firebase_admin
from firebase_admin import credentials, firestore

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('RL80')

class RL80Agent:
    def __init__(self):
        """Initialize the RL80 trading agent"""
        # Load environment variables
        self.api_private_key = os.environ.get("LIGHTER_API_KEY")
        self.account_index = int(os.environ.get("LIGHTER_ACCOUNT_INDEX", "227"))

        if not self.api_private_key:
            raise ValueError("LIGHTER_API_KEY environment variable is required")

        # Initialize Firebase Admin SDK for Firestore
        self.db = None
        self._init_firestore()
        
        # Initialize Lighter client
        self.client = lighter.SignerClient(
            url="https://testnet.zklighter.elliot.ai",
            api_private_keys={3: self.api_private_key},
            account_index=self.account_index
        )

        # Market configuration
        self.markets = {
            "ETH": {"market_id": 1, "name": "ETH-USD"},
            "BTC": {"market_id": 2, "name": "BTC-USD"}, 
            "SOL": {"market_id": 3, "name": "SOL-USD"}
        }
        
        # Trading parameters
        self.min_trade_amount = 1000000  # Minimum trade size in base units
        self.max_position_size = 10000000  # Max position size
        self.tick_interval = 60  # Run every 60 seconds
        
        # Order tracking
        self.client_order_index = 1
        self.active_orders = {}
        
        logger.info(f"RL80 Agent initialized for account {self.account_index}")

    def _init_firestore(self):
        """Initialize Firebase Admin SDK for Firestore"""
        try:
            # Check if already initialized
            if firebase_admin._apps:
                self.db = firestore.client()
                logger.info("Firestore client reused from existing app")
                return

            # Try service account file first
            service_account_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            if service_account_path and os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred)
                self.db = firestore.client()
                logger.info("Firestore initialized with service account file")
                return

            # Try service account JSON from env var
            service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
            if service_account_json:
                service_account_info = json.loads(service_account_json)
                cred = credentials.Certificate(service_account_info)
                firebase_admin.initialize_app(cred)
                self.db = firestore.client()
                logger.info("Firestore initialized with service account JSON")
                return

            # Try individual env vars (Railway-style)
            project_id = os.environ.get("FIREBASE_PROJECT_ID")
            private_key_base64 = os.environ.get("FIREBASE_PRIVATE_KEY_BASE64")
            client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")

            if project_id and private_key_base64 and client_email:
                import base64
                private_key = base64.b64decode(private_key_base64).decode('utf-8')
                service_account_info = {
                    "type": "service_account",
                    "project_id": project_id,
                    "private_key": private_key,
                    "client_email": client_email,
                    "token_uri": "https://oauth2.googleapis.com/token"
                }
                cred = credentials.Certificate(service_account_info)
                firebase_admin.initialize_app(cred)
                self.db = firestore.client()
                logger.info("Firestore initialized with individual env vars")
                return

            logger.warning("No Firebase credentials found - Firestore disabled")

        except Exception as e:
            logger.error(f"Failed to initialize Firestore: {e}")
            self.db = None

    def get_next_order_id(self) -> int:
        """Get the next unique order ID"""
        order_id = self.client_order_index
        self.client_order_index += 1
        return order_id
    
    def get_account_status(self) -> Dict[str, Any]:
        """Get current account balance and positions"""
        try:
            # This would use Lighter SDK methods when available
            # For now, using the API directly
            response = requests.get(
                f"https://testnet.zklighter.elliot.ai/api/v1/account?by=index&value={self.account_index}"
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"Failed to get account status: {response.status_code}")
                return {}
                
        except Exception as e:
            logger.error(f"Error getting account status: {e}")
            return {}
    
    def get_market_data(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get current market data for a symbol"""
        try:
            # Get current price and market conditions
            # This is a placeholder - you'd implement actual market data fetching
            response = requests.get(
                f"https://testnet.zklighter.elliot.ai/api/v1/markets/{symbol}"
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"Failed to get market data for {symbol}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting market data for {symbol}: {e}")
            return None
    
    def get_firebase_trading_signal(self) -> Dict[str, Any]:
        """
        Get the latest trading signal from the JS RL80 agent via Firestore
        """
        if not self.db:
            logger.warning("Firestore not initialized, using fallback analysis")
            return self.fallback_analysis()

        try:
            # Get the latest RL80 decision from Firestore
            doc_ref = self.db.collection('agentDecisions').document('RL80')
            doc = doc_ref.get()

            if doc.exists:
                decision = doc.to_dict()
                # Check if decision is recent (within last 2 hours)
                decision_time = decision.get('timestamp', 0)
                age_seconds = (datetime.now().timestamp() * 1000 - decision_time) / 1000

                if age_seconds < 7200:  # 2 hours
                    logger.info(f"Received RL80 decision from Firestore: {decision.get('action', 'HOLD')} (age: {age_seconds/60:.1f}min)")
                    return {
                        "timestamp": datetime.now().isoformat(),
                        "action": decision.get('action', 'HOLD'),
                        "confidence": decision.get('confidence', 0.5),
                        "reasoning": decision.get('reasoning', ''),
                        "symbol": decision.get('symbol', 'ETH'),
                        "size": decision.get('position_size', self.min_trade_amount),
                        "source": "firestore_rl80_js"
                    }
                else:
                    logger.info(f"RL80 decision is stale ({age_seconds/60:.1f}min old), using fallback")

            logger.info("No recent RL80 decision found in Firestore, using fallback")
            return self.fallback_analysis()

        except Exception as e:
            logger.error(f"Error fetching Firestore decision: {e}")
            return self.fallback_analysis()
    
    def fallback_analysis(self) -> Dict[str, Any]:
        """
        Fallback analysis when Firebase RL80 decisions aren't available
        Based on the JS RL80 decision framework
        """
        try:
            # Get current market conditions
            account_status = self.get_account_status()
            
            # Simple fallback logic inspired by JS RL80
            signals = {
                "timestamp": datetime.now().isoformat(),
                "action": "HOLD",
                "confidence": 0.3,  # Lower confidence for fallback
                "reasoning": "Fallback analysis - waiting for JS RL80 signal",
                "symbol": "ETH",
                "size": self.min_trade_amount,
                "source": "python_fallback"
            }
            
            # Very conservative fallback - only trade with strong signals
            # This ensures we don't interfere with the main JS RL80 logic
            
            return signals
            
        except Exception as e:
            logger.error(f"Error in fallback analysis: {e}")
            return {
                "timestamp": datetime.now().isoformat(),
                "error": str(e),
                "action": "HOLD",
                "confidence": 0.0,
                "source": "error_fallback"
            }
    
    def analyze_market_conditions(self) -> Dict[str, Any]:
        """
        Get trading signals - primarily from JS RL80 via Firebase
        """
        return self.get_firebase_trading_signal()
    
    def execute_market_buy(self, symbol: str, amount: int) -> bool:
        """Execute a market buy order"""
        try:
            market_info = self.markets.get(symbol)
            if not market_info:
                logger.error(f"Unknown market symbol: {symbol}")
                return False
            
            order_id = self.get_next_order_id()
            
            logger.info(f"Executing market BUY: {symbol} amount={amount} order_id={order_id}")
            
            result = self.client.create_market_order(
                market_id=market_info["market_id"],
                is_ask=False,  # False = buy
                base_amount=amount,
                client_order_index=order_id
            )
            
            # Track the order
            self.active_orders[order_id] = {
                "symbol": symbol,
                "side": "BUY",
                "amount": amount,
                "type": "MARKET",
                "timestamp": datetime.now().isoformat(),
                "result": result
            }
            
            logger.info(f"Market buy order placed successfully: {order_id}")
            self.log_trade_to_firebase(self.active_orders[order_id])
            
            return True
            
        except Exception as e:
            logger.error(f"Error executing market buy: {e}")
            return False
    
    def execute_market_sell(self, symbol: str, amount: int) -> bool:
        """Execute a market sell order"""
        try:
            market_info = self.markets.get(symbol)
            if not market_info:
                logger.error(f"Unknown market symbol: {symbol}")
                return False
            
            order_id = self.get_next_order_id()
            
            logger.info(f"Executing market SELL: {symbol} amount={amount} order_id={order_id}")
            
            result = self.client.create_market_order(
                market_id=market_info["market_id"],
                is_ask=True,  # True = sell
                base_amount=amount,
                client_order_index=order_id
            )
            
            # Track the order
            self.active_orders[order_id] = {
                "symbol": symbol,
                "side": "SELL",
                "amount": amount,
                "type": "MARKET",
                "timestamp": datetime.now().isoformat(),
                "result": result
            }
            
            logger.info(f"Market sell order placed successfully: {order_id}")
            self.log_trade_to_firebase(self.active_orders[order_id])
            
            return True
            
        except Exception as e:
            logger.error(f"Error executing market sell: {e}")
            return False
    
    def execute_limit_order(self, symbol: str, amount: int, price: int, is_sell: bool = False) -> bool:
        """Execute a limit order"""
        try:
            market_info = self.markets.get(symbol)
            if not market_info:
                logger.error(f"Unknown market symbol: {symbol}")
                return False
            
            order_id = self.get_next_order_id()
            side = "SELL" if is_sell else "BUY"
            
            logger.info(f"Executing limit {side}: {symbol} amount={amount} price={price} order_id={order_id}")
            
            result = self.client.create_order(
                market_id=market_info["market_id"],
                is_ask=is_sell,
                base_amount=amount,
                price=price,
                order_type="ORDER_TYPE_LIMIT",
                time_in_force="ORDER_TIME_IN_FORCE_GOOD_TILL_TIME",
                client_order_index=order_id
            )
            
            # Track the order
            self.active_orders[order_id] = {
                "symbol": symbol,
                "side": side,
                "amount": amount,
                "price": price,
                "type": "LIMIT",
                "timestamp": datetime.now().isoformat(),
                "result": result
            }
            
            logger.info(f"Limit order placed successfully: {order_id}")
            self.log_trade_to_firebase(self.active_orders[order_id])
            
            return True
            
        except Exception as e:
            logger.error(f"Error executing limit order: {e}")
            return False
    
    def cancel_order(self, order_id: int) -> bool:
        """Cancel an existing order"""
        try:
            if order_id not in self.active_orders:
                logger.warning(f"Order {order_id} not found in active orders")
                return False
            
            order = self.active_orders[order_id]
            market_info = self.markets.get(order["symbol"])
            
            logger.info(f"Cancelling order {order_id}")
            
            result = self.client.create_cancel_order(
                market_id=market_info["market_id"],
                order_index=order_id
            )
            
            # Update order status
            order["cancelled"] = True
            order["cancel_timestamp"] = datetime.now().isoformat()
            order["cancel_result"] = result
            
            logger.info(f"Order {order_id} cancelled successfully")
            
            return True
            
        except Exception as e:
            logger.error(f"Error cancelling order {order_id}: {e}")
            return False
    
    def log_trade_to_firebase(self, trade_data: Dict[str, Any]) -> None:
        """Log trade data to Firestore for dashboard display"""
        if not self.db:
            return

        try:
            # Log to Firestore trades collection
            trade_doc = {
                "agentId": "RL80",
                "timestamp": trade_data["timestamp"],
                "symbol": trade_data["symbol"],
                "side": trade_data["side"],
                "amount": trade_data["amount"],
                "type": trade_data["type"],
                "status": "EXECUTED",
                "clientOrderId": trade_data.get("order_id"),
                "createdAt": firestore.SERVER_TIMESTAMP
            }

            if "price" in trade_data:
                trade_doc["price"] = trade_data["price"]

            # Add to Firestore trades collection
            self.db.collection('trades').add(trade_doc)
            logger.info("Trade logged to Firestore successfully")

        except Exception as e:
            logger.error(f"Error logging trade to Firestore: {e}")
    
    def update_agent_status(self, status: str, details: Dict[str, Any] = None) -> None:
        """Update agent status in Firestore"""
        if not self.db:
            return

        try:
            status_data = {
                "agentId": "RL80",
                "status": status,
                "timestamp": datetime.now().isoformat(),
                "accountIndex": self.account_index,
                "updatedAt": firestore.SERVER_TIMESTAMP
            }

            if details:
                status_data.update(details)

            # Update in Firestore
            self.db.collection('agentStatus').document('RL80').set(status_data, merge=True)
            logger.debug("Agent status updated in Firestore")

        except Exception as e:
            logger.error(f"Error updating agent status: {e}")
    
    def trading_tick(self) -> None:
        """Execute one trading cycle"""
        try:
            logger.info("🤖 RL80 Trading Tick Starting...")
            
            # Update status
            self.update_agent_status("ANALYZING")
            
            # Get account status
            account_status = self.get_account_status()
            
            # Analyze market conditions
            analysis = self.analyze_market_conditions()
            
            logger.info(f"Analysis result: {analysis['action']} (confidence: {analysis['confidence']})")
            
            # Execute trading logic based on analysis
            action = analysis.get("action", "HOLD")
            confidence = analysis.get("confidence", 0.0)
            symbol = analysis.get("symbol", "ETH")
            trade_size = analysis.get("size", self.min_trade_amount)
            source = analysis.get("source", "unknown")
            
            # Only execute trades with sufficient confidence (lowered to enable trading)
            min_confidence = 0.5 if source == "firestore_rl80_js" else 0.7
            
            if action == "BUY" and confidence >= min_confidence:
                logger.info(f"🚀 {source.upper()}: High confidence BUY signal detected (confidence: {confidence})")
                success = self.execute_market_buy(symbol, trade_size)
                
                if success:
                    self.update_agent_status("TRADE_EXECUTED", {
                        "action": "BUY",
                        "symbol": symbol,
                        "confidence": confidence,
                        "source": source,
                        "analysis": analysis
                    })
            
            elif action == "SELL" and confidence >= min_confidence:
                logger.info(f"📉 {source.upper()}: High confidence SELL signal detected (confidence: {confidence})")
                success = self.execute_market_sell(symbol, trade_size)
                
                if success:
                    self.update_agent_status("TRADE_EXECUTED", {
                        "action": "SELL", 
                        "symbol": symbol,
                        "confidence": confidence,
                        "source": source,
                        "analysis": analysis
                    })
            
            else:
                reason = f"No action: {action} (conf: {confidence:.2f}, min: {min_confidence:.2f})"
                logger.info(f"💤 {reason}")
                self.update_agent_status("MONITORING", {
                    "analysis": analysis,
                    "reason": reason
                })
            
            logger.info("✅ RL80 Trading Tick Complete")
            
        except Exception as e:
            logger.error(f"Error in trading tick: {e}")
            self.update_agent_status("ERROR", {"error": str(e)})
    
    def run(self) -> None:
        """Main trading loop"""
        logger.info("🚀 RL80 Trading Agent Starting...")
        
        self.update_agent_status("STARTING")
        
        # Verify connection
        try:
            account_status = self.get_account_status()
            logger.info(f"Connected to account {self.account_index}")
            self.update_agent_status("ACTIVE")
            
        except Exception as e:
            logger.error(f"Failed to connect: {e}")
            self.update_agent_status("ERROR", {"error": str(e)})
            return
        
        # Main trading loop
        while True:
            try:
                self.trading_tick()
                
                # Wait for next tick
                logger.info(f"💤 Sleeping for {self.tick_interval} seconds...")
                time.sleep(self.tick_interval)
                
            except KeyboardInterrupt:
                logger.info("🛑 Received interrupt signal, shutting down...")
                self.update_agent_status("STOPPED")
                break
                
            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}")
                self.update_agent_status("ERROR", {"error": str(e)})
                # Sleep before retry
                time.sleep(30)

if __name__ == "__main__":
    import asyncio

    async def main():
        try:
            agent = RL80Agent()
            agent.run()
        except Exception as e:
            logger.error(f"Failed to start RL80 agent: {e}")
            exit(1)

    # Run with event loop
    asyncio.run(main())