import React, { useEffect, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import RL80TraderCard from './RL80TraderCard';
import './FocusedAgentCard.css';

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let db;
try {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  db = getFirestore(app);
} catch (error) {
  console.error('Firebase initialization failed:', error);
}

const FocusedAgentCard = ({ agentId, onClose }) => {
  const [agentData, setAgentData] = useState(null);
  const [latestThesis, setLatestThesis] = useState(null);
  const [latestScores, setLatestScores] = useState(null);
  const [latestDecision, setLatestDecision] = useState(null);

  // Map display names to Firestore agent names
  const agentNameMap = {
    'RL80': 'RL80',
    'Emo': 'EMO',
    'Macro': 'MACRO',
    'Tekno': 'TEKNO'
  };

  // Agent data - only the 4 main trading agents
  const agentsDatabase = {
    'RL80': {
      name: 'RL80',
      description: 'Analyzing perpetual contracts. Strong bullish signal detected on ETH/USD. Executing long position with 3x leverage.'
    },
    'Emo': {
      name: 'Emo',
      description: 'Market sentiment shifting to extreme greed. Social media mentions up 450%. Recommending defensive positioning.'
    },
    'Macro': {
      name: 'Macro',
      description: 'Fed pivot indicators strengthening. DXY showing weakness. Favorable conditions for risk-on assets detected.'
    },
    'Tekno': {
      name: 'Tekno',
      description: 'BTC forming ascending triangle on 4H. RSI divergence confirmed. Target: $52,000. Stop loss: $47,200.'
    }
  };

  useEffect(() => {
    if (agentId && agentsDatabase[agentId]) {
      setAgentData(agentsDatabase[agentId]);
    } else {
      setAgentData(null);
    }
  }, [agentId]);

  // Subscribe to latest chat message (thesis) for this agent
  useEffect(() => {
    if (!db || !agentId) return;

    const firestoreAgentName = agentNameMap[agentId] || agentId;

    const q = query(
      collection(db, 'agentChat'),
      where('agent', '==', firestoreAgentName),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const latestMessage = snapshot.docs[0].data();
        setLatestThesis(latestMessage.message);
      }
    }, (error) => {
      console.error('Error fetching latest thesis:', error);
    });

    return () => unsubscribe();
  }, [agentId]);

  // Subscribe to latest scores for this agent
  useEffect(() => {
    if (!db || !agentId) return;

    const firestoreAgentName = agentNameMap[agentId] || agentId;

    const q = query(
      collection(db, 'agentScores'),
      where('agentId', '==', firestoreAgentName),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const scoreData = snapshot.docs[0].data();
        // Convert scores array to object keyed by asset
        if (scoreData.scores) {
          const scoresObj = {};
          scoreData.scores.forEach(score => {
            scoresObj[score.asset] = {
              direction: score.direction,
              confidence: score.confidence
            };
          });
          setLatestScores(scoresObj);
        }
      }
    }, (error) => {
      console.error('Error fetching latest scores:', error);
    });

    return () => unsubscribe();
  }, [agentId]);

  // Subscribe to latest RL80 decision (only for RL80)
  useEffect(() => {
    if (!db || agentId !== 'RL80') return;

    const unsubscribe = onSnapshot(
      doc(db, 'agentDecisions', 'RL80'),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const decision = docSnapshot.data();
          setLatestDecision({
            recommendations: decision.recommendations || [],
            summary: decision.summary || {}
          });
        }
      },
      (error) => {
        console.error('Error fetching latest decision:', error);
      }
    );

    return () => unsubscribe();
  }, [agentId]);

  if (!agentData) return null;

  return (
    <RL80TraderCard
      agentData={agentData}
      onClose={onClose}
      className="focused-card"
      latestScores={latestScores}
      latestDecision={latestDecision}
      latestThesis={latestThesis}
    />
  );
};

export default FocusedAgentCard;
