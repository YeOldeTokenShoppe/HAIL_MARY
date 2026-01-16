import { useEffect, useState } from 'react';
import { db, doc, onSnapshot } from '@/lib/firebaseClient';

const LighterBalanceWidget = ({ show = true }) => {
  const [balance, setBalance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    if (!db || !show) return;

    // Listen for real-time balance updates from Lighter service
    const accountRef = doc(db, 'lighterData', 'account');
    
    const unsubscribe = onSnapshot(accountRef, (doc) => {
      console.log('🔍 Balance Widget - Firebase snapshot:', doc.exists(), doc.exists() ? doc.data() : 'No data');
      if (doc.exists()) {
        const data = doc.data();
        console.log('💰 Balance loaded:', data.balance);
        setBalance(data.balance);
        setLastUpdate(data.lastUpdate);
        setIsLoading(false);
      } else {
        console.log('⚠️ No lighterData/account document found');
        setIsLoading(false);
      }
    }, (error) => {
      console.error('❌ Error loading balance:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, show]);

  // Force show for debugging
  if (!show) return null;
  
  console.log('🔍 Balance Widget render:', { show, isLoading, balance, hasDb: !!db });

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 1000,
      background: 'rgba(147, 51, 234, 0.15)',
      backdropFilter: 'blur(15px)',
      WebkitBackdropFilter: 'blur(15px)',
      border: '1px solid rgba(147, 51, 234, 0.4)',
      borderRadius: '12px',
      padding: '12px 16px',
      boxShadow: '0 4px 20px rgba(147, 51, 234, 0.2)',
      minWidth: '180px',
      fontFamily: 'monospace'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '4px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: balance !== null ? '#00ff00' : '#666',
          boxShadow: balance !== null ? '0 0 8px rgba(0, 255, 0, 0.6)' : 'none',
          animation: balance !== null ? 'pulse 2s infinite' : 'none'
        }} />
        <div style={{
          color: '#9333ea',
          fontSize: '11px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Testnet Balance
        </div>
      </div>
      
      <div style={{
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: '2px',
        textShadow: '0 0 10px rgba(147, 51, 234, 0.5)'
      }}>
        {balance !== null ? (
          `$${balance.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}`
        ) : (
          'Connecting...'
        )}
      </div>
      
      {lastUpdate && (
        <div style={{
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '9px'
        }}>
          Updated {new Date(lastUpdate).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default LighterBalanceWidget;