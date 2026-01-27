import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  orderBy,
  limit,
  batch,
  set,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  getDoc,
  writeBatch,
  setDoc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient.js"; // Ensure Firestore and Firebase Auth are initialized correctly
import {
  Clerk,
  useUser,
  SignedIn,
  SignedOut,
  SignInButton,
  useClerk,
} from "@clerk/nextjs"; // Use Clerk's useUser for user management
// import { Button } from "./ui/button";
// import { Input } from "./ui/input";
import Image from "next/image";
import { usePathname } from "next/navigation";
// import { useActiveAccount } from "thirdweb/react";
import { signInWithCustomToken } from "firebase/auth";
import { useAuth } from "@clerk/nextjs"; // Add this line if it's missing
import EmojiPicker from "emoji-picker-react";
import "./Carousel.css";
import { useMusic } from "./MusicContext";

// Scramble text for signed-out users to tease chat content
const scrambleText = (text) => {
  if (typeof text !== 'string' || !text) return '';
  return text.split('').map(char => {
    if (char === ' ' || char === '!' || char === '?' || char === '.' || char === ',') return char;
    // Keep emojis intact
    if (char.charCodeAt(0) > 127) return char;
    const isUpper = char >= 'A' && char <= 'Z';
    const isLower = char >= 'a' && char <= 'z';
    if (isUpper) return String.fromCharCode(65 + Math.floor(Math.random() * 26));
    if (isLower) return String.fromCharCode(97 + Math.floor(Math.random() * 26));
    if (char >= '0' && char <= '9') return String.fromCharCode(48 + Math.floor(Math.random() * 10));
    return char;
  }).join('');
};

// Sanitize user input to prevent any injection attempts
const sanitizeMessage = (input, blockUrls = false) => {
  if (typeof input !== 'string') return '';
  let sanitized = input
    .trim()
    .slice(0, 200) // Hard limit
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers

  if (blockUrls) {
    // Remove URLs (http, https, www, and common TLDs)
    sanitized = sanitized
      .replace(/https?:\/\/[^\s]+/gi, '[link removed]')
      .replace(/www\.[^\s]+/gi, '[link removed]')
      .replace(/[^\s]+\.(com|org|net|io|co|gg|xyz|me|info|dev|app)[^\s]*/gi, '[link removed]')
      .replace(/discord\.(gg|com)[^\s]*/gi, '[link removed]')
      .replace(/t\.me[^\s]*/gi, '[link removed]');
  }

  return sanitized;
};

// Validate image URLs to only allow safe sources
const sanitizeImageUrl = (url, fallback = '/defaultAvatar.png') => {
  if (typeof url !== 'string' || !url) return fallback;
  try {
    const parsed = new URL(url);
    // Only allow https and specific trusted domains
    const trustedDomains = [
      'clerk.com',
      'img.clerk.com',
      'images.clerk.dev',
      'gravatar.com',
      'githubusercontent.com',
      'googleusercontent.com',
      'lh3.googleusercontent.com',
      'platform-lookaside.fbsbx.com',
      'pbs.twimg.com',
      'api.dicebear.com' // For debug mock avatars
    ];
    if (parsed.protocol !== 'https:') return fallback;
    const isTrusted = trustedDomains.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    );
    return isTrusted ? url : fallback;
  } catch {
    return fallback;
  }
};

// Styled popup component
const StyledPopup = ({ message, onClose, onConfirm }) => {
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          // backgroundColor: "rgba(0, 0, 0, 0.6)",
          zIndex: 9998,
          backdropFilter: "blur(4px)",
        }}
      />
      {/* Popup */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "linear-gradient(145deg, rgba(27, 23, 36, 0.98), rgba(45, 35, 55, 0.98))",
          border: "2px solid #d4af37",
          borderRadius: "16px",
          padding: "1.5rem 2rem",
          zIndex: 9999,
          maxWidth: "320px",
          width: "90%",
          minWidth: "12rem",
          textAlign: "center",
          boxShadow: "0 0 30px rgba(212, 175, 55, 0.3), 0 10px 40px rgba(0, 0, 0, 0.5)",
        }}
      >
        <p
          style={{
            color: "rgba(255, 255, 255, 0.9)",
            fontSize: "1rem",
            lineHeight: 1.5,
            margin: "0 0 1.25rem 0",
            fontFamily: "Roboto, sans-serif",
          }}
        >
          {message}
        </p>
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
          }}
        >
          {onConfirm && (
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              style={{
                padding: "8px 24px",
                background: "linear-gradient(135deg, #d4af37, #b8962e)",
                border: "none",
                borderRadius: "20px",
                color: "#1b1724",
                fontWeight: "bold",
                fontSize: "0.9rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 10px rgba(212, 175, 55, 0.3)",
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "scale(1.05)";
                e.target.style.boxShadow = "0 4px 15px rgba(212, 175, 55, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "scale(1)";
                e.target.style.boxShadow = "0 2px 10px rgba(212, 175, 55, 0.3)";
              }}
            >
              Yes
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: "8px 24px",
              background: onConfirm ? "transparent" : "linear-gradient(135deg, #d4af37, #b8962e)",
              border: onConfirm ? "1px solid rgba(255, 255, 255, 0.3)" : "none",
              borderRadius: "20px",
              color: onConfirm ? "rgba(255, 255, 255, 0.8)" : "#1b1724",
              fontWeight: "bold",
              fontSize: "0.9rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: onConfirm ? "none" : "0 2px 10px rgba(212, 175, 55, 0.3)",
            }}
            onMouseEnter={(e) => {
              if (onConfirm) {
                e.target.style.borderColor = "rgba(255, 255, 255, 0.6)";
                e.target.style.color = "#fff";
              } else {
                e.target.style.transform = "scale(1.05)";
                e.target.style.boxShadow = "0 4px 15px rgba(212, 175, 55, 0.5)";
              }
            }}
            onMouseLeave={(e) => {
              if (onConfirm) {
                e.target.style.borderColor = "rgba(255, 255, 255, 0.3)";
                e.target.style.color = "rgba(255, 255, 255, 0.8)";
              } else {
                e.target.style.transform = "scale(1)";
                e.target.style.boxShadow = "0 2px 10px rgba(212, 175, 55, 0.3)";
              }
            }}
          >
            {onConfirm ? "No" : "OK"}
          </button>
        </div>
      </div>
    </>
  );
};

