import { useState, useEffect } from "react";
import { 
  db, 
  collection, 
  query, 
  onSnapshot, 
  where, 
  getDocs, 
  limit 
} from "./firebaseClient";
import { useUser } from "@clerk/nextjs";

export function useRandomCandles(maxCandles = 20) {
  const [candles, setCandles] = useState([]);
  const { user, isSignedIn } = useUser();
  
  useEffect(() => {
    if (!db) return;
    
    const fetchCandles = async () => {
      try {
        const allCandles = [];
        
        // First, get user's own candles if logged in
        if (isSignedIn && user?.id) {
          const userQuery = query(
            collection(db, "candles"),
            where("createdBy", "==", user.id),
            limit(10) // Limit user's own candles to 10
          );
          
          const userSnapshot = await getDocs(userQuery);
          const userCandles = userSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            isUserCandle: true,
            createdAt: doc.data().createdAt?.toDate() || new Date()
          }));
          
          allCandles.push(...userCandles);
        }
        
        // Calculate how many random candles we need
        const randomCandlesNeeded = Math.max(0, maxCandles - allCandles.length);
        
        if (randomCandlesNeeded > 0) {
          // Get all candles (we'll randomly select from these)
          const allQuery = query(
            collection(db, "candles"),
            limit(100) // Get a pool of 100 to randomly select from
          );
          
          const allSnapshot = await getDocs(allQuery);
          const poolCandles = allSnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              isUserCandle: false,
              createdAt: doc.data().createdAt?.toDate() || new Date()
            }))
            .filter(candle => 
              // Filter out user's candles from the pool
              !isSignedIn || !user?.id || candle.createdBy !== user.id
            );
          
          // Randomly shuffle and select
          const shuffled = poolCandles.sort(() => 0.5 - Math.random());
          const randomSelection = shuffled.slice(0, randomCandlesNeeded);
          
          allCandles.push(...randomSelection);
        }
        
        // Format all candles consistently
        const formattedCandles = allCandles.map(candle => ({
          id: candle.id,
          userName: candle.username || candle.userName || "Anonymous",
          image: candle.image,
          message: candle.message,
          burnedAmount: candle.burnedAmount || 1,
          staked: candle.staked || false,
          likes: candle.likes || 0,
          allowLikes: candle.allowLikes !== false,
          createdAt: candle.createdAt,
          messageType: candle.messageType,
          candleType: candle.candleType || 'votive',
          candleHeight: candle.candleHeight || 'medium',
          background: candle.background,
          createdBy: candle.createdBy,
          createdByUsername: candle.createdByUsername,
          isUserCandle: candle.isUserCandle || false
        }));
        
        setCandles(formattedCandles);
      } catch (error) {
        console.error("Error fetching random candles:", error);
        setCandles([]);
      }
    };
    
    fetchCandles();
    
    // Refresh every 5 minutes to get new random selection
    const interval = setInterval(fetchCandles, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isSignedIn, user?.id, maxCandles]);
  
  return candles;
}