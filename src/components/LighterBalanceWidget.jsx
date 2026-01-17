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
      top: '100px',
      right: '20px',
      zIndex: 10000,
      background: balance !== null ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
      backdropFilter: 'blur(15px)',
      WebkitBackdropFilter: 'blur(15px)',
      border: `3px solid ${balance !== null ? '#00ff00' : '#ff0000'}`,
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: balance !== null ? 
        '0 4px 30px rgba(0, 255, 0, 0.5)' : 
        '0 4px 30px rgba(255, 0, 0, 0.5)',
      minWidth: '220px',
      fontFamily: 'monospace',
      animation: 'pulse 2s infinite'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px'
      }}>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: balance !== null ? '#00ff00' : '#ff0000',
          boxShadow: balance !== null ? 
            '0 0 12px rgba(0, 255, 0, 0.8)' : 
            '0 0 12px rgba(255, 0, 0, 0.8)',
          animation: 'pulse 1s infinite'
        }} />
        <div style={{
          color: balance !== null ? '#00ff00' : '#ff0000',
          fontSize: '13px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          LIGHTER BALANCE WIDGET
        </div>
      </div>
      
      <div style={{
        fontSize: '22px',
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: '4px',
        textShadow: balance !== null ? 
          '0 0 15px rgba(0, 255, 0, 0.7)' : 
          '0 0 15px rgba(255, 0, 0, 0.7)'
      }}>
        {balance !== null ? (
          `$${balance.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}`
        ) : (
          'CONNECTION FAILED'
        )}
      </div>
      
      <div style={{
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: '11px',
        marginBottom: '8px'
      }}>
        Status: {isLoading ? 'Loading...' : (balance !== null ? 'Connected' : 'Error')}
      </div>
      
      <div style={{
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '10px',
        fontStyle: 'italic'
      }}>
        DB Status: {!db ? 'Firebase Failed' : 'Firebase OK'}
      </div>
      
      {lastUpdate && (
        <div style={{
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '9px',
          marginTop: '4px'
        }}>
          Updated {new Date(lastUpdate).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default LighterBalanceWidget;