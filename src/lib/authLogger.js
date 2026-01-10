import { db, collection, addDoc, serverTimestamp, setDoc, doc } from './firebaseServer';

// Log user authentication events
export async function logAuthEvent(eventType, userData) {
  if (!db) {
    console.warn('Firebase not initialized, skipping auth logging');
    return null;
  }

  try {
    const authEvent = {
      eventType, // 'clerk_login', 'wallet_connected', 'wallet_disconnected', etc.
      timestamp: serverTimestamp(),
      clientTimestamp: new Date().toISOString(),
      ...userData
    };

    // Add to auth_events collection
    const docRef = await addDoc(collection(db, 'auth_events'), authEvent);
    
    console.log(`Auth event logged: ${eventType}`, docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error logging auth event:', error);
    return null;
  }
}

// Log Clerk login
export async function logClerkLogin(user) {
  if (!user) return null;

  const userData = {
    clerkUserId: user.id,
    email: user.primaryEmailAddress?.emailAddress || null,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    username: user.username || null,
    imageUrl: user.imageUrl || null,
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt,
    // Social providers
    externalAccounts: user.externalAccounts?.map(account => ({
      provider: account.provider,
      email: account.emailAddress,
      username: account.username
    })) || []
  };

  return await logAuthEvent('clerk_login', userData);
}

// Log wallet connection
export async function logWalletConnection(user, walletAddress, walletType = 'unknown') {
  if (!user || !walletAddress) return null;

  const walletData = {
    clerkUserId: user.id,
    email: user.primaryEmailAddress?.emailAddress || null,
    walletAddress,
    walletType, // 'inApp', 'metamask', 'coinbase', etc.
    connectedAt: new Date().toISOString()
  };

  // Also update/create user profile with wallet info
  try {
    const userProfileRef = doc(db, 'user_profiles', user.id);
    await setDoc(userProfileRef, {
      clerkUserId: user.id,
      email: user.primaryEmailAddress?.emailAddress || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      walletAddress,
      walletType,
      lastWalletConnection: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating user profile:', error);
  }

  return await logAuthEvent('wallet_connected', walletData);
}

// Log wallet disconnection
export async function logWalletDisconnection(user, walletAddress) {
  if (!user) return null;

  const disconnectData = {
    clerkUserId: user.id,
    email: user.primaryEmailAddress?.emailAddress || null,
    walletAddress: walletAddress || 'unknown',
    disconnectedAt: new Date().toISOString()
  };

  // Update user profile to remove wallet
  try {
    const userProfileRef = doc(db, 'user_profiles', user.id);
    await setDoc(userProfileRef, {
      walletAddress: null,
      walletType: null,
      lastWalletDisconnection: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating user profile:', error);
  }

  return await logAuthEvent('wallet_disconnected', disconnectData);
}

// Get user's auth history
export async function getUserAuthHistory(clerkUserId, limitCount = 10) {
  if (!db || !clerkUserId) return [];

  try {
    const q = query(
      collection(db, 'auth_events'),
      where('clerkUserId', '==', clerkUserId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching auth history:', error);
    return [];
  }
}