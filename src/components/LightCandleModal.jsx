'use client';

import React, { useState, useEffect, lazy, Suspense, useRef, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useWalletAuth } from './WalletAuthProvider';
import { db, collection, addDoc, updateDoc, doc, serverTimestamp, storage, ref, uploadBytes, getDownloadURL, query, where, getDocs, deleteDoc } from '@/lib/firebaseClient';
import ThirdwebBuyModal from './ThirdwebBuyModal';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { tokenFunctions, erc20Contract } from '@/lib/contract';
import { useSendTransaction } from 'thirdweb/react';
import { burn } from 'thirdweb/extensions/erc20';
import { sendAndConfirmTransaction } from 'thirdweb';

// Preload the model
if (typeof window !== 'undefined') {
  useGLTF.preload('/models/tinyVotiveOnly.glb');
}

// Simple candle viewer for preview
function SimpleCandleViewer({ customImageUrl, offeringType }) {
  const { scene } = useGLTF('/models/tinyVotiveOnly.glb');
  const modelRef = useRef();
  const groupRef = useRef();
  
  useEffect(() => {
    if (!scene) return;
    
    // Clone the model
    const clonedModel = scene.clone(true);
    
    // Set scale and position
    clonedModel.scale.set(2, 2, 2);
    clonedModel.position.set(0, 0, 0);
    
    // Apply custom image to senora mesh if available
    if (customImageUrl) {
      const textureLoader = new THREE.TextureLoader();
      
      clonedModel.traverse((child) => {
        if (child.isMesh) {
          const meshName = child.name?.toLowerCase() || '';
          const isSenoraObject = meshName.includes('senora') || 
                                meshName.includes('label') || 
                                meshName.includes('maria');
          
          if (isSenoraObject) {
            textureLoader.load(customImageUrl, (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.flipY = false;
              
              const imageAspect = texture.image.width / texture.image.height;
              const targetAspect = 1;
              
              if (imageAspect > targetAspect) {
                texture.repeat.set(1, imageAspect / targetAspect);
              } else {
                texture.repeat.set(targetAspect / imageAspect, 1);
              }
              
              texture.center.set(0.5, 0.5);
              texture.needsUpdate = true;
              
              if (child.material) {
                child.material = child.material.clone();
                child.material.map = texture;
                child.material.transparent = true;
                child.material.alphaTest = 0.5; // Discard transparent pixels
                child.material.side = THREE.DoubleSide;
                child.material.needsUpdate = true;
              }
            });
          }
          
          // Color the base based on offering type
          const isBaseMesh = meshName === 'xbase' || 
                            meshName.includes('base') || 
                            meshName.includes('wax');
          
          if (isBaseMesh && offeringType) {
            const colors = {
              petition: '#ffaa00',
              confession: '#aa66ff',
              appreciation: '#00ff66'
            };
            
            if (colors[offeringType]) {
              child.material = child.material.clone();
              child.material.color = new THREE.Color(colors[offeringType]);
              child.material.needsUpdate = true;
            }
          }
        }
      });
    }
    
    if (groupRef.current) {
      // Clear previous model
      while (groupRef.current.children.length > 0) {
        groupRef.current.remove(groupRef.current.children[0]);
      }
      // Add new model
      groupRef.current.add(clonedModel);
      modelRef.current = clonedModel;
    }
  }, [scene, customImageUrl, offeringType]);
  
  // Auto-rotate the model
  // useFrame((_state, delta) => {
  //   if (modelRef.current) {
  //     modelRef.current.rotation.y += delta * 0.5;
  //   }
  // });
  
  return <group ref={groupRef} />;
}

