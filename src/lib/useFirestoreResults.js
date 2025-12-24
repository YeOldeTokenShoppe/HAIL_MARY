import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "./firebaseClient";

export function useFirestoreResults(collectionName = "results", sortBy = "burnedAmount") {
  const [results, setResults] = useState([]);

  useEffect(() => {
    // Create query based on sort option
    let q;
    if (sortBy === "mostLiked") {
      // Sort by most liked (likes descending)
      q = query(collection(db, collectionName), orderBy("likes", "desc"), limit(80));
    } else if (sortBy === "newest") {
      // Sort by newest (createdAt descending)
      q = query(collection(db, collectionName), orderBy("createdAt", "desc"), limit(80));
    } else if (sortBy === "smallest") {
      // Sort by smallest burnedAmount (ascending) for NOBIL80
      q = query(collection(db, collectionName), orderBy("burnedAmount", "asc"), limit(80));
    } else {
      // Default: Sort by burnedAmount (top 80 for Illumin80)
      q = query(collection(db, collectionName), orderBy("burnedAmount", "desc"), limit(80));
    }
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedResults = querySnapshot.docs.map((doc) => ({
        id: doc.id, // 🔍 Check this format
        userName: doc.data().username || "Anonymous",
        image: doc.data().image,
        message: doc.data().message,
        burnedAmount: doc.data().burnedAmount || 1,
        staked: doc.data().staked || false,
        likes: doc.data().likes || 0, // Include likes count
        allowLikes: doc.data().allowLikes !== false, // Default true for backward compatibility
        createdAt: doc.data().createdAt?.toDate() || new Date(), // Include createdAt timestamp
        // Include new candle fields
        messageType: doc.data().messageType,
        candleType: doc.data().candleType,
        candleHeight: doc.data().candleHeight,
        background: doc.data().background,
        createdBy: doc.data().createdBy,
        createdByUsername: doc.data().createdByUsername,
      }));

      // console.log("🔥 Firestore results fetched:", fetchedResults); // ✅ Log results

      setResults((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(fetchedResults))
          return prev;
        return fetchedResults;
      });
    });

    return () => unsubscribe();
  }, [collectionName, sortBy]);

  return results;
}
