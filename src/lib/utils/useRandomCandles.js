import { useState, useEffect } from "react";
import { collection, query, onSnapshot, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useUser } from "@clerk/nextjs";

export function useRandomCandles(maxCandles = 20) {
  const [candles, setCandles] = useState([]);
  const { user, isSignedIn } = useUser();
  
  useEffect(() => {
    // Check if Firebase is properly initialized
    if (!db) {
      // Silently return empty candles when Firebase is not initialized
      // This is expected during server-side rendering
      setCandles([]);
      return;
    }
    
    const fetchCandles = async () => {
      try {
        const allCandles = [];
        
        // First, get user's own items from BOTH collections if logged in
        if (isSignedIn && user?.id) {
          // Get from legacy candles collection
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
          
          // Skip polaroids collection for now (disabled)
          // TODO: Re-enable when polaroids collection is ready
        }
        
        // Calculate how many random candles we need
        const randomCandlesNeeded = Math.max(0, maxCandles - allCandles.length);
        
        if (randomCandlesNeeded > 0) {
          const poolCandles = [];
          
          // Get from legacy candles collection
          const allQuery = query(
            collection(db, "candles"),
            limit(50) // Get a pool of 50 to randomly select from
          );
          
          const allSnapshot = await getDocs(allQuery);
          const legacyCandles = allSnapshot.docs
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
          
          poolCandles.push(...legacyCandles);
          
          // Skip polaroids collection for random pool (disabled)
          // TODO: Re-enable when polaroids collection is ready
          
          // Randomly shuffle and select from combined pool
          const shuffled = poolCandles.sort(() => 0.5 - Math.random());
          const randomSelection = shuffled.slice(0, randomCandlesNeeded);
          
          allCandles.push(...randomSelection);
        }
        
        // Format all candles consistently
        const formattedCandles = allCandles.map(candle => {
          // Handle polaroid data structure
          if (candle.isPolaroid) {
            return {
              id: candle.id,
              userName: candle.username || "Anonymous",
              image: candle.imageUrl, // Polaroids store the snapshot URL in imageUrl
              message: candle.message || "",
              burnedAmount: parseInt(candle.burnedAmount) || 0,
              staked: candle.staked || false,
              likes: candle.likes || 0,
              allowLikes: candle.allowLikes !== false,
              createdAt: candle.createdAt,
              messageType: candle.messageType,
              candleType: candle.candleType || candle.devotionType || 'votive',
              candleHeight: candle.candleHeight || 'medium',
              background: candle.background,
              createdBy: candle.createdBy || candle.username,
              createdByUsername: candle.username,
              isUserCandle: candle.isUserCandle || false,
              isPolaroid: true,
              devotionType: candle.devotionType, // 'candle' or 'tattoo'
              tattooDesign: candle.tattooDesign,
              tattooCharacter: candle.tattooCharacter,
              baseColor: candle.baseColor
            };
          }
          
          // Handle legacy candle data structure
          return {
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
            isUserCandle: candle.isUserCandle || false,
            isPolaroid: false
          };
        });
        
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