const Carousel = ({ images, setCarouselLoaded, onRidingChange }) => {
  const [loadedImages, setLoadedImages] = useState(new Set());
  const [visibleImagesLoaded, setVisibleImagesLoaded] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const { isSignedIn, user, isLoaded } = useUser();
  const { openSignIn } = useClerk();
  const { getToken } = useAuth();
  const [lastMessageTime, setLastMessageTime] = useState(0); // Rate limiting

  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [riders, setRiders] = useState({});
  const [isRideConfirmationOpen, setIsRideConfirmationOpen] = useState(false);
  const [messages, setMessages] = useState({});
  const [newMessage, setNewMessage] = useState("");
  const [activeBeastId, setActiveBeastId] = useState(null);
  const [isRiding, setIsRiding] = useState(false);
  const [hasRidden, setHasRidden] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [rideActive, setRideActive] = useState(true);
  const [popupMessage, setPopupMessage] = useState("");
  const pathname = usePathname();
  const currentPath = pathname || "/";
  const MAX_MESSAGE_LENGTH = 80;

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const wasSignedInRef = useRef(false);

  // DJ Mode state
  const { currentTrack, isPlaying, is80sMode, loadTrackByPath, audioRef: musicAudioRef } = useMusic();
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [listeningToBeast, setListeningToBeast] = useState(null);
  const [listeningToName, setListeningToName] = useState(null);
  const djListenerUnsubRef = useRef(null);

  // Notify parent when riding state changes
  useEffect(() => {
    if (onRidingChange) {
      onRidingChange(isRiding);
    }
    if (isRiding) {
      setHasRidden(true);
    }
  }, [isRiding, onRidingChange]);

  const handleImageLoad = (src) => {
    setLoadedImages((prev) => {
      const newSet = new Set(prev);
      newSet.add(src);

      // Check if all images are loaded
      if (newSet.size === images.length) {
        console.log("✅ All images loaded successfully");
        setInitialLoadComplete(true);

        // Add a small delay to ensure images are actually visible
        setTimeout(() => {
          setVisibleImagesLoaded(true);
          if (setCarouselLoaded) {
            setCarouselLoaded(true);
          }
        }, 500);
      }

      return newSet;
    });
  };

  const handleImageError = (src) => {
    console.error(`❌ Failed to load image: ${src}`);
    handleImageLoad(src); // Count failed loads to prevent loader from hanging
  };

  useEffect(() => {
    const controller = new AbortController();

    const preloadImages = async () => {
      try {
        console.log(`🔄 Preloading ${images.length} carousel images...`);
        const imageLoadPromises = images.map((image) => {
          return new Promise((resolve, reject) => {
            const img = new window.Image(); // Use window.Image explicitly
            img.onload = () => {
              handleImageLoad(image.src);
              resolve();
            };
            img.onerror = () => {
              handleImageError(image.src);
              resolve(); // Resolve anyway to prevent hanging
            };
            img.src = image.src;
          });
        });

        await Promise.all(imageLoadPromises);
        console.log("✅ All carousel images preloaded");
      } catch (error) {
        console.error("Error preloading images:", error);
        setInitialLoadComplete(true);
        setVisibleImagesLoaded(true);
        if (setCarouselLoaded) {
          setCarouselLoaded(true);
        }
      }
    };

    preloadImages();

    return () => {
      controller.abort();
      setCarouselLoaded(false);
    };
  }, [images]);

  const handleEmojiClick = (emojiObject) => {
    setNewMessage((prevMessage) => {
      const updatedMessage = prevMessage + emojiObject.emoji;
      return updatedMessage.slice(0, MAX_MESSAGE_LENGTH); // Enforce max length
    });
    setShowEmojiPicker(false); // Close picker after selecting an emoji
  };

  const handleClickOutside = (event) => {
    if (
      emojiPickerRef.current &&
      !emojiPickerRef.current.contains(event.target)
    ) {
      setShowEmojiPicker(false); // Close the picker if clicked outside
    }
  };

  useEffect(() => {
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);
  // Trigger setCarouselLoaded when all images are loaded

  const signIntoFirebase = async () => {
    try {
      const token = await getToken({ template: "integration_firebase" });

      const userCredentials = await signInWithCustomToken(auth, token);

      setFirebaseUser(userCredentials.user);
      return userCredentials.user;
    } catch (error) {
      console.error("Error signing into Firebase:", error);
      return null;
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn && user && !firebaseUser) {
      signIntoFirebase().then((firebaseUser) => {
        if (firebaseUser) {
          fetchUserProfile(firebaseUser.uid);
        } else {
          console.error("Failed to sign into Firebase");
        }
      });
    }
  }, [isLoaded, isSignedIn, user, firebaseUser]);

  // Clean up ride when user signs out
  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        wasSignedInRef.current = true;
      } else if (wasSignedInRef.current && activeBeastId) {
        // User was signed in but now isn't, and they have an active ride
        wasSignedInRef.current = false;

        const cleanupRideOnSignOut = async () => {
          try {
            const beastIdToCleanup = activeBeastId;
            const beastRef = doc(db, "carouselBeasts", beastIdToCleanup);
            await deleteDoc(beastRef);
            await deleteMessagesForBeast(beastIdToCleanup);
            await assignBeastFromWaitlist(beastIdToCleanup);

            // Reset local state
            setActiveBeastId(null);
            setIsRiding(false);
            setIsBroadcasting(false);
            stopListening();
            setMessages((prevMessages) => {
              const updatedMessages = { ...prevMessages };
              delete updatedMessages[beastIdToCleanup];
              return updatedMessages;
            });
            setNewMessage("");
          } catch (error) {
            console.error("Failed to cleanup ride on sign out:", error);
          }
        };

        cleanupRideOnSignOut();
      }
    }
  }, [isLoaded, isSignedIn, activeBeastId]);

  const fetchUserProfile = async (userId) => {
    try {
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);

      const userData = {
        userId,
        imageUrl: user.imageUrl || "./defaultAvatar.png",
        username: user.username || "Anonymous",
        email: user.emailAddresses[0]?.emailAddress || null,
        provider: user.provider || null,
        identifier: user.externalId || user.id,
      };

      if (!userDoc.exists()) {
        await setDoc(userDocRef, userData, { merge: true });
      } else {
        await setDoc(userDocRef, userData, { merge: true });
      }
      setFirebaseUser(userData);
    } catch (error) {
      console.error("Error fetching or creating user profile:", error);
    }
  };

  const showPopupMessage = (
    message,
    onConfirm = null,
    onClose = handleClosePopup,
    showSingleButton = false
  ) => {
    setPopupMessage({ message, onConfirm, onClose, showSingleButton });
  };

  const handleClosePopup = () => setPopupMessage("");

  const promptWaitlistAddition = () => {
    showPopupMessage(
      "All beasts are occupied. Would you like to be added to the waitlist?",
      handleWaitlistAddition,
      handleClosePopup
    );
  };

  const handleWaitlistAddition = async () => {
    try {
      const waitlistRef = collection(db, "carouselWaitlist");
      const waitlistQuery = query(waitlistRef, where("userId", "==", user.id));
      const waitlistSnapshot = await getDocs(waitlistQuery);

      // if (!waitlistSnapshot.empty) {

      //   return;
      // }

      await addDoc(waitlistRef, {
        userId: user.id,
        username: user.username,
        imageUrl: user.imageUrl,
        timestamp: serverTimestamp(),
      });

      showPopupMessage(
        "You have been added to the waitlist. We will notify you when a beast is available. Please enjoy the Moon Room in the meantime.",
        null,
        handleClosePopup,
        true
      );
    } catch (error) {
      console.error("Failed to add user to the waitlist:", error);
      showPopupMessage(
        "An error occurred while adding you to the waitlist. Please try again.",
        null,
        handleClosePopup,
        true
      );
    }
  };
  const handleRideBeastClick = async (image, beastId) => {
    if (!isSignedIn) {
      openSignIn({ forceRedirectUrl: currentPath });
      return;
    }

    try {
      // Check if the selected beast is occupied
      const beastRef = doc(db, "carouselBeasts", beastId);
      const beastDoc = await getDoc(beastRef);

      if (beastDoc.exists() && beastDoc.data().userId) {
        const beastData = beastDoc.data();

        // If this beast is broadcasting, offer listen-along
        if (beastData.djTrackName) {
          showPopupMessage(
            `Listen along to ${beastData.username}'s music? Now playing: ${beastData.djTrackName}`,
            () => startListening(beastId, beastData.username)
          );
          return;
        }

        // Check if the user is already riding a beast
        const existingRidesQuery = query(
          collection(db, "carouselBeasts"),
          where("userId", "==", user.id)
        );
        const existingRidesSnapshot = await getDocs(existingRidesQuery);

        if (!existingRidesSnapshot.empty) {
          showPopupMessage("You are already riding another beast.");
          return;
        }

        // Fetch all beasts to check if any are available
        const beastsSnapshot = await getDocs(collection(db, "carouselBeasts"));
        if (beastsSnapshot.empty) {
          setRiders({});
          setActiveBeastId(null);
          setMessages({});
          return;
        }

        const availableBeast = beastsSnapshot.docs.find(
          (doc) => !doc.data().userId
        );

        if (!availableBeast) {
          promptWaitlistAddition();
        } else {
          showPopupMessage(
            "This beast is occupied. Please select an available beast."
          );
        }
        return;
      }

      // Check if the user is already riding a beast
      const existingRidesQuery = query(
        collection(db, "carouselBeasts"),
        where("userId", "==", user.id)
      );
      const existingRidesSnapshot = await getDocs(existingRidesQuery);

      if (!existingRidesSnapshot.empty) {
        showPopupMessage("You are already riding another beast.");
        return;
      }

      // If the selected beast is unoccupied, prompt to confirm the ride
      setSelectedImage({ ...image, beastId });
      setIsRideConfirmationOpen(true);
    } catch (error) {
      console.error("Error checking beast occupancy:", error);
      showPopupMessage("An error occurred. Please try again.");
    }
  };
  const loadMessages = (beastId) => {
    if (!beastId) {
      console.error("Invalid beastId provided to loadMessages");
      return () => {}; // Return a no-op cleanup function
    }

    const messagesQuery = query(
      collection(db, "carouselChat"),
      where("beastId", "==", beastId)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const beastMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Update the messages state
      setMessages((prevMessages) => ({
        ...prevMessages,
        [beastId]: beastMessages,
      }));
    });

    return () => {
      unsubscribe();
    };
  };

  const updateBeastChat = async (beastId, riderData, message = "") => {
    try {
      const beastChatRef = doc(db, "carouselChat", beastId);

      // Merge rider data and message
      await setDoc(
        beastChatRef,
        {
          beastId,
          ...riderData,
          message,
          timestamp: serverTimestamp(),
        },
        { merge: true } // Update existing fields, add new ones if missing
      );
    } catch (error) {
      console.error(`Failed to update chat for ${beastId}:`, error);
    }
  };
  const confirmRide = async () => {
    if (!user) {
      showPopupMessage("Please sign in to ride the beast.");
      return;
    }

    try {
      const beastId = selectedImage?.beastId;
      if (!beastId) {
        console.error("No beast ID selected.");
        return;
      }

      // Check if the user is already riding
      const existingRidesQuery = query(
        collection(db, "carouselBeasts"),
        where("userId", "==", user.id)
      );
      const existingRidesSnapshot = await getDocs(existingRidesQuery);

      if (!existingRidesSnapshot.empty) {
        showPopupMessage("You are already riding another beast.");
        return; // Exit early if the user is already riding
      }

      // Check if the selected beast is occupied
      const beastRef = doc(db, "carouselBeasts", beastId);
      const beastDoc = await getDoc(beastRef);

      if (beastDoc.exists() && beastDoc.data().userId) {
        showPopupMessage(
          "Beast is already occupied. Please choose another beast."
        );
        return;
      }

      const riderData = {
        userId: user.id,
        username: sanitizeMessage(user.username || "Anonymous").slice(0, 50),
        imageUrl: sanitizeImageUrl(user.imageUrl),
        timestamp: serverTimestamp(),
      };

      // Save the rider to Firestore
      await setDoc(beastRef, riderData);

      // Update state
      setActiveBeastId(beastId);
      setIsRiding(true);

      // Close the confirmation box
      setIsRideConfirmationOpen(false);
    } catch (error) {
      console.error("Failed to confirm ride:", error);
      showPopupMessage(error.message || "Failed to confirm ride.");
    }
  };
  useEffect(() => {
    const syncState = async () => {
      try {
        const ridersSnapshot = await getDocs(collection(db, "carouselBeasts"));
        const fetchedRiders = {};
        let userActiveBeast = null;

        ridersSnapshot.forEach((doc) => {
          const beastId = doc.id;
          const riderData = doc.data();
          if (riderData.userId) {
            fetchedRiders[beastId] = riderData;
          }

          if (user && riderData.userId === user.id) {
            userActiveBeast = beastId;
          }
        });

        setRiders(fetchedRiders);
        setActiveBeastId(userActiveBeast || null);
        setIsRiding(!!userActiveBeast);
      } catch (error) {
        console.error("Error syncing state with Firestore:", error);
      }
    };

    if (isLoaded && isSignedIn) syncState();
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!activeBeastId) return;

    const messagesQuery = query(
      collection(db, "carouselChat"),
      where("beastId", "==", activeBeastId)
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
      const newMessages = [];
      querySnapshot.forEach((doc) => {
        newMessages.push(doc.data());
      });

      setMessages((prevMessages) => ({
        ...prevMessages,
        [activeBeastId]: newMessages,
      }));
    });

    return () => {
      unsubscribeMessages();
    };
  }, [activeBeastId]);
  const RATE_LIMIT_MS = 2000; // 2 seconds between messages

  const handleSendMessage = async (beastId) => {
    const sanitizedMessage = sanitizeMessage(newMessage, true); // Block URLs
    if (!sanitizedMessage || sanitizedMessage === '[link removed]' || !user) {
      showPopupMessage("Please enter a message and ensure you are logged in.");
      return;
    }

    // Rate limiting
    const now = Date.now();
    if (now - lastMessageTime < RATE_LIMIT_MS) {
      showPopupMessage("Please wait a moment before sending another message.");
      return;
    }
    setLastMessageTime(now);

    try {
      const messageData = {
        beastId,
        message: sanitizedMessage.slice(0, MAX_MESSAGE_LENGTH),
        userId: user.id,
        username: sanitizeMessage(user.username || "Anonymous").slice(0, 50),
        imageUrl: sanitizeImageUrl(user.imageUrl),
        timestamp: serverTimestamp(),
      };

      // Use setDoc with beastId as the document ID to overwrite previous messages
      const messageRef = doc(db, "carouselChat", beastId);
      await setDoc(messageRef, messageData);

      setNewMessage(""); // Clear input
    } catch (error) {
      console.error("Failed to send message:", error);
      showPopupMessage("Failed to send the message. Please try again.");
    }
  };

  // Clear the current user's displayed message from their beast
  const clearBeastMessage = async (beastId) => {
    if (!beastId || !user) return;
    try {
      const messageRef = doc(db, "carouselChat", beastId);
      await deleteDoc(messageRef);

      setMessages((prevMessages) => {
        const updated = { ...prevMessages };
        delete updated[beastId];
        return updated;
      });
      setNewMessage("");
    } catch (error) {
      console.error("Failed to clear message:", error);
    }
  };

  const deleteMessagesForBeast = async (beastId) => {
    try {
      const messagesQuery = query(
        collection(db, "carouselChat"),
        where("beastId", "==", beastId)
      );

      const messagesSnapshot = await getDocs(messagesQuery);

      if (!messagesSnapshot.empty) {
        const batch = writeBatch(db);

        messagesSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
      } else {
        console.log(`No chat messages to delete for beastId: ${beastId}`);
      }
    } catch (error) {
      console.error(`Error deleting messages for beastId: ${beastId}`, error);
    }
  };
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const beastsSnapshot = await getDocs(collection(db, "carouselBeasts"));
        const maxRideTime = 10 * 60 * 1000; // 10 minutes in milliseconds
        const currentTime = Date.now();

        if (beastsSnapshot.empty) {
          // console.log("No active rides to process.");
          return;
        }

        for (const doc of beastsSnapshot.docs) {
          const rideData = doc.data();
          const rideStartTime = rideData.timestamp?.toMillis();

          if (!rideStartTime) {
            // console.warn(
            //   `Invalid rideStartTime for beast ${doc.id}. Skipping.`
            // );
            continue;
          }

          const elapsedTime = currentTime - rideStartTime;

          if (elapsedTime >= maxRideTime) {
            console.log(
              `Ride expired for beast: ${doc.id}. Deleting related data.`
            );

            // Delete beast document
            await deleteDoc(doc.ref);
            console.log(`Successfully deleted beast document: ${doc.id}`);

            // Delete associated chat messages
            await deleteMessagesForBeast(doc.id);

            // Update local state
            setRiders((prevRiders) => {
              const updatedRiders = { ...prevRiders };
              delete updatedRiders[doc.id];
              return updatedRiders;
            });

            setMessages((prevMessages) => {
              const updatedMessages = { ...prevMessages };
              delete updatedMessages[doc.id];
              return updatedMessages;
            });

            // If the expired ride matches the active beast, end the ride
            if (doc.id === activeBeastId) {
              setIsRiding(false);
              setActiveBeastId(null);
            }

            // Assign the beast to the next rider in the waitlist

            await assignBeastFromWaitlist(doc.id);
          }
        }
      } catch (error) {
        console.error("Error in ride expiration logic:", error);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [riders, activeBeastId]);
  useEffect(() => {
    if (!isRiding) {
      setActiveBeastId(null); // Clear the active beast
      setMessages({}); // Clear all messages
      setNewMessage(""); // Clear the input field
    }
  }, [isRiding]);

  // Handle real-time message updates
  useEffect(() => {
    const unsubscribes = images.map((_, index) => {
      const beastId = `beast${index + 1}`;
      const q = query(
        collection(db, "carouselChat"),
        where("beastId", "==", beastId)
      );
      return onSnapshot(q, (snapshot) => {
        const chatMessages = snapshot.docs.map((doc) => doc.data());
        setMessages((prevMessages) => ({
          ...prevMessages,
          [beastId]: chatMessages,
        }));
      });
    });

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [images]);

  const quitRide = async () => {
    if (!activeBeastId || !user) return;

    try {
      // Clear DJ state
      setIsBroadcasting(false);

      const beastRef = doc(db, "carouselBeasts", activeBeastId);

      await deleteDoc(beastRef); // Remove rider from Firestore
      await deleteMessagesForBeast(activeBeastId); // Remove messages
      await assignBeastFromWaitlist(activeBeastId); // Assign next user if needed

      // Reset local state
      setActiveBeastId(null);
      setIsRiding(false); // Ensure this is set to false
      setMessages((prevMessages) => {
        const updated = { ...prevMessages };
        delete updated[activeBeastId];
        return updated;
      });
    } catch (error) {
      console.error("Failed to quit the ride:", error);
      showPopupMessage("Error quitting the ride. Please try again.");
    }
  };

  const checkExistingRides = async () => {
    if (user) {
      try {
        const existingRidesQuery = query(
          collection(db, "carouselBeasts"),
          where("userId", "==", user.id)
        );
        const existingRidesSnapshot = await getDocs(existingRidesQuery);

        // Iterate through existing rides and delete them
        for (const rideDoc of existingRidesSnapshot.docs) {
          if (rideDoc.id !== activeBeastId) {
            // Skip active beast

            await deleteDoc(rideDoc.ref);
          }
        }

        // Update local state to reflect the changes
        setRiders((prevRiders) =>
          Object.fromEntries(
            Object.entries(prevRiders).map(([key, value]) =>
              value?.userId === user.id ? [key, null] : [key, value]
            )
          )
        );
      } catch (error) {
        console.error("Error checking existing rides:", error);
      }
    }
  };

  // const populateMockBeasts = async () => {
  //   try {
  //     const beastsCollection = collection(db, "carouselBeasts");

  //     // Fetch existing beast data
  //     const existingBeastsSnapshot = await getDocs(beastsCollection);
  //     const existingBeastIds = new Set(
  //       existingBeastsSnapshot.docs.map((doc) => doc.id)
  //     );

  //     const now = Date.now();
  //     const batch = writeBatch(db);

  //     for (let i = 0; i < 12; i++) {
  //       const beastId = `beast${i + 1}`; // Generate beast ID

  //       // Only create if the beast doesn't already exist in Firestore
  //       if (!existingBeastIds.has(beastId)) {
  //         batch.set(doc(beastsCollection, beastId), {
  //           userId: `mockUser${i + 1}`,
  //           username: `Mock Rider ${i + 1}`,
  //           imageUrl: `https://via.placeholder.com/50?text=Rider${i + 1}`,
  //           timestamp: new Date(now - (i + 1) * 60 * 1000), // Start times staggered by 1 minute
  //         });
  //       }
  //     }

  //     // Commit the batch operation
  //     await batch.commit();
  //     console.log("Mock beasts populated successfully.");
  //   } catch (error) {
  //     console.error("Error populating mock beasts:", error);
  //   }
  // };
  // const populateRemainingBeasts = async () => {
  //   try {
  //     const beastsCollection = collection(db, "carouselBeasts");

  //     // Define specific beast IDs for 10, 11, and 12
  //     const specificBeastIds = ["beast10", "beast11", "beast12"];

  //     // Fetch existing beast data
  //     const existingBeastsSnapshot = await getDocs(beastsCollection);
  //     const existingBeastIds = new Set(
  //       existingBeastsSnapshot.docs.map((doc) => doc.id)
  //     );

  //     const now = Date.now();
  //     batch.set(doc(beastsCollection, beastId), {
  //       userId: `mockUser${index + 10}`,
  //       username: `Mock Rider ${index + 10}`,
  //       imageUrl: `https://via.placeholder.com/50?text=Rider${index + 10}`,
  //       timestamp: new Date(now), // Use current time to prevent immediate expiration
  //     });

  //     await batch.commit();
  //     console.log("Beasts 10-12 populated successfully.");
  //   } catch (error) {
  //     console.error("Error populating beasts 10-12:", error);
  //   }
  // };

  // useEffect(() => {
  //   const initializeMockData = async () => {
  //     try {
  //       await populateMockBeasts();
  //       await populateRemainingBeasts();
  //       console.log("All mock riders populated successfully.");
  //     } catch (error) {
  //       console.error("Error initializing mock riders:", error);
  //     }
  //   };

  //   initializeMockData();
  // }, []);

  // useEffect(() => {
  //   const initializeMockData = async () => {
  //     try {
  //       await populateMockBeasts();
  //       console.log("Mock riders populated successfully.");
  //     } catch (error) {
  //       console.error("Error initializing mock riders:", error);
  //     }
  //   };

  //   initializeMockData();
  // }, []);

  const addToWaitlist = async (userId, username, imageUrl) => {
    try {
      // Check if user is already on the waitlist
      const waitlistRef = collection(db, "carouselWaitlist");
      const waitlistQuery = query(waitlistRef, where("userId", "==", userId));
      const waitlistSnapshot = await getDocs(waitlistQuery);

      if (!waitlistSnapshot.empty) {
        console.log("User is already on the waitlist:", username);
        return; // User is already on the waitlist, exit early
      }

      // Check if user is already riding
      const ridersRef = collection(db, "carouselBeasts");
      const ridersQuery = query(ridersRef, where("userId", "==", userId));
      const ridersSnapshot = await getDocs(ridersQuery);

      if (!ridersSnapshot.empty) {
        console.log("User is already riding:", username);
        return; // User is already riding, exit early
      }

      // Add user to the waitlist
      await addDoc(waitlistRef, {
        userId,
        username,
        imageUrl,
        timestamp: serverTimestamp(),
      });
      console.log("User added to waitlist:", username);
    } catch (error) {
      console.error("Failed to add user to waitlist:", error);
    }
  };

  const findAvailableBeast = () => {
    const occupiedBeasts = Object.keys(riders);
    for (let i = 1; i <= 12; i++) {
      const beastId = `beast${i}`;
      if (!occupiedBeasts.includes(beastId)) {
        return beastId;
      }
    }

    return null;
  };

  const assignBeastFromWaitlist = async () => {
    try {
      const waitlistRef = collection(db, "carouselWaitlist");
      const waitlistQuery = query(
        waitlistRef,
        orderBy("timestamp", "asc"),
        limit(1)
      );
      const snapshot = await getDocs(waitlistQuery);

      if (!snapshot.empty) {
        const nextUserDoc = snapshot.docs[0];
        const userData = nextUserDoc.data();

        const availableBeast = findAvailableBeast();
        if (availableBeast) {
          const beastRef = doc(db, "carouselBeasts", availableBeast);
          await setDoc(beastRef, {
            userId: userData.userId,
            username: userData.username,
            imageUrl: userData.imageUrl,
            timestamp: serverTimestamp(),
          });

          await deleteDoc(nextUserDoc.ref);

          console.log(
            `Assigned beast ${availableBeast} to user: ${userData.username}`
          );
        } else {
          console.log("No available beasts to assign.");
        }
      } else {
        console.log("Waitlist is empty.");
      }
    } catch (error) {
      console.error("Error assigning beast from waitlist:", error);
    }
  };
  const [waitlist, setWaitlist] = useState([]);
  const [allBeastsOccupied, setAllBeastsOccupied] = useState(false);
  const [globalChatMessages, setGlobalChatMessages] = useState([]);
  const [globalChatMessage, setGlobalChatMessage] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const globalChatRef = useRef(null);

  // DEBUG MODE - Uncomment to test Spectator Lounge when beasts aren't full
  // Press Ctrl+Shift+F to toggle
  // const [debugForceFullCarousel, setDebugForceFullCarousel] = useState(false);
  // const debugMockMessages = [
  //   { id: 'mock1', username: 'CryptoKing', message: 'Waiting for my turn! 🎠', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CryptoKing' },
  //   { id: 'mock2', username: 'MoonRider', message: 'This carousel is wild!', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MoonRider' },
  //   { id: 'mock3', username: 'HODLer99', message: 'When lambo? 😂', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=HODLer99' },
  //   { id: 'mock4', username: 'DiamondHands', message: 'Love watching the beasts go round', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DiamondHands' },
  // ];
  // useEffect(() => {
  //   const handleDebugKey = (e) => {
  //     if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
  //       setDebugForceFullCarousel(prev => {
  //         const newState = !prev;
  //         console.log(`[DEBUG] Full carousel mode: ${newState ? 'ON' : 'OFF'}`);
  //         if (newState) {
  //           setGlobalChatMessages(debugMockMessages);
  //         } else {
  //           setGlobalChatMessages([]);
  //         }
  //         return newState;
  //       });
  //     }
  //   };
  //   window.addEventListener('keydown', handleDebugKey);
  //   return () => window.removeEventListener('keydown', handleDebugKey);
  // }, []);

  const calculateWaitTime = (position) => {
    if (position === 1) {
      const rideDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
      const now = Date.now();

      const activeRiders = Object.values(riders).filter(
        (r) => r && r.timestamp && typeof r.timestamp.toMillis === "function"
      );

      if (activeRiders.length > 0) {
        const nextExpiringRider = activeRiders.reduce((prev, curr) =>
          prev.timestamp.toMillis() < curr.timestamp.toMillis() ? prev : curr
        );

        const elapsedTime = now - nextExpiringRider.timestamp.toMillis();
        const timeLeft = rideDuration - elapsedTime;

        if (timeLeft > 0) {
          const minutes = Math.floor(timeLeft / (1000 * 60));
          const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
          return `${minutes}m ${seconds}s`;
        } else {
          return "Time expired"; // Indicate wait time is over
        }
      }
      return "0m 0s"; // Fallback for no active riders
    }

    const approximateWait = (position - 1) * 10 * 60 * 1000; // Add 10 minutes for each additional position
    const minutes = Math.floor(approximateWait / (1000 * 60));
    const seconds = Math.floor((approximateWait % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
  };
  useEffect(() => {
    console.log("Active riders:", riders);
    console.log("Waitlist:", waitlist);
  }, [riders, waitlist]);

  // Check if all 12 beasts are occupied
  useEffect(() => {
    const occupiedCount = Object.keys(riders).filter(
      (beastId) => riders[beastId]?.userId
    ).length;
    setAllBeastsOccupied(occupiedCount >= 12);
  }, [riders]);

  // Listen to global chat messages
  useEffect(() => {
    const globalChatQuery = query(
      collection(db, "globalChat"),
      orderBy("timestamp", "asc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(globalChatQuery, (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGlobalChatMessages(messages);
    });

    return () => unsubscribe();
  }, []);

  // Auto-scroll global chat to bottom
  useEffect(() => {
    if (globalChatRef.current) {
      globalChatRef.current.scrollTop = globalChatRef.current.scrollHeight;
    }
  }, [globalChatMessages]);

  // Cleanup old global chat messages (older than 1 hour)
  const cleanupOldGlobalMessages = async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const oldMessagesQuery = query(
        collection(db, "globalChat"),
        where("timestamp", "<", oneHourAgo)
      );
      const snapshot = await getDocs(oldMessagesQuery);

      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Cleaned up ${snapshot.size} old global chat messages`);
      }
    } catch (error) {
      console.error("Error cleaning up old messages:", error);
    }
  };

  // Run cleanup periodically (every 5 minutes)
  useEffect(() => {
    cleanupOldGlobalMessages(); // Run on mount
    const cleanupInterval = setInterval(cleanupOldGlobalMessages, 5 * 60 * 1000);
    return () => clearInterval(cleanupInterval);
  }, []);

  // Send message to global chat
  const handleSendGlobalMessage = async () => {
    const sanitizedMessage = sanitizeMessage(globalChatMessage, true); // Block URLs
    if (!sanitizedMessage || sanitizedMessage === '[link removed]' || !user) return;

    // Rate limiting
    const now = Date.now();
    if (now - lastMessageTime < RATE_LIMIT_MS) {
      return; // Silently ignore for global chat
    }
    setLastMessageTime(now);

    try {
      await addDoc(collection(db, "globalChat"), {
        message: sanitizedMessage.slice(0, 200),
        userId: user.id,
        username: sanitizeMessage(user.username || "Anonymous").slice(0, 50),
        imageUrl: sanitizeImageUrl(user.imageUrl),
        timestamp: serverTimestamp(),
      });
      setGlobalChatMessage("");
    } catch (error) {
      console.error("Failed to send global message:", error);
    }
  };

  // Track user's position in waitlist
  const [userQueuePosition, setUserQueuePosition] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const prevQueuePositionRef = useRef(null);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === 'granted';
    }
    return false;
  };

  const sendNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/horse-shoe-transparent.png',
        tag: 'carousel-notification',
      });
    }
  };

  // Leave the waitlist
  const leaveWaitlist = async () => {
    if (!user) return;
    try {
      const waitlistRef = collection(db, "carouselWaitlist");
      const waitlistQuery = query(waitlistRef, where("userId", "==", user.id));
      const snapshot = await getDocs(waitlistQuery);

      if (!snapshot.empty) {
        await deleteDoc(snapshot.docs[0].ref);
        console.log("User left the waitlist");
      }
    } catch (error) {
      console.error("Failed to leave waitlist:", error);
    }
  };

  // Report a message
  const [reportedMessages, setReportedMessages] = useState(new Set());

  const reportMessage = async (message, chatType) => {
    if (!user || !message) return;

    // Check if already reported by this user
    if (reportedMessages.has(message.id)) {
      showPopupMessage("You've already reported this message.");
      return;
    }

    try {
      await addDoc(collection(db, "chatReports"), {
        reporterId: user.id,
        reporterUsername: user.username || "Anonymous",
        reportedUserId: message.userId,
        reportedUsername: message.username,
        messageContent: message.message,
        messageId: message.id || null,
        chatType: chatType, // 'beast' or 'global'
        timestamp: serverTimestamp(),
        status: 'pending', // pending, reviewed, dismissed
      });

      setReportedMessages(prev => new Set([...prev, message.id]));
      showPopupMessage("Report submitted. Thank you for keeping the community safe.");
    } catch (error) {
      console.error("Failed to submit report:", error);
      showPopupMessage("Failed to submit report. Please try again.");
    }
  };

  useEffect(() => {
    const waitlistRef = collection(db, "carouselWaitlist");
    const waitlistQuery = query(waitlistRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(waitlistQuery, (snapshot) => {
      const queue = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setWaitlist(queue);

      // Find user's position in queue
      if (user) {
        const position = queue.findIndex(item => item.userId === user.id);
        const newPosition = position >= 0 ? position + 1 : null;

        // Check if user just got assigned (was in queue, now riding)
        if (prevQueuePositionRef.current === 1 && newPosition === null && isRiding) {
          sendNotification("Your beast is ready!", "Enjoy your 10-minute ride on the carousel!");
        }

        setUserQueuePosition(newPosition);
        prevQueuePositionRef.current = newPosition;
      }
    });

    return () => unsubscribe();
  }, [user, isRiding]);
  const [waitTimes, setWaitTimes] = useState([]);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const beastsSnapshot = await getDocs(collection(db, "carouselBeasts"));
        const maxRideTime = 10 * 60 * 1000; // 10 minutes in milliseconds
        const currentTime = Date.now();

        if (beastsSnapshot.empty) {
          // console.log("No active rides to process.");
          return;
        }

        for (const doc of beastsSnapshot.docs) {
          const rideData = doc.data();
          const rideStartTime = rideData.timestamp?.toMillis();

          if (!rideStartTime) {
            // Skip silently - this happens briefly after ride creation
            // while serverTimestamp() is still being resolved by Firestore
            continue;
          }

          const elapsedTime = currentTime - rideStartTime;

          if (elapsedTime >= maxRideTime) {
            console.log(`Ride expired. Deleting beast ${doc.id} and messages.`);

            try {
              await deleteDoc(doc.ref);
              console.log(`Successfully deleted beast ${doc.id}`);
            } catch (error) {
              console.error(`Failed to delete beast ${doc.id}:`, error);
              continue; // Skip to next iteration
            }

            try {
              await deleteMessagesForBeast(doc.id);
            } catch (error) {
              console.error(
                `Failed to delete messages for beast ${doc.id}:`,
                error
              );
            }

            setRiders((prevRiders) => {
              const updatedRiders = { ...prevRiders };
              delete updatedRiders[doc.id];
              return updatedRiders;
            });

            setMessages((prevMessages) => {
              const updatedMessages = { ...prevMessages };
              delete updatedMessages[doc.id];
              return updatedMessages;
            });

            console.log("Attempting to assign from waitlist...");
            await assignBeastFromWaitlist(doc.id);
          }
        }
      } catch (error) {
        console.error("Error in ride expiration logic:", error);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [riders]);
  useEffect(() => {
    if (!activeBeastId || !riders[activeBeastId]?.timestamp) {
      setTimeRemaining(null); // No active rider or invalid timestamp
      return;
    }

    const intervalId = setInterval(() => {
      const rideDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
      const now = Date.now();
      const startTime = riders[activeBeastId]?.timestamp?.toMillis();

      if (!startTime) {
        setTimeRemaining("Invalid start time");
        return;
      }

      const elapsedTime = now - startTime;
      const remainingTime = rideDuration - elapsedTime;

      if (remainingTime > 0) {
        const minutes = Math.floor(remainingTime / (1000 * 60));
        const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining("Time expired");
        // Handle expiration logic here
      }
    }, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, [activeBeastId, riders]);
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "carouselBeasts"),
      (snapshot) => {
        if (snapshot.empty) {
          console.log("No beasts found in Firestore.");
          setRiders({});
          // If no beasts exist and user was riding, end their ride
          if (isRiding) {
            setIsRiding(false);
            setActiveBeastId(null);
          }
          return;
        }

        const updatedRiders = {};
        let userStillRiding = false;

        snapshot.forEach((doc) => {
          const data = doc.data();
          updatedRiders[doc.id] = data;

          // Check if current user is still riding
          if (user && data.userId === user.id) {
            userStillRiding = true;
          }
        });

        // If user was riding but their beast is no longer in the list, end their ride
        if (isRiding && !userStillRiding) {
          console.log("User's ride ended - beast no longer exists");
          setIsRiding(false);
          setActiveBeastId(null);
          setMessages({});
        }

        console.log("Updated riders from Firestore:", updatedRiders);
        setRiders(updatedRiders);
      }
    );

    return () => unsubscribe();
  }, [user, isRiding]);
  const handleCloseChatBox = () => {
    if (rideActive) {
      // Show a confirmation popup only if the ride is still active
      showPopupMessage("Are you sure you want to end the ride?", () => {
        quitRide(); // Quit the ride if confirmed
        setIsRiding(false); // Ensure the state is updated correctly
        setActiveBeastId(null);
      });
    } else {
      // Directly close the chat box if the ride has ended
      setIsRiding(false);
      setActiveBeastId(null);
    }
  };
  const handleImageClick = (image, beastId) => {
    setSelectedImage({ ...image, beastId });
    setIsRideConfirmationOpen(true); // Open the ride confirmation prompt
  };

  useEffect(() => {
    const unsubscribeSnapshots = images.map((_, index) => {
      const beastId = `beast${index + 1}`;
      const beastRef = doc(db, "carouselBeasts", beastId);
      return onSnapshot(beastRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          setRiders((prevRiders) => ({
            ...prevRiders,
            [beastId]: docSnapshot.data(),
          }));
        }
      });
    });

    return () => unsubscribeSnapshots.forEach((unsub) => unsub());
  }, [images]);

  // === DJ MODE: Broadcast effects ===

  // Auto-update Firestore when DJ's track changes
  useEffect(() => {
    if (!isBroadcasting || !activeBeastId || !currentTrack) return;
    const beastRef = doc(db, "carouselBeasts", activeBeastId);
    updateDoc(beastRef, {
      djTrackPath: currentTrack.path,
      djTrackName: currentTrack.name,
      djTrackBPM: currentTrack.bpm || 100,
      djIs80sMode: is80sMode,
      djStartedAt: serverTimestamp(),
      djIsPlaying: isPlaying,
    }).catch((err) => console.error("[DJ] Failed to update track:", err));
  }, [currentTrack?.path, isBroadcasting, activeBeastId]);

  // Separate effect for play/pause only (avoids resetting djStartedAt)
  useEffect(() => {
    if (!isBroadcasting || !activeBeastId || !currentTrack) return;
    const beastRef = doc(db, "carouselBeasts", activeBeastId);
    if (isPlaying) {
      updateDoc(beastRef, {
        djIsPlaying: true,
        djStartedAt: serverTimestamp(),
      }).catch((err) => console.error("[DJ] Failed to update play state:", err));
    } else {
      updateDoc(beastRef, { djIsPlaying: false }).catch((err) =>
        console.error("[DJ] Failed to update pause state:", err)
      );
    }
  }, [isPlaying, isBroadcasting, activeBeastId]);

  // Toggle broadcasting on/off
  const toggleBroadcast = async () => {
    if (!activeBeastId) return;
    const beastRef = doc(db, "carouselBeasts", activeBeastId);

    if (isBroadcasting) {
      // Turn OFF broadcasting — remove DJ fields
      try {
        await updateDoc(beastRef, {
          djTrackPath: deleteField(),
          djTrackName: deleteField(),
          djTrackBPM: deleteField(),
          djIs80sMode: deleteField(),
          djStartedAt: deleteField(),
          djIsPlaying: deleteField(),
        });
      } catch (err) {
        console.error("[DJ] Failed to clear DJ fields:", err);
      }
      setIsBroadcasting(false);
    } else {
      // Turn ON broadcasting
      if (!currentTrack || !isPlaying) {
        showPopupMessage("Start playing music first, then share it!");
        return;
      }
      try {
        await updateDoc(beastRef, {
          djTrackPath: currentTrack.path,
          djTrackName: currentTrack.name,
          djTrackBPM: currentTrack.bpm || 100,
          djIs80sMode: is80sMode,
          djStartedAt: serverTimestamp(),
          djIsPlaying: true,
        });
        setIsBroadcasting(true);
      } catch (err) {
        console.error("[DJ] Failed to start broadcasting:", err);
      }
    }
  };

  // Clear DJ fields when ride ends (quitRide already clears the doc, but handle other cases)
  useEffect(() => {
    if (!isRiding && isBroadcasting) {
      setIsBroadcasting(false);
    }
  }, [isRiding]);

  // === DJ MODE: Listen-along functions ===

  const stopListening = () => {
    if (djListenerUnsubRef.current) {
      djListenerUnsubRef.current();
      djListenerUnsubRef.current = null;
    }
    setListeningToBeast(null);
    setListeningToName(null);
  };

  const startListening = (beastId, riderName) => {
    // Clean up any existing listener
    stopListening();

    const beastRef = doc(db, "carouselBeasts", beastId);
    let lastTrackPath = null;

    const unsub = onSnapshot(beastRef, (snapshot) => {
      if (!snapshot.exists()) {
        // Beast doc deleted — DJ's ride ended
        showPopupMessage(`${riderName}'s DJ session ended`);
        stopListening();
        return;
      }

      const data = snapshot.data();
      if (!data.djTrackPath) {
        // DJ stopped broadcasting
        showPopupMessage(`${riderName}'s DJ session ended`);
        stopListening();
        return;
      }

      // Track changed — load new track
      if (data.djTrackPath !== lastTrackPath) {
        lastTrackPath = data.djTrackPath;
        let seekSeconds = 0;
        if (data.djStartedAt && typeof data.djStartedAt.toMillis === "function") {
          seekSeconds = (Date.now() - data.djStartedAt.toMillis()) / 1000;
          if (seekSeconds < 0) seekSeconds = 0;
        }
        loadTrackByPath(data.djTrackPath, data.djTrackName, data.djTrackBPM || 100, seekSeconds);
      } else {
        // Same track — handle play/pause
        if (musicAudioRef?.current) {
          if (data.djIsPlaying && musicAudioRef.current.paused) {
            // Re-seek on resume
            let seekSeconds = 0;
            if (data.djStartedAt && typeof data.djStartedAt.toMillis === "function") {
              seekSeconds = (Date.now() - data.djStartedAt.toMillis()) / 1000;
              if (seekSeconds < 0) seekSeconds = 0;
            }
            if (seekSeconds > 0 && isFinite(seekSeconds) && musicAudioRef.current.duration) {
              musicAudioRef.current.currentTime = Math.min(seekSeconds, musicAudioRef.current.duration);
            }
            musicAudioRef.current.play().catch(() => {});
          } else if (!data.djIsPlaying && !musicAudioRef.current.paused) {
            musicAudioRef.current.pause();
          }
        }
      }
    });

    djListenerUnsubRef.current = unsub;
    setListeningToBeast(beastId);
    setListeningToName(riderName);
  };

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (djListenerUnsubRef.current) {
        djListenerUnsubRef.current();
      }
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        position: "relative",
        flex: 1,
        minHeight: 0,
        width: "100%",
      }}
    >
      <div className="beast-carousel-container">
        <main>
          <div
            id="carousel"
            style={{
              "--rotation-time": "30s",
              "--elements": images.length,
              animationPlayState: isHovered ? "paused" : "running",
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {images.map((image, index) => {
              const beastId = `beast${index + 1}`;
              const rider = riders[beastId];
              const beastMessages = messages[beastId] || [];
              const isEven = index % 2 === 1;

              return (
                <div
                  key={beastId}
                  className={`element${rider ? " has-rider" : ""}`}
                  data-item={isEven ? "logo" : ""}
                  style={{ position: "absolute", "--item": index + 1 }}
                >
                  {isEven && ((Math.floor(index / 2) % 2 === 0 && !hasRidden) || (Math.floor(index / 2) % 2 === 1 && !isSignedIn)) && (
                    <div className="marquee-overlay">
                      <span>{Math.floor(index / 2) % 2 === 0
                        ? "CLICK ANY AVAILABLE BEAST TO CHAT WHILE RIDING"
                        : "MUST BE LOGGED IN TO RIDE AND DECRYPT MESSAGES"}</span>
                    </div>
                  )}
                  {rider && (
                    <div className="marquee-overlay">
                      <span>
                        {isSignedIn ? rider.username : scrambleText(rider.username)}
                      </span>
                    </div>
                  )}
                  <div className="element2">
                    <div className="rider-beast-group">
                      <div
                        className="beast"
                        style={{ backgroundImage: `url(${image.src})` }}
                        onClick={() => handleRideBeastClick(image, beastId)}
                      >
                        {rider && (
                          <div className="rider-container">
                            <p className="rider-name rider-name-hidden">{isSignedIn ? rider.username : scrambleText(rider.username)}</p>
                            <img
                              src={sanitizeImageUrl(rider.imageUrl)}
                              alt={rider.username || "Rider"}
                              className="rider-avatar"
                            />
                            {rider.djTrackName && (
                              <div style={{
                                position: "absolute",
                                bottom: "-18px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                                background: "rgba(0, 0, 0, 0.85)",
                                border: "1px solid rgba(212, 175, 55, 0.5)",
                                borderRadius: "8px",
                                padding: "1px 6px",
                                whiteSpace: "nowrap",
                                maxWidth: "120px",
                              }}>
                                <span style={{ fontSize: "10px" }}>♪</span>
                                <span style={{
                                  fontSize: "8px",
                                  color: "#d4af37",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}>
                                  {rider.djTrackName.length > 16
                                    ? rider.djTrackName.slice(0, 16) + "…"
                                    : rider.djTrackName}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {beastMessages.length > 0 && (
                        <div className="speech-container">
                          <div className="speech">
                            <p>
                              {isSignedIn
                                ? beastMessages[beastMessages.length - 1].message
                                : scrambleText(beastMessages[beastMessages.length - 1].message)}
                            </p>
                          </div>
                        </div>
                      )}
                      <img
                        src={image.src}
                        alt={image.title}
                        onLoad={handleImageLoad}
                        onError={() => handleImageError(image.src)} // Catch failed loads
                        style={{ display: "none" }} // Hidden from view
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedImage && isRideConfirmationOpen && (
            <div>
              {/* Overlay div */}
              <div
                className="clickable-overlay"
                onClick={() => setIsRideConfirmationOpen(false)} // Close pop-up when clicking outside
                style={{
                  position: "fixed",
                  top: "-25rem",
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  zIndex: 999,
                }}
              ></div>

              {/* Pop-up box */}
              <div
                style={{
                  background: "linear-gradient(145deg, rgba(27, 23, 36, 0.98), rgba(45, 35, 55, 0.98))",
                  border: "2px solid #d4af37",
                  position: "absolute",
                  padding: "1.5rem 2rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.75rem",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 1000,
                  textAlign: "center",
                  borderRadius: "16px",
                  boxShadow: "0 0 30px rgba(212, 175, 55, 0.3), 0 10px 40px rgba(0, 0, 0, 0.5)",
                  backdropFilter: "blur(10px)",
                  minWidth: "200px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  style={{
                    fontFamily: "Oleo Script, cursive",
                    fontSize: "1.5rem",
                    color: "#d4af37",
                    margin: 0,
                    textShadow: "0 0 10px rgba(212, 175, 55, 0.4)",
                  }}
                >
                  {selectedImage.title}
                </h2>
                <div
                  style={{
                    padding: "0.5rem",
                    borderRadius: "12px",
                    border: "1px solid rgba(212, 175, 55, 0.3)",
                    background: "rgba(0, 0, 0, 0.2)",
                  }}
                >
                  <Image
                    src={selectedImage.src}
                    alt={selectedImage.title}
                    width={80}
                    height={80}
                    style={{
                      objectFit: "contain",
                    }}
                  />
                </div>
                <p
                  style={{
                    color: "rgba(255, 255, 255, 0.9)",
                    fontSize: "1rem",
                    margin: 0,
                    fontFamily: "Roboto, sans-serif",
                  }}
                >
                  Ride this beast?
                </p>
                <div
                  style={{
                    marginTop: "0.5rem",
                    display: "flex",
                    gap: "12px",
                    justifyContent: "center",
                  }}
                >
                  <button
                    onClick={confirmRide}
                    style={{
                      padding: "8px 24px",
                      background: "linear-gradient(135deg, #d4af37, #b8962e)",
                      border: "none",
                      borderRadius: "20px",
                      color: "#1b1724",
                      fontWeight: "bold",
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 10px rgba(212, 175, 55, 0.3)",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = "scale(1.05)";
                      e.target.style.boxShadow = "0 4px 15px rgba(212, 175, 55, 0.5)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = "scale(1)";
                      e.target.style.boxShadow = "0 2px 10px rgba(212, 175, 55, 0.3)";
                    }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setIsRideConfirmationOpen(false)}
                    style={{
                      padding: "8px 24px",
                      background: "transparent",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      borderRadius: "20px",
                      color: "rgba(255, 255, 255, 0.8)",
                      fontWeight: "bold",
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = "rgba(255, 255, 255, 0.6)";
                      e.target.style.color = "#fff";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = "rgba(255, 255, 255, 0.3)";
                      e.target.style.color = "rgba(255, 255, 255, 0.8)";
                    }}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {isRiding && activeBeastId && typeof document !== 'undefined' && createPortal(
          <div
            className="chat-box-container"
            style={{
              background: "linear-gradient(145deg, rgba(27, 23, 36, 0.98), rgba(45, 35, 55, 0.98))",
              border: "2px solid #d4af37",
              padding: "0.75rem 1rem",
              position: "fixed",
              zIndex: 9999,
              fontSize: "12px",
              width: "min(320px, calc(100vw - 2rem))",
              left: "50%",
              transform: "translateX(-50%)",
              top: "auto",
              bottom: "1rem",
              maxHeight: "45vh",
              overflowY: "auto",
              borderRadius: "16px",
              boxShadow: "0 0 30px rgba(212, 175, 55, 0.3), 0 10px 40px rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(10px)",
            }}
          >
            {/* Close button */}
            <button
              onClick={handleCloseChatBox}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                fontSize: "18px",
                cursor: "pointer",
                color: "rgba(255, 255, 255, 0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "rgba(255, 255, 255, 0.2)";
                e.target.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(255, 255, 255, 0.1)";
                e.target.style.color = "rgba(255, 255, 255, 0.7)";
              }}
            >
              ×
            </button>

            {/* Header row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.5rem",
              }}
            >
              <h1
                style={{
                  fontFamily: "Oleo Script, cursive",
                  fontSize: "1rem",
                  color: "#d4af37",
                  margin: 0,
                  textShadow: "0 0 10px rgba(212, 175, 55, 0.4)",
                }}
              >
                Chat Box
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: "20px", paddingLeft: '10px' }}>
                <span
                  style={{
                    fontSize: "10px",
                    color: "rgba(255, 255, 255, 0.45)",
                  }}
                >
                  {newMessage.length}/{MAX_MESSAGE_LENGTH}
                </span>
                {messages[activeBeastId]?.length > 0 && (
                  <button
                    onClick={() => clearBeastMessage(activeBeastId)}
                    title="Clear displayed message"
                    style={{
                      fontSize: "9px",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255, 100, 100, 0.4)",
                      backgroundColor: "rgba(255, 100, 100, 0.1)",
                      color: "#ff6b6b",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "rgba(255, 100, 100, 0.25)";
                      e.target.style.borderColor = "rgba(255, 100, 100, 0.6)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "rgba(255, 100, 100, 0.1)";
                      e.target.style.borderColor = "rgba(255, 100, 100, 0.4)";
                    }}
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={toggleBroadcast}
                  title={isBroadcasting ? "Stop sharing music" : "Share your music"}
                  style={{
                    fontSize: "12px",
                    padding: "2px 8px",
                    borderRadius: "8px",
                    border: isBroadcasting
                      ? "1px solid #d4af37"
                      : "1px solid rgba(255, 255, 255, 0.3)",
                    backgroundColor: isBroadcasting
                      ? "rgba(212, 175, 55, 0.3)"
                      : "transparent",
                    color: isBroadcasting ? "#d4af37" : "rgba(255, 255, 255, 0.6)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: isBroadcasting ? "0 0 8px rgba(212, 175, 55, 0.4)" : "none",
                  }}
                >
                  {isBroadcasting ? "♪ DJ ON" : "♪ DJ"}
                </button>
                <span
                  style={{
                    fontSize: "10px",
                    color: "#d4af37",
                    background: "rgba(212, 175, 55, 0.1)",
                    padding: "1px 6px",
                    borderRadius: "8px",
                    border: "1px solid rgba(212, 175, 55, 0.3)",
                  }}
                >
                  ⏱ {timeRemaining}
                </span>
              </div>
            </div>

            {/* Listening along indicator */}
            {listeningToBeast && listeningToName && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(212, 175, 55, 0.15)",
                  border: "1px solid rgba(212, 175, 55, 0.3)",
                  borderRadius: "8px",
                  padding: "4px 8px",
                  marginBottom: "6px",
                  fontSize: "11px",
                }}
              >
                <span style={{ color: "#d4af37" }}>
                  ♪ Listening to {listeningToName}
                </span>
                <button
                  onClick={stopListening}
                  style={{
                    fontSize: "9px",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 100, 100, 0.4)",
                    backgroundColor: "rgba(255, 100, 100, 0.1)",
                    color: "#ff6b6b",
                    cursor: "pointer",
                  }}
                >
                  Stop
                </button>
              </div>
            )}

            {/* Input area */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(0, 0, 0, 0.3)",
                borderRadius: "12px",
                padding: "8px",
                border: "1px solid rgba(212, 175, 55, 0.2)",
              }}
            >
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "22px",
                  padding: "0",
                  lineHeight: 1,
                }}
              >
                😊
              </button>
              <input
                value={newMessage}
                onChange={(e) => {
                  const message = e.target.value;
                  if (message.length <= MAX_MESSAGE_LENGTH) {
                    setNewMessage(message);
                  }
                }}
                placeholder="Type your message..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newMessage.trim() !== "") {
                    handleSendMessage(activeBeastId);
                  }
                }}
                disabled={!rideActive}
                style={{
                  flex: 1,
                  backgroundColor: "transparent",
                  border: "none",
                  outline: "none",
                  color: "white",
                  fontSize: "14px",
                  padding: "4px 0",
                }}
              />
              <button
                onClick={() => handleSendMessage(activeBeastId)}
                disabled={!rideActive || newMessage.trim() === ""}
                style={{
                  background: newMessage.trim()
                    ? "linear-gradient(135deg, #d4af37, #b8962e)"
                    : "rgba(212, 175, 55, 0.3)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  cursor: rideActive && newMessage.trim() ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  style={{
                    fill: newMessage.trim() ? "#1b1724" : "rgba(255,255,255,0.5)",
                  }}
                >
                  <path d="M15.854.146a.5.5 0 0 1 .057.638l-6 9a.5.5 0 0 1-.888-.07L7.06 6.196 1.423 4.602a.5.5 0 0 1 .013-.975l14-4a.5.5 0 0 1 .418.519z" />
                  <path d="M6.832 10.179a.5.5 0 0 1 .683.183L12 16a.5.5 0 0 1-.853.354L6.832 10.18z" />
                </svg>
              </button>
            </div>

            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                style={{
                  position: "absolute",
                  bottom: "80px",
                  left: "10px",
                  zIndex: "1000",
                }}
              >
                <EmojiPicker theme="dark" onEmojiClick={handleEmojiClick} />
              </div>
            )}
          </div>
        , document.body)}

        {popupMessage && (
          <StyledPopup
            message={popupMessage.message} // Access the message property
            onClose={handleClosePopup}
            onConfirm={popupMessage.onConfirm} // Pass the confirm function if applicable
          />
        )}
      </div>

      {/* Global Chat Sidebar - appears when all 12 beasts are occupied */}
      {/* Debug: Press Ctrl+Shift+F to toggle visibility for testing */}
      {allBeastsOccupied && typeof document !== 'undefined' && createPortal(
        <div
          className="global-chat-sidebar"
          style={{
            position: "fixed",
            right: isSidebarOpen ? "0" : "-320px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "300px",
            height: "400px",
            backgroundColor: "rgba(27, 23, 36, 0.95)",
            border: "2px solid #d4af37",
            borderRight: "none",
            borderRadius: "12px 0 0 12px",
            display: "flex",
            flexDirection: "column",
            zIndex: 10001,
            transition: "right 0.3s ease-in-out",
            boxShadow: "-4px 0 15px rgba(0, 0, 0, 0.3)",
          }}
        >
          {/* Toggle button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              position: "absolute",
              left: "-40px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "40px",
              height: "80px",
              backgroundColor: "rgba(27, 23, 36, 0.95)",
              border: "2px solid #d4af37",
              borderRight: "none",
              borderRadius: "8px 0 0 8px",
              color: "#d4af37",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            {isSidebarOpen ? "›" : "‹"}
          </button>

          {/* Header */}
          <div
            style={{
              padding: "12px 15px",
              borderBottom: "1px solid rgba(212, 175, 55, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: "#d4af37",
                fontSize: "16px",
                fontFamily: "Oleo Script, cursive",
              }}
            >
              Spectator Lounge
            </h3>
            <span
              style={{
                fontSize: "10px",
                color: "rgba(255, 255, 255, 0.6)",
                backgroundColor: "rgba(212, 175, 55, 0.2)",
                padding: "2px 8px",
                borderRadius: "10px",
              }}
            >
              All rides full
            </span>
          </div>

          {/* Queue Section */}
          {waitlist.length > 0 && (
            <div
              style={{
                padding: "10px",
                borderBottom: "1px solid rgba(212, 175, 55, 0.3)",
                backgroundColor: "rgba(0, 0, 0, 0.2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#d4af37", fontSize: "12px", fontWeight: "bold" }}>
                  Queue ({waitlist.length})
                </span>
                {notificationPermission !== 'granted' && (
                  <button
                    onClick={requestNotificationPermission}
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "8px",
                      border: "1px solid rgba(212, 175, 55, 0.5)",
                      backgroundColor: "transparent",
                      color: "#d4af37",
                      cursor: "pointer",
                    }}
                  >
                    🔔 Enable alerts
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "80px", overflowY: "auto" }}>
                {waitlist.slice(0, 5).map((person, index) => (
                  <div
                    key={person.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px",
                      borderRadius: "6px",
                      backgroundColor: person.userId === user?.id ? "rgba(212, 175, 55, 0.2)" : "transparent",
                    }}
                  >
                    <span style={{ color: "#d4af37", fontSize: "10px", fontWeight: "bold", minWidth: "16px" }}>
                      #{index + 1}
                    </span>
                    <img
                      src={sanitizeImageUrl(person.imageUrl)}
                      alt={person.username}
                      style={{ width: "20px", height: "20px", borderRadius: "50%", border: "1px solid #d4af37" }}
                    />
                    <span style={{ color: "white", fontSize: "11px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {person.username}
                      {person.userId === user?.id && " (you)"}
                    </span>
                    {person.userId === user?.id && (
                      <button
                        onClick={leaveWaitlist}
                        style={{
                          fontSize: "9px",
                          padding: "2px 5px",
                          borderRadius: "6px",
                          border: "1px solid rgba(255, 100, 100, 0.5)",
                          backgroundColor: "rgba(255, 100, 100, 0.2)",
                          color: "#ff6b6b",
                          cursor: "pointer",
                        }}
                      >
                        Leave
                      </button>
                    )}
                  </div>
                ))}
                {waitlist.length > 5 && (
                  <span style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "10px", textAlign: "center" }}>
                    +{waitlist.length - 5} more waiting...
                  </span>
                )}
              </div>
            </div>
          )}

          {/* User's queue position alert */}
          {userQueuePosition && !isRiding && (
            <div
              style={{
                padding: "8px 10px",
                backgroundColor: "rgba(212, 175, 55, 0.15)",
                borderBottom: "1px solid rgba(212, 175, 55, 0.3)",
                textAlign: "center",
              }}
            >
              <span style={{ color: "#d4af37", fontSize: "12px" }}>
                You're <strong>#{userQueuePosition}</strong> in line
                {userQueuePosition === 1 && " — You're next!"}
              </span>
            </div>
          )}

          {/* Messages area */}
          <div
            ref={globalChatRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {globalChatMessages.length === 0 ? (
              <p
                style={{
                  color: "rgba(255, 255, 255, 0.5)",
                  textAlign: "center",
                  fontSize: "12px",
                  marginTop: "20px",
                }}
              >
                No messages yet. Start the conversation!
              </p>
            ) : (
              globalChatMessages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    position: "relative",
                  }}
                  className="chat-message-row"
                >
                  <img
                    src={sanitizeImageUrl(msg.imageUrl)}
                    alt={msg.username || "User"}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      border: "1px solid #d4af37",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          color: "#d4af37",
                          fontSize: "11px",
                          fontWeight: "bold",
                        }}
                      >
                        {isSignedIn ? msg.username : scrambleText(msg.username)}
                      </span>
                      {isSignedIn && msg.userId !== user?.id && (
                        <button
                          onClick={() => reportMessage(msg, 'global')}
                          disabled={reportedMessages.has(msg.id)}
                          title={reportedMessages.has(msg.id) ? "Reported" : "Report message"}
                          style={{
                            background: "none",
                            border: "none",
                            padding: "0",
                            cursor: reportedMessages.has(msg.id) ? "default" : "pointer",
                            fontSize: "10px",
                            color: reportedMessages.has(msg.id) ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.4)",
                            opacity: 0.6,
                            transition: "opacity 0.2s",
                          }}
                          onMouseEnter={(e) => { if (!reportedMessages.has(msg.id)) e.target.style.opacity = 1; }}
                          onMouseLeave={(e) => { e.target.style.opacity = 0.6; }}
                        >
                          {reportedMessages.has(msg.id) ? "✓" : "⚑"}
                        </button>
                      )}
                    </div>
                    <p
                      style={{
                        margin: "2px 0 0 0",
                        color: isSignedIn ? "white" : "rgba(255, 255, 255, 0.5)",
                        fontSize: "12px",
                        wordBreak: "break-word",
                        fontStyle: isSignedIn ? "normal" : "italic",
                      }}
                    >
                      {isSignedIn ? msg.message : scrambleText(msg.message)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input area */}
          {isSignedIn && isRiding ? (
            <div
              style={{
                padding: "12px",
                borderTop: "1px solid rgba(212, 175, 55, 0.3)",
                textAlign: "center",
                color: "rgba(255, 255, 255, 0.6)",
                fontSize: "11px",
              }}
            >
              You're riding! Use your beast chat.
            </div>
          ) : isSignedIn ? (
            <div
              style={{
                padding: "10px",
                borderTop: "1px solid rgba(212, 175, 55, 0.3)",
                display: "flex",
                gap: "8px",
              }}
            >
              <input
                type="text"
                value={globalChatMessage}
                onChange={(e) => setGlobalChatMessage(e.target.value.slice(0, 200))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && globalChatMessage.trim()) {
                    handleSendGlobalMessage();
                  }
                }}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "20px",
                  border: "1px solid rgba(212, 175, 55, 0.5)",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "white",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
              <button
                onClick={handleSendGlobalMessage}
                disabled={!globalChatMessage.trim()}
                style={{
                  padding: "8px 12px",
                  borderRadius: "20px",
                  border: "none",
                  backgroundColor: globalChatMessage.trim()
                    ? "#d4af37"
                    : "rgba(212, 175, 55, 0.3)",
                  color: "white",
                  cursor: globalChatMessage.trim() ? "pointer" : "not-allowed",
                  fontSize: "12px",
                }}
              >
                Send
              </button>
            </div>
          ) : (
            <div
              style={{
                padding: "15px",
                borderTop: "1px solid rgba(212, 175, 55, 0.3)",
                textAlign: "center",
              }}
            >
              <SignInButton mode="modal">
                <button
                  style={{
                    padding: "8px 20px",
                    borderRadius: "20px",
                    border: "1px solid #d4af37",
                    backgroundColor: "transparent",
                    color: "#d4af37",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Sign in to chat
                </button>
              </SignInButton>
            </div>
          )}
        </div>
      , document.body)}
      {/* Ride or Die content box
      <div style={{ 
          backgroundColor: "#1b1724", 
          width: "80%", 
          borderRadius: "8px",
          padding: "20px",
          boxShadow: "0 0 10px rgba(225, 182, 126, 0.2)",
          marginTop: "20rem",
          visibility: isRiding ? "hidden" : "visible",
          height: isRiding ? "0" : "auto",
          overflow: "hidden",
          transition: "visibility 0s, height 0.3s ease-in-out", 
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center"
        }}>
        <h2 className="text-4xl font-bold font-['Oleo_Script'] leading-none text-[#c48901] mb-4 text-center w-full">
          Ride the 
        </h2>

        <p className="text-xl font-['Roboto'] leading-tight text-white text-center w-full">
          They say fortune favors the bold. Careen carefree with the ups and
          downs of the crypto market. Must be at least 36&quot; tall and hold
          RL80 or NFIN80 reward tokens. 10 minutes per ride. Your username and
          avatar will be displayed live! Messages are not saved. Click on any available beast to ride.
        </p>
      </div> */}
    </div>
  );
};

export default Carousel;