const LightCandleModal = ({ isOpen, onClose, onLightCandle }) => {
  const { user } = useUser();
  const { walletAddress, tokenBalance, activeAccount } = useWalletAuth();
  const { mutate: sendTransaction, data: txResult, status: txStatus } = useSendTransaction();
  
  const [offeringType, setOfferingType] = useState('petition');
  const [message, setMessage] = useState('');
  const [polaroidMessage, setPolaroidMessage] = useState('I added a green candle to the charts🙏 $RL80'); // Default for petition
  const [tokenAmount, setTokenAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showNoBuyPrompt, setShowNoBuyPrompt] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [modalHidden, setModalHidden] = useState(false); // Hide modal content during transaction
  const [selectedPrayer, setSelectedPrayer] = useState('');
  const [prayerFor, setPrayerFor] = useState('self'); // 'self' or 'other'
  const [recipientName, setRecipientName] = useState('');
  const [transactionStatus, setTransactionStatus] = useState(''); // 'processing', 'success', 'error', ''
  const progressTimeoutRef = useRef(null);
  const [isBurnInProgress, setIsBurnInProgress] = useState(false); // Track entire burn flow
  const [forceHidden, setForceHidden] = useState(false); // Force modal to stay hidden
  const [hasCompletedBurn, setHasCompletedBurn] = useState(false); // Permanently hide after burn completes
  const [showConfirmation, setShowConfirmation] = useState(false); // Show custom confirmation modal
  const [showWalletLoading, setShowWalletLoading] = useState(false); // Show wallet loading indicator
  const [pendingBurnAmount, setPendingBurnAmount] = useState(0); // Store amount for confirmation

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Don't reset if we're in the middle of burning or have completed
      if (isBurnInProgress || hasCompletedBurn || forceHidden) {
        console.log('[LightCandleModal] Preventing reset - burn in progress or completed');
        return;
      }
      
      setOfferingType('petition');
      setMessage('');
      setPolaroidMessage(offeringTypes.petition.defaultPolaroidMessage);
      setTokenAmount('');
      setIsSubmitting(false);
      setShowInfo(false); // Reset info state
      setUploadedImage(null);
      setImagePreview(null);
      setPrayerFor('self');
      setRecipientName(user?.username || user?.firstName || '');
      setTransactionStatus(''); // Reset transaction status
      setModalHidden(false); // Reset modal visibility
      setIsBurnInProgress(false); // Reset burn flow flag
      setForceHidden(false); // Allow modal to show
      setHasCompletedBurn(false); // Reset completed flag to allow modal to show again
      setShowConfirmation(false); // Reset confirmation modal
      setShowWalletLoading(false); // Reset wallet loading
      setPendingBurnAmount(0); // Reset pending amount
      // Check token balance immediately when modal opens
      // tokenBalance is a string from the provider, so convert to number
      const balance = parseInt(tokenBalance) || 0;
      if (walletAddress && balance === 0) {
        setShowNoBuyPrompt(true);
      } else {
        setShowNoBuyPrompt(false);
      }
    }
    
    // Cleanup timeout on unmount or modal close
    return () => {
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
        progressTimeoutRef.current = null;
      }
    };
  }, [isOpen, walletAddress, tokenBalance]);

  // We'll control the progress indicator manually after transaction is signed

  // Create the callback outside of conditional rendering
  const handleSnapshotComplete = React.useCallback((imageData) => {
    // Modal is already closed, just clean up state
    setIsSubmitting(false);
    
    // Reset form data after snapshot is complete
    setMessage('');
    setTokenAmount('');
    setUploadedImage(null);
    setImagePreview(null);
    setOfferingType('petition');
    setPrayerFor('self');
    setRecipientName('');
  }, []);

  // Permanently hide modal after burn completes
  if (hasCompletedBurn) return null;
  
  // Show progress indicator even when modal is closed if transaction is processing
  if (!isOpen && transactionStatus !== 'processing') return null;
  
  // Force hide the modal completely if forceHidden is set (except for progress indicator)
  if (forceHidden && transactionStatus !== 'processing') return null;

  // Function to handle actions after successful burn
  const handlePostBurnActions = async () => {
    console.log('🔥 POST-BURN ACTIONS CALLED - This should only happen AFTER successful transaction!');
    try {
      // Prepare offering data
      const baseOffering = {
        name: user?.username || user?.firstName || 'Anonymous',
        type: offeringType,
        message: message.trim(),
        polaroidMessage: polaroidMessage.trim(), // Add polaroid message
        tokensBurned: parseInt(tokenAmount) || 0,
        userId: user?.id,
        walletAddress: walletAddress,
        userImageUrl: user?.imageUrl || null,
        prayerFor: prayerFor,
        recipientName: prayerFor === 'self' ? (user?.username || user?.firstName || 'Anonymous') : (recipientName || 'Someone'),
        createdAt: serverTimestamp(),
        timestamp: new Date().toISOString()
      };
      
      // For now, just save the plain image as base64
      // The polaroid-formatted version will be created and uploaded separately
      // by CandleSnapshotRenderer, and then the polaroidUrl will be updated
      if (uploadedImage) {
        baseOffering.customImage = uploadedImage;
      }

      // First trigger the NewCandleEffect and Prayer Received animation
      // WITHOUT saving to Firebase yet
      const newOffering = {...baseOffering};
      if (uploadedImage) {
        newOffering.customImage = uploadedImage;
      }
      
      console.log('🎬 Triggering candle animation and Prayer Received');
      // Trigger the effect immediately (this will show "Prayer Received")
      await onLightCandle(newOffering);
      
      console.log('⏱️ Waiting for Prayer Received animation to complete');
      // Wait for the "Prayer Received" animation to show (1.5 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // NOW save to Firestore after the animation
      // First, check for existing active offering for this wallet
      const EXPIRATION_HOURS = 80;
      const EXPIRATION_MS = EXPIRATION_HOURS * 60 * 60 * 1000; // 80 hours in milliseconds
      
      let docRef = null;
      try {
        console.log('🕐 Checking for existing offerings for wallet:', walletAddress);
        console.log('🔐 Current user auth:', {
          userId: user?.id,
          isAuthenticated: !!user,
          email: user?.primaryEmailAddress?.emailAddress
        });
        
        // Query for existing offerings from this wallet
        const existingQuery = query(
          collection(db, 'offerings'),
          where('walletAddress', '==', walletAddress)
        );
        
        const existingSnapshot = await getDocs(existingQuery);
        console.log('📊 Found existing offerings:', existingSnapshot.size);
        
        // Delete ALL existing offerings for this wallet (expired and active)
        // New candle will replace any existing ones and restart the timer
        const now = new Date();
        const allOfferingsToDelete = [];
        
        existingSnapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          const createdAt = data.createdAt?.toDate?.() || new Date(data.timestamp);
          const ageMs = now.getTime() - createdAt.getTime();
          
          console.log('🔍 Existing offering:', {
            id: docSnapshot.id,
            ageHours: Math.round(ageMs / (1000 * 60 * 60)),
            willBeReplaced: true,
            offeringUserId: data.userId,
            currentUserId: user?.id,
            userIdsMatch: data.userId === user?.id
          });
          
          allOfferingsToDelete.push(docSnapshot.id);
        });
        
        // Clean up ALL existing offerings (replacement model)
        if (allOfferingsToDelete.length > 0) {
          console.log('🔄 Attempting to replace existing offerings:', allOfferingsToDelete);
          for (const offeringId of allOfferingsToDelete) {
            try {
              console.log('🗑️ Attempting to delete offering:', offeringId);
              await deleteDoc(doc(db, 'offerings', offeringId));
              console.log('✅ Successfully deleted existing offering:', offeringId);
            } catch (deleteError) {
              console.error('❌ Failed to delete existing offering:', offeringId, deleteError);
              console.error('❌ Error details:', {
                code: deleteError.code,
                message: deleteError.message,
                name: deleteError.name
              });
              // Continue with other deletions even if one fails
            }
          }
          console.log('🕯️ Deletion attempts completed');
        }
        
        // Now create the new offering
        console.log('✨ Creating new offering for wallet:', walletAddress);
        docRef = await addDoc(collection(db, 'offerings'), baseOffering);
        baseOffering.id = docRef.id;
        
        // Return the offering ID so parent can update it with polaroid URL later
        if (window.setLatestOfferingId) {
          window.setLatestOfferingId(docRef.id);
        }
      } catch (firestoreError) {
        console.error('Error saving to Firestore:', firestoreError);
        // Log error but continue - don't block the user experience
      }

      // The illumin80 page will handle snapshot capture independently
    } catch (error) {
      console.error('Error in post-burn actions:', error);
      alert('Failed to complete candle lighting. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // This is now only used for the form onSubmit - actual transaction is handled by TransactionButton
  const handleSubmit = async (e) => {
    e.preventDefault();
    // The TransactionButton will handle everything
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Image size must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Compress image to max 800px width/height
          const maxSize = 800;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          // Preserve transparency by not filling background
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // Use PNG format to preserve transparency
          const compressedDataUrl = canvas.toDataURL('image/png');
          
          // Check if compressed image is still too large (>900KB to be safe)
          if (compressedDataUrl.length > 900000) {
            // For large images, try WebP if supported, otherwise stick with PNG
            const webpSupported = canvas.toDataURL('image/webp').indexOf('image/webp') > -1;
            if (webpSupported) {
              const webpCompressed = canvas.toDataURL('image/webp', 0.8);
              setUploadedImage(webpCompressed);
              setImagePreview(webpCompressed);
            } else {
              // If still too large, reduce size further
              const smallerCanvas = document.createElement('canvas');
              smallerCanvas.width = width * 0.7;
              smallerCanvas.height = height * 0.7;
              const smallerCtx = smallerCanvas.getContext('2d');
              smallerCtx.clearRect(0, 0, smallerCanvas.width, smallerCanvas.height);
              smallerCtx.drawImage(img, 0, 0, smallerCanvas.width, smallerCanvas.height);
              const smallerPng = smallerCanvas.toDataURL('image/png');
              setUploadedImage(smallerPng);
              setImagePreview(smallerPng);
            }
          } else {
            setUploadedImage(compressedDataUrl);
            setImagePreview(compressedDataUrl);
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
  };

  const offeringTypes = {
    petition: { 
      // icon: '🙏', 
      color: '#ffaa00', 
      label: 'PETITION',
      description: 'Ask for guidance or help',
      defaultPolaroidMessage: 'I added a green candle to the charts🙏 $RL80'
    },
    confession: { 
      // icon: '❤️‍🔥', 
      color: '#aa66ff', 
      label: 'CONFESSION',
      description: 'Unburden your heart',
      defaultPolaroidMessage: 'I told Her everything 💔 $RL80'
    },
    appreciation: { 
      // icon: '✨', 
      color: '#00ff66', 
      label: 'THANKS',
      description: 'Express gratitude for good fortune',
      defaultPolaroidMessage: 'She came through 🕯️ $RL80'
    }
  };

  const prayerTemplates = [
    {
      id: 'scalper',
      title: "Scalper's Prayer",
      text: "Oh Lady of Perpetual Profit, bless my lightning fingers and low-latency reflexes. Protect me from fat-fingered orders and grant me the stamina to chase micro-movements without losing my soul. May every scalp be green, and every exit perfectly timed. Amen."
    },
    {
      id: 'leverage',
      title: "Leverage Prayer",
      text: "Oh Blessed Virgin of Margin, shield me from the wicked lure of 100x leverage. Guard my trades from sudden liquidation, and deliver me from the temptation of adding 'just a little more.' Grant me the humility to close in profit, and the grace to walk away before the exchange claims my soul. Amen."
    },
    {
      id: 'swing',
      title: "Swing Trader's Prayer",
      text: "Oh Lady of Perpetual Profit, grant me patience to ride the waves of volatility, and the wisdom to know when to take profit and when to let it run. Bless my charts, my Fibonacci retracements, and my RSI settings, that I may always enter at the bottom and exit at the top. Amen."
    },
    {
      id: 'hodler',
      title: "Hodler's Prayer",
      text: "Oh Glorious Mother of Diamond Hands, let me never succumb to weak paper hands. Guard my seed phrase, strengthen my resolve, and remind me that one day the line shall go up forever. May my wallet survive bear markets, hacks, and exchange collapses, until the moon and beyond. Amen."
    },
    {
      id: 'chart',
      title: "Chart Mystic's Prayer",
      text: "Oh Oracle of Eternal Candles, Our Lady of Perpetual Profit, guide my eyes as I read the sacred indicators. Grant me the gift of vision to see wedges before they break, triangles before they tighten, and golden crosses before they shine. Deliver me from false signals, and sanctify my trading view with holy confluence. Amen."
    }
  ];

  return (
    <>
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInNoMove {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px currentColor;
          }
          50% {
            box-shadow: 0 0 30px currentColor, 0 0 40px currentColor;
          }
        }

        @keyframes pulse {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5000;
          animation: fadeIn 0.3s ease-out;
        }

        .modal-content {
          background: rgba(20, 20, 30, 0.98);
          border: 2px solid transparent;
          background-image: linear-gradient(rgba(20, 20, 30, 0.98), rgba(20, 20, 30, 0.98)),
                           linear-gradient(90deg, #8b5cf6, #ec4899);
          background-origin: border-box;
          background-clip: padding-box, border-box;
          border-radius: 20px;
          padding: 2rem;
          width: 90%;
          max-width: 500px;
          height: 85vh;
          max-height: 85vh;
          overflow: hidden;
          position: relative;
          animation: fadeIn 0.4s ease-out;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(139, 92, 246, 0.3);
        }
        
        /* Desktop scaling - keep modal reasonable size */
        @media (min-width: 1200px) and (min-height: 800px) {
          .modal-content {
            max-width: 550px;
            height: 90vh;
            max-height: 90vh;
          }
        }
        
        @media (min-width: 1600px) and (min-height: 900px) {
          .modal-content {
            max-width: 600px;
            height: 90vh;
            max-height: 90vh;
          }
        }
        
        /* Height-based media queries */
        @media (max-height: 800px) {
          .modal-content {
            height: 90vh;
            max-height: 90vh;
            padding: 1.5rem;
          }
        }
        
        @media (max-height: 700px) {
          .modal-content {
            height: 95vh;
            max-height: 95vh;
            padding: 1rem;
          }
        }

        .close-button {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: none;
          border: none;
          color: #ec4899;
          font-size: 1.5rem;
          cursor: pointer;
          transition: all 0.2s;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-button:hover {
          transform: scale(1.1);
          color: #f472b6;
        }

        .modal-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #fff;
          text-align: center;
          margin-bottom: 1.5rem;
          font-family: 'Orbitron', monospace;
        }

        .offering-types {
          display: flex;
          gap: 0.4rem;
          margin-bottom: 1.5rem;
          justify-content: center;
        }

        .offering-type-button {
          flex: 1;
          padding: 0.5rem 0.3rem;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.3s;
          text-align: center;
          min-width: 0;
        }

        .offering-type-button:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .offering-type-button.selected {
          background: rgba(139, 92, 246, 0.1);
          border-color: #8b5cf6;
          color: #fff;
        }

        .type-icon {
          font-size: 1.25rem;
          display: block;
          margin-bottom: 0.3rem;
        }

        .type-label {
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          word-break: break-word;
        }

        .type-description {
          font-size: 0.5rem;
          opacity: 0.7;
          margin-top: 0.2rem;
          line-height: 1.2;
          padding: 0 0.2rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-label {
          display: block;
          color: #00f5d4;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 500;
        }

        .message-textarea {
          width: 100%;
          height: 140px;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 0.7rem;
          resize: none;
          transition: all 0.3s;
        }

        .message-textarea:focus {
          outline: none;
          border-color: #8b5cf6;
          background: rgba(139, 92, 246, 0.05);
        }

        .token-input {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 0.9rem;
          transition: all 0.3s;
        }

        .token-input:focus {
          outline: none;
          border-color: #8b5cf6;
          background: rgba(139, 92, 246, 0.05);
        }

        .token-balance {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 0.5rem;
        }

        .buy-prompt-overlay {
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: rgba(20, 20, 30, 0.98);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }

        .buy-prompt-card {
          background: rgba(30, 30, 40, 0.98);
          border: 2px solid #8b5cf6;
          border-radius: 16px;
          padding: 2rem;
          max-width: 400px;
          width: 90%;
          text-align: center;
        }

        .buy-prompt-title {
          color: #fff;
          font-size: 1.25rem;
          margin-bottom: 1rem;
          font-weight: 600;
        }

        .buy-prompt-text {
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }

        .buy-prompt-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .buy-prompt-button {
          padding: 0.75rem 1.5rem;
          border-radius: 50px;
          border: none;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .buy-prompt-button.primary {
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          color: white;
        }

        .buy-prompt-button.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3);
        }

        .buy-prompt-button.secondary {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .buy-prompt-button.secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }

        .image-upload-section {
          margin: 1rem 0;
        }

        .image-upload-label {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 25px;
          color: #8b5cf6;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 0.85rem;
        }

        .image-upload-label:hover {
          background: rgba(139, 92, 246, 0.2);
          border-color: #8b5cf6;
        }

        .image-preview {
          margin-top: 1rem;
          position: relative;
          display: inline-block;
        }

        .image-preview img {
          max-width: 100%;
          max-height: 200px;
          border-radius: 12px;
          border: 2px solid rgba(139, 92, 246, 0.3);
        }

        .remove-image-btn {
          position: absolute;
          top: -8px;
          right: -8px;
          background: #ff4444;
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          line-height: 1;
        }

        .preview-box {
          width: 120px;
          height: 120px;
          background: rgba(20, 20, 30, 0.8);
          border: 2px solid rgba(139, 92, 246, 0.3);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          flex-shrink: 0;
        }

        .preview-label {
          position: absolute;
          top: 4px;
          left: 4px;
          background: rgba(139, 92, 246, 0.9);
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.6rem;
          font-weight: 600;
          z-index: 10;
        }
        
        .form-row {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        
        .form-column {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .submit-button {
          width: 100%;
          padding: 0.875rem;
          background: #fff;
          border: none;
          border-radius: 50px;
          color: #000;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
          margin-top: 1rem;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(255, 255, 255, 0.2);
          background: #f0f0f0;
        }

        .submit-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

      `}</style>

      {/* Separate overlay for transaction progress to prevent layout shifts */}
      {transactionStatus === 'processing' && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div 
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(20, 20, 30, 0.98)',
              border: '2px solid transparent',
              backgroundImage: 'linear-gradient(rgba(20, 20, 30, 0.98), rgba(20, 20, 30, 0.98)), linear-gradient(135deg, #8b5cf6, #ec4899)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              borderRadius: '24px',
              padding: '3rem',
              textAlign: 'center',
              color: '#fff',
              boxShadow: '0 20px 60px rgba(139, 92, 246, 0.5)',
              zIndex: 10000,
              minWidth: '320px',
              animation: 'fadeInNoMove 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated Flame Icon */}
            <div style={{
              fontSize: '4rem',
              marginBottom: '1.5rem',
              filter: 'drop-shadow(0 0 30px rgba(255, 170, 0, 0.8)) drop-shadow(0 0 60px rgba(255, 100, 0, 0.4))',
              animation: 'pulse 2s ease-in-out infinite',
              display: 'inline-block'
            }}>
              🔥
            </div>
            
            {/* Processing Message */}
            <h3 style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: '1.4rem',
              fontWeight: '700',
              color: '#fff',
              marginBottom: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '2px'
            }}>
              Lighting Your Candle
            </h3>
            
            <p style={{
              color: '#00f5d4',
              fontSize: '1rem',
              marginBottom: '1.5rem',
              lineHeight: '1.5'
            }}>
              Burning {tokenAmount || '0'} RL80 token{parseInt(tokenAmount) !== 1 ? 's' : ''}...
            </p>
            
            {/* Loading Animation */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem',
              marginTop: '2rem'
            }}>
              {[0, 1, 2].map(i => (
                <div 
                  key={i}
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                    animation: `pulse 1.4s ease-in-out ${i * 0.16}s infinite`
                  }}
                />
              ))}
            </div>
            
            <p style={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '0.85rem',
              marginTop: '2rem',
              fontStyle: 'italic'
            }}>
              Transaction submitted, waiting for confirmation...
            </p>
          </div>
        </div>
      )}
      
      {/* Main modal overlay */}
      <div className="modal-overlay" onClick={onClose} style={{ display: (!forceHidden && !modalHidden) ? 'flex' : 'none' }}>
        {/* Buy RL80 Prompt - Show this INSTEAD of the modal content */}
        {showNoBuyPrompt && transactionStatus !== 'processing' ? (
          <div 
            style={{
              background: 'rgba(20, 20, 30, 0.98)',
              border: '1px solid rgba(138, 43, 226, 0.4)',
              borderRadius: '24px',
              padding: '1rem',
              maxWidth: '420px',
              textAlign: 'center',
              color: '#fff',
              boxShadow: '0 0 60px rgba(138, 43, 226, 0.3)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: '#ff006e',
                fontSize: '2rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s',
              }}
              onClick={onClose}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              ×
            </button>
            
            {/* Icon */}
            {/* <div style={{ marginBottom: '1rem' }}>
              <div style={{
                fontSize: '4rem',
                filter: 'drop-shadow(0 0 20px rgba(253, 237, 0, 0.5))',
              }}>
                🪙
              </div>
            </div> */}
            
            {/* Title */}
            <h2 style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: '1.2rem',
              fontWeight: '700',
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              marginBottom: '1.5rem',
            }}>
              RL80 TOKENS REQUIRED
            </h2>
            
            {/* Description */}
            <p style={{
              color: '#00f5d4',
              fontSize: '1.1rem',
              marginBottom: '2.5rem',
              lineHeight: '1.5',
            }}>
              You need RL80 tokens to light a candle.
            </p>
            
            {/* Info message for test mode */}
            <div style={{
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '2rem'
            }}>
              <p style={{
                color: '#fff',
                fontSize: '0.9rem',
                margin: 0
              }}>
                💡 Test tokens have been provided for this demo. Please close this window and try lighting a candle again.
              </p>
            </div>
            
            {/* Secondary link */}
            <button 
              onClick={() => {
                setShowNoBuyPrompt(false);
                onClose();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '0.9rem',
                cursor: 'pointer',
                padding: '0.5rem 1rem',
                transition: 'color 0.3s',
                textDecoration: 'underline',
              }}
              onMouseEnter={(e) => {
                e.target.style.color = 'rgba(255, 255, 255, 0.8)';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = 'rgba(255, 255, 255, 0.5)';
              }}
            >
              Maybe Later
            </button>
          </div>
        ) : !transactionStatus ? (
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={onClose}>✕</button>
            <h2 className="modal-title">Light a Candle</h2>
            
            {/* Info Toggle Button */}
            <div style={{ 
              textAlign: 'center', 
              marginBottom: '1rem',
              marginTop: '-0.5rem'
            }}>
              <button
                type="button"
                onClick={() => setShowInfo(!showInfo)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00f5d4',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  opacity: 0.8,
                  transition: 'opacity 0.2s',
                  padding: '0.25rem',
                }}
                onMouseEnter={(e) => e.target.style.opacity = '1'}
                onMouseLeave={(e) => e.target.style.opacity = '0.8'}
              >
                {showInfo ? '▼ Hide Rules' : '▶ View Rules'}
              </button>
            </div>
            
            {/* Collapsible Info Section */}
            {showInfo && (
              <div style={{
                background: 'rgba(139, 92, 246, 0.05)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1.5rem',
                fontSize: '0.7rem',
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: '1.6',
              }}>
                <ul style={{ 
                  margin: 0, 
                  paddingLeft: '1.2rem',
                  listStyle: 'none'
                }}>
                  <li style={{ marginBottom: '0.4rem' }}>💎 1 token minimum to light a candle</li>
                  <li style={{ marginBottom: '0.4rem' }}>⏱️ Candles expire after 80 hours</li>
                  <li style={{ marginBottom: '0.4rem' }}>🕯️ One candle per wallet address at a time</li>
                  <li style={{ marginBottom: '0.4rem' }}>🔄 New candles replace existing ones & restart timer</li>
                  <li>🌍 All candles are publicly displayed</li>
                </ul>
              </div>
            )}
            
            <form onSubmit={handleSubmit} style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              flex: 1, 
              minHeight: 0,
              overflow: 'hidden' 
            }}>
            {/* Scrollable content area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: '0.5rem',
              marginRight: '-0.5rem',
              minHeight: 0
            }}>
            
            {/* Offering Type Selection */}
            <label className="form-label" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              Choose Prayer Protocol:
            </label>
            <div className="offering-types">
              {Object.entries(offeringTypes).map(([type, config]) => (
                <button
                  key={type}
                  type="button"
                  className={`offering-type-button ${offeringType === type ? 'selected' : ''}`}
                  style={{
                    borderColor: offeringType === type ? config.color : 'transparent',
                    color: offeringType === type ? config.color : '#fff'
                  }}
                  onClick={() => {
                    setOfferingType(type);
                    setPolaroidMessage(config.defaultPolaroidMessage);
                  }}
                >
                  <span className="type-icon">{config.icon}</span>
                  <span className="type-label">{config.label}</span>
                  <div className="type-description">{config.description}</div>
                </button>
              ))}
            </div>

            {/* Prayer Recipient Toggle */}
            <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Who is this prayer for?
                </label>
                <div style={{ display: 'flex', gap: '1.5rem', marginLeft: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="prayerFor"
                      value="self"
                      checked={prayerFor === 'self'}
                      onChange={() => {
                        setPrayerFor('self');
                        setRecipientName(user?.username || user?.firstName || '');
                      }}
                      style={{
                        marginRight: '0.3rem',
                        cursor: 'pointer',
                        accentColor: '#8b5cf6'
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>For Me</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="prayerFor"
                      value="other"
                      checked={prayerFor === 'other'}
                      onChange={() => {
                        setPrayerFor('other');
                        setRecipientName('');
                      }}
                      style={{
                        marginRight: '0.3rem',
                        cursor: 'pointer',
                        accentColor: '#8b5cf6'
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>For Someone Else</span>
                  </label>
                </div>
              </div>
              
              {/* Name Input */}
              <input
                type="text"
                placeholder="Name"
                value={prayerFor === 'self' ? (user?.username || user?.firstName || '') : recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                disabled={prayerFor === 'self'}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: prayerFor === 'self' ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  opacity: prayerFor === 'self' ? 0.7 : 1,
                  cursor: prayerFor === 'self' ? 'not-allowed' : 'text',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Message Input and Preview */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              {/* Message Input */}
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label" htmlFor="message">
                  Your Message
                </label>
                <textarea
                  id="message"
                  className="message-textarea"
                  placeholder="Write your own or select a template below"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={280}
                  required
                />
                <div style={{ textAlign: 'right', fontSize: '0.6rem', color: '#666', marginTop: '0.1rem' }}>
                  {message.length}/280
                </div>
                
                {/* Prayer Templates Dropdown */}
                <select 
                  value={selectedPrayer}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedPrayer(value);
                    if (value) {
                      const prayer = prayerTemplates.find(p => p.id === value);
                      if (prayer) {
                        setMessage(prayer.text);
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    color: '#8b5cf6',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Select a template...</option>
                  {prayerTemplates.map(prayer => (
                    <option key={prayer.id} value={prayer.id}>
                      {prayer.title}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Preview and Image Upload */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                {/* 3D Preview Box */}
                <div className="preview-box" style={{ width: '180px', height: '180px' }}>
                  <span className="preview-label">Preview</span>
                {typeof window !== 'undefined' ? (
                  <Suspense fallback={
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: '100%',
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontSize: '0.7rem'
                    }}>
                      Loading...
                    </div>
                  }>
                    <Canvas
                      camera={{ position: [0, 0, 5], fov: 50 }}
                      style={{ width: '100%', height: '100%' }}
                      gl={{ preserveDrawingBuffer: true }}
                    >
                      <ambientLight intensity={0.5} />
                      <directionalLight position={[10, 10, 5]} intensity={1} />
                      <Suspense fallback={null}>
                        <SimpleCandleViewer 
                          customImageUrl={imagePreview}
                          offeringType={offeringType}
                        />
                      </Suspense>
                      <OrbitControls 
                        enablePan={false}
                        maxDistance={5}
                        minDistance={2}
                        enableZoom={true}
                        autoRotate={false}
                        // autoRotateSpeed={1}
                      />
                    </Canvas>
                  </Suspense>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '0.7rem'
                  }}>
                    Loading...
                  </div>
                )}
                </div>
                
                {/* Image Upload Button */}
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="image-upload" className="image-upload-label" style={{ width: '100%' }}>
                  <span>📷</span>
                  <span>Add Image</span>
                </label>
                {imagePreview && (
                  <button
                    type="button"
                    style={{
                      background: '#ff4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '20px',
                      padding: '0.3rem 0.8rem',
                      fontSize: '0.7rem',
                      cursor: 'pointer'
                    }}
                    onClick={removeImage}
                  >
                    Remove Image
                  </button>
                )}
              </div>
              
            </div>

            {/* Polaroid Message */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="polaroid-message">
                Polaroid Caption (editable)
              </label>
              <input
                id="polaroid-message"
                type="text"
                className="token-input"
                value={polaroidMessage}
                onChange={(e) => setPolaroidMessage(e.target.value)}
                maxLength={50}
                style={{ fontSize: '0.8rem' }}
              />
              <div style={{ textAlign: 'right', fontSize: '0.6rem', color: '#666', marginTop: '0.1rem' }}>
                {polaroidMessage.length}/50
              </div>
            </div>

            {/* Token Amount */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="tokens">
                RL80 Tokens to Burn
              </label>
              <input
                id="tokens"
                type="number"
                className="token-input"
                min="1"
                max={parseInt(tokenBalance) > 0 ? parseInt(tokenBalance) : 10000}
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                placeholder="1 RL80 minimum"
                required
              />
              {tokenBalance !== null && tokenBalance !== undefined ? (
                <div className="token-balance">
                  Balance: {tokenBalance.toLocaleString()} RL80
                </div>
              ) : walletAddress ? (
                <div className="token-balance">
                  Loading balance...
                </div>
              ) : (
                <div className="token-balance" style={{ color: '#ff6b35' }}>
                  Connect wallet to see balance
                </div>
              )}
            </div>
            </div>

            {/* Button Container - Sticky at bottom */}
            <div style={{
              marginTop: 'auto',
              paddingTop: '1rem',
              flexShrink: 0
            }}>
            {/* Submit Button - Light Candle with token burn */}
            <button
              onClick={async () => {
                const amount = parseInt(tokenAmount) || 0;
                const currentBalance = parseInt(tokenBalance) || 0;
                
                if (!message.trim()) {
                  alert('Please enter a message for your candle');
                  return;
                }
                if (amount < 1) {
                  alert('Minimum 1 RL80 token required to light a candle');
                  return;
                }
                if (currentBalance === 0) {
                  setShowNoBuyPrompt(true);
                  return;
                }
                if (amount > currentBalance) {
                  alert(`You only have ${currentBalance} RL80 tokens. Please enter a valid amount.`);
                  return;
                }
                
                // Show custom confirmation modal
                setPendingBurnAmount(amount);
                setShowConfirmation(true);
              }}
              disabled={isSubmitting || !message.trim() || !tokenAmount || parseInt(tokenAmount) < 1}
              className="submit-button"
              style={{
                marginTop: '1rem'
              }}
            >
              {isSubmitting ? 'Processing...' : 'Light Candle'}
            </button>
            </div>
            </form>
            
          </div>
        ) : null}
      </div>

      {/* Wallet Loading Indicator */}
      {showWalletLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10002,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            background: 'rgba(20, 20, 30, 0.98)',
            border: '2px solid transparent',
            backgroundImage: 'linear-gradient(rgba(20, 20, 30, 0.98), rgba(20, 20, 30, 0.98)), linear-gradient(135deg, #8b5cf6, #ec4899)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            borderRadius: '24px',
            padding: '3rem',
            textAlign: 'center',
            color: '#fff',
            boxShadow: '0 20px 60px rgba(139, 92, 246, 0.4)',
            maxWidth: '380px',
            width: '90%'
          }}>
            {/* Wallet Icon Animation */}
            <div style={{
              fontSize: '4rem',
              marginBottom: '1.5rem',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}>
              💳
            </div>
            
            {/* Title */}
            <h3 style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: '1.2rem',
              fontWeight: '700',
              color: '#00f5d4',
              marginBottom: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '2px'
            }}>
              Opening Wallet
            </h3>
            
            {/* Message */}
            <p style={{
              color: '#fff',
              fontSize: '0.95rem',
              marginBottom: '2rem',
              lineHeight: '1.5'
            }}>
              Please sign the transaction in your wallet to continue...
            </p>
            
            {/* Loading dots */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem'
            }}>
              {[0, 1, 2].map(i => (
                <div 
                  key={i}
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                    animation: `pulse 1.4s ease-in-out ${i * 0.16}s infinite`
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {showConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            background: 'rgba(20, 20, 30, 0.98)',
            border: '2px solid transparent',
            backgroundImage: 'linear-gradient(rgba(20, 20, 30, 0.98), rgba(20, 20, 30, 0.98)), linear-gradient(135deg, #8b5cf6, #ec4899)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            borderRadius: '24px',
            padding: '3rem',
            textAlign: 'center',
            color: '#fff',
            boxShadow: '0 20px 60px rgba(139, 92, 246, 0.5)',
            maxWidth: '400px',
            width: '90%'
          }}>
            {/* Flame Icon */}
            <div style={{
              fontSize: '4rem',
              marginBottom: '1.5rem',
              filter: 'drop-shadow(0 0 30px rgba(255, 170, 0, 0.8)) drop-shadow(0 0 60px rgba(255, 100, 0, 0.4))',
              animation: 'pulse 2s ease-in-out infinite',
              display: 'inline-block'
            }}>
              🕯️
            </div>
            
            {/* Title */}
            <h3 style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: '1.4rem',
              fontWeight: '700',
              color: '#fff',
              marginBottom: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '2px'
            }}>
              Ready to Light?
            </h3>
            
            {/* Message */}
            <p style={{
              color: '#00f5d4',
              fontSize: '1rem',
              marginBottom: '1.5rem',
              lineHeight: '1.6'
            }}>
              You're about to burn <strong style={{ color: '#fff', fontSize: '1.2rem' }}>{pendingBurnAmount}</strong> RL80 token{pendingBurnAmount !== 1 ? 's' : ''} to light your candle.
            </p>
            
            <p style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.9rem',
              marginBottom: '2rem',
              fontStyle: 'italic'
            }}>
              This offering will be permanent and cannot be undone.
            </p>
            
            {/* Buttons */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setPendingBurnAmount(0);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={async () => {
                  setShowConfirmation(false);
                  setShowWalletLoading(true);
                  
                  // Proceed with the burn
                  const amount = pendingBurnAmount;
                  const amountInWei = BigInt(amount) * 1000000000000000000n;
                  
                  setIsSubmitting(true);
                  setIsBurnInProgress(true);
                  setForceHidden(true);
                  setModalHidden(true);
                  
                  // Small delay to show wallet loading state
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  try {
                    // Check if we have an active account
                    console.log('[LightCandleModal] Checking activeAccount:', activeAccount);
                    console.log('[LightCandleModal] Wallet address:', walletAddress);
                    console.log('[LightCandleModal] Token balance:', tokenBalance);
                    
                    if (!activeAccount) {
                      console.error('[LightCandleModal] No active account available');
                      alert('Please connect your wallet first');
                      setIsSubmitting(false);
                      setIsBurnInProgress(false);
                      setForceHidden(false);
                      setModalHidden(false);
                      setShowWalletLoading(false);
                      return;
                    }
                    
                    const transaction = burn({
                      contract: erc20Contract,
                      amount: amountInWei,
                    });
                    
                    console.log('[LightCandleModal] Sending transaction for user to sign with account:', activeAccount.address);
                    setShowWalletLoading(false); // Hide wallet loading when wallet opens
                    
                    // Check if this is a test wallet account (has sendTransaction method)
                    if (activeAccount.sendTransaction) {
                      console.log('[LightCandleModal] Using test wallet account to send transaction');
                      
                      try {
                        // For test wallets, use the account's sendTransaction directly
                        const result = await sendAndConfirmTransaction({
                          transaction,
                          account: activeAccount
                        });
                        
                        console.log('[LightCandleModal] Transaction confirmed:', result);
                        
                        // Clear progress indicator
                        setTransactionStatus('');
                        
                        // Now save to Firebase after actual blockchain confirmation
                        await handlePostBurnActions();
                        
                        setIsSubmitting(false);
                        // Permanently hide the modal after burn completes
                        setHasCompletedBurn(true);
                        
                        // Call onClose after a delay
                        setTimeout(() => {
                          onClose();
                        }, 100);
                      } catch (error) {
                        console.error('[LightCandleModal] Test wallet transaction error:', error);
                        setTransactionStatus('');
                        setIsBurnInProgress(false);
                        alert('Failed to burn tokens: ' + (error?.message || 'Unknown error'));
                        setIsSubmitting(false);
                        setShowWalletLoading(false);
                        setForceHidden(false);
                        setModalHidden(false);
                      }
                    } else {
                      // For regular wallets, use the sendTransaction hook
                      sendTransaction(transaction, {
                        onSuccess: async (result) => {
                      console.log('[LightCandleModal] Transaction signed and sent to blockchain');
                      // Transaction is signed and sent to blockchain
                      // NOW show the progress indicator
                      setTransactionStatus('processing');
                      
                      // Wait for transaction to be actually mined/confirmed
                      if (result?.transactionHash || result?.hash) {
                        // Transaction takes ~10 seconds to confirm
                        
                        // Check if we have a wait method or need to poll
                        if (result.wait) {
                          // If there's a wait method, use it
                          await result.wait();
                        } else {
                          // Otherwise wait for a reasonable time for confirmation
                          await new Promise(resolve => setTimeout(resolve, 10000));
                        }
                      }
                      
                      // Clear progress indicator
                      console.log('[LightCandleModal] Transaction confirmed, hiding progress indicator');
                      setTransactionStatus('');
                      
                      // Now save to Firebase after actual blockchain confirmation
                      await handlePostBurnActions();
                      
                      setIsSubmitting(false);
                      // Permanently hide the modal after burn completes
                      setHasCompletedBurn(true);
                      // Keep forceHidden as true to prevent modal from reappearing
                      
                      // Call onClose after a delay to notify parent component
                      // This ensures the modal is properly closed in the parent's state
                      setTimeout(() => {
                        onClose();
                      }, 100);
                    },
                    onError: (error) => {
                      console.error('[LightCandleModal] Transaction error:', error);
                      console.error('[LightCandleModal] Error details:', {
                        message: error?.message,
                        code: error?.code,
                        cause: error?.cause,
                        stack: error?.stack
                      });
                      
                      // Clear progress indicator if it was shown
                      setTransactionStatus('');
                      setIsBurnInProgress(false); // Clear burn flow flag on error
                      
                      // Check if user rejected the transaction
                      if (!error?.message?.includes('User rejected') && 
                          !error?.message?.includes('User denied') &&
                          !error?.message?.includes('rejected') &&
                          error?.code !== 4001) {
                        alert('Failed to burn tokens: ' + (error?.message || 'Unknown error'));
                      }
                      
                      setIsSubmitting(false);
                      setShowWalletLoading(false);
                    }
                      });
                    }
                  } catch (error) {
                  console.error('Failed to create burn transaction:', error);
                  alert('Failed to burn tokens. Please try again.');
                  setIsSubmitting(false);
                  setTransactionStatus('');
                  setShowWalletLoading(false);
                }
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(139, 92, 246, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Light My Candle
            </button>
          </div>
        </div>
        </div>
      )}

      {/* ThirdwebBuyModal */}
      {showBuyModal && (
        <ThirdwebBuyModal 
          isOpen={showBuyModal} 
          onClose={() => {
            setShowBuyModal(false);
            // Check if balance is still 0 after closing buy modal
            const balance = parseInt(tokenBalance) || 0;
            if (balance === 0) {
              // User didn't complete purchase, close the LightCandleModal
              onClose();
            }
          }} 
        />
      )}
      
    </>
  );
};

export default LightCandleModal;