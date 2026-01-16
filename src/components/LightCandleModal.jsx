'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useWalletAuth } from './WalletAuthProvider';
import { db, collection, addDoc, doc, serverTimestamp, query, where, getDocs, deleteDoc } from '@/lib/firebaseClient';
import ThirdwebBuyModal from './ThirdwebBuyModal';
import { erc20Contract } from '@/lib/contract';
import { useSendTransaction } from 'thirdweb/react';
import { burn } from 'thirdweb/extensions/erc20';
import { sendAndConfirmTransaction } from 'thirdweb';


const PRAYERS_BY_LANGUAGE = {
  en: {
    heading: ['Prayer to Our Lady', 'of Perpetual Profit'],
    prayers: [{
      id: 'scalper',
      title: "Scalper's Prayer",
      text: "Oh Lady of Perpetual Profit, bless my lightning fingers and low-latency reflexes. Protect me from fat-fingered orders and grant me the stamina to chase micro-movements without losing my soul. May every scalp be green, and every exit perfectly timed. Amen."
    }, {
      id: 'leverage',
      title: "Leverage Prayer",
      text: "Oh Blessed Virgin of Margin, shield me from the wicked lure of 100x leverage. Guard my trades from sudden liquidation, and deliver me from the temptation of adding 'just a little more.' Grant me the humility to close in profit, and the grace to walk away before the exchange claims my soul. Amen."
    }, {
      id: 'swing',
      title: "Swing Trader's Prayer",
      text: "Oh Lady of Perpetual Profit, grant me patience to ride the waves of volatility, and the wisdom to know when to take profit and when to let it run. Bless my charts, my Fibonacci retracements, and my RSI settings, that I may always enter at the bottom and exit at the top. Amen."
    }, {
      id: 'hodler',
      title: "Hodler's Prayer",
      text: "Oh Glorious Mother of Diamond Hands, let me never succumb to weak paper hands. Guard my seed phrase, strengthen my resolve, and remind me that one day the line shall go up forever. May my wallet survive bear markets, hacks, and exchange collapses, until the moon and beyond. Amen."
    }, {
      id: 'chart',
      title: "Chart Mystic's Prayer",
      text: "Oh Oracle of Eternal Candles, Our Lady of Perpetual Profit, guide my eyes as I read the sacred indicators. Grant me the gift of vision to see wedges before they break, triangles before they tighten, and golden crosses before they shine. Deliver me from false signals, and sanctify my trading view with holy confluence. Amen."
    }]
  },
  es: {
    heading: ['Oración a Nuestra Señora', 'del Beneficio Perpetuo'],
    prayers: [{
      id: 'scalper',
      title: "Oración del Scalper",
      text: "Oh Señora del Beneficio Perpetuo, bendice mis dedos relámpago y mis reflejos de baja latencia. Protégeme de las órdenes mal digitadas y concédeme la resistencia para perseguir micromovimientos sin perder mi alma. Que cada scalp sea verde y cada salida perfectamente cronometrada. Amén."
    }, {
      id: 'leverage',
      title: "Oración del Apalancamiento",
      text: "Oh Bendita Virgen del Margen, protégeme del malvado señuelo del apalancamiento 100x. Guarda mis operaciones de la liquidación repentina y líbrame de la tentación de añadir 'solo un poco más'. Concédeme la humildad de cerrar en beneficio y la gracia de alejarme antes de que el exchange reclame mi alma. Amén."
    }, {
      id: 'swing',
      title: "Oración del Swing Trader",
      text: "Oh Señora del Beneficio Perpetuo, concédeme paciencia para surfear las olas de volatilidad y la sabiduría para saber cuándo tomar ganancias y cuándo dejar correr. Bendice mis gráficos, mis retrocesos de Fibonacci y mis configuraciones RSI, para que siempre entre en el fondo y salga en la cima. Amén."
    }, {
      id: 'hodler',
      title: "Oración del Hodler",
      text: "Oh Gloriosa Madre de las Manos de Diamante, no me dejes sucumbir a las débiles manos de papel. Guarda mi frase semilla, fortalece mi determinación y recuérdame que un día la línea subirá para siempre. Que mi cartera sobreviva a los mercados bajistas, hackeos y colapsos de exchanges, hasta la luna y más allá. Amén."
    }, {
      id: 'chart',
      title: "Oración del Místico de Gráficos",
      text: "Oh Oráculo de las Velas Eternas, Nuestra Señora del Beneficio Perpetuo, guía mis ojos mientras leo los indicadores sagrados. Concédeme el don de ver cuñas antes de que rompan, triángulos antes de que se estrechen y cruces doradas antes de que brillen. Líbrame de señales falsas y santifica mi vista de trading con confluencia sagrada. Amén."
    }]
  },
  pt: {
    heading: ['Oração a Nossa Senhora', 'do Lucro Perpétuo'],
    prayers: [{
      id: 'scalper',
      title: "Oração do Scalper",
      text: "Oh Senhora do Lucro Perpétuo, abençoe meus dedos relâmpago e meus reflexos de baixa latência. Proteja-me de ordens mal digitadas e conceda-me a resistência para perseguir micromovimentos sem perder minha alma. Que cada scalp seja verde e cada saída perfeitamente cronometrada. Amém."
    }, {
      id: 'leverage',
      title: "Oração da Alavancagem",
      text: "Oh Bendita Virgem da Margem, proteja-me da tentação maligna da alavancagem 100x. Guarde minhas operações da liquidação repentina e livre-me da tentação de adicionar 'só um pouco mais'. Conceda-me a humildade de fechar no lucro e a graça de me afastar antes que a exchange reclame minha alma. Amém."
    }, {
      id: 'swing',
      title: "Oração do Swing Trader",
      text: "Oh Senhora do Lucro Perpétuo, conceda-me paciência para surfar as ondas de volatilidade e sabedoria para saber quando realizar lucros e quando deixar correr. Abençoe meus gráficos, minhas retrações de Fibonacci e minhas configurações RSI, para que eu sempre entre no fundo e saia no topo. Amém."
    }, {
      id: 'hodler',
      title: "Oração do Hodler",
      text: "Oh Gloriosa Mãe das Mãos de Diamante, não me deixe sucumbir às fracas mãos de papel. Guarde minha seed phrase, fortaleça minha determinação e lembre-me que um dia a linha subirá para sempre. Que minha carteira sobreviva aos mercados em baixa, hacks e colapsos de exchanges, até a lua e além. Amém."
    }, {
      id: 'chart',
      title: "Oração do Místico dos Gráficos",
      text: "Oh Oráculo das Velas Eternas, Nossa Senhora do Lucro Perpétuo, guie meus olhos enquanto leio os indicadores sagrados. Conceda-me o dom de ver cunhas antes que rompam, triângulos antes que se estreitem e cruzes douradas antes que brilhem. Livre-me de sinais falsos e santifique minha visão de trading com confluência sagrada. Amém."
    }]
  },
  fr: {
    heading: ['Prière à Notre-Dame', 'du Profit Perpétuel'],
    prayers: [{
      id: 'scalper',
      title: "Prière du Scalper",
      text: "Oh Dame du Profit Perpétuel, bénis mes doigts éclair et mes réflexes à faible latence. Protège-moi des ordres mal saisis et accorde-moi l'endurance de poursuivre les micro-mouvements sans perdre mon âme. Que chaque scalp soit vert et chaque sortie parfaitement chronométrée. Amen."
    }, {
      id: 'leverage',
      title: "Prière du Levier",
      text: "Oh Bienheureuse Vierge de la Marge, protège-moi du leurre maléfique du levier 100x. Garde mes trades de la liquidation soudaine et délivre-moi de la tentation d'ajouter 'juste un peu plus'. Accorde-moi l'humilité de clôturer en profit et la grâce de m'éloigner avant que l'exchange ne réclame mon âme. Amen."
    }, {
      id: 'swing',
      title: "Prière du Swing Trader",
      text: "Oh Dame du Profit Perpétuel, accorde-moi la patience de surfer sur les vagues de volatilité et la sagesse de savoir quand prendre des profits et quand laisser courir. Bénis mes graphiques, mes retracements de Fibonacci et mes paramètres RSI, pour que j'entre toujours au plus bas et sorte au plus haut. Amen."
    }, {
      id: 'hodler',
      title: "Prière du Hodler",
      text: "Oh Glorieuse Mère aux Mains de Diamant, ne me laisse jamais succomber aux faibles mains de papier. Garde ma phrase de récupération, renforce ma détermination et rappelle-moi qu'un jour la ligne montera pour toujours. Que mon portefeuille survive aux marchés baissiers, aux piratages et aux effondrements d'exchanges, jusqu'à la lune et au-delà. Amen."
    }, {
      id: 'chart',
      title: "Prière du Mystique des Graphiques",
      text: "Oh Oracle des Chandelles Éternelles, Notre-Dame du Profit Perpétuel, guide mes yeux pendant que je lis les indicateurs sacrés. Accorde-moi le don de voir les biseaux avant qu'ils ne cassent, les triangles avant qu'ils ne se resserrent et les croix dorées avant qu'elles ne brillent. Délivre-moi des faux signaux et sanctifie ma vue de trading avec une confluence sacrée. Amen."
    }]
  },
  zh: {
    heading: ['永恒利润圣母', '祈祷文'],
    prayers: [{
      id: 'scalper',
      title: "剥头皮交易者祈祷",
      text: "永恒利润圣母啊，请保佑我闪电般的手指和低延迟的反应。保护我免受手滑下单之苦，赐予我追逐微小波动的耐力而不失去灵魂。愿每次剥头皮都是绿色，每次退出都恰到好处。阿门。"
    }, {
      id: 'leverage',
      title: "杠杆祈祷",
      text: "神圣的保证金圣母啊，请保护我远离100倍杠杆的邪恶诱惑。守护我的交易免受突然爆仓，让我摆脱'再加一点点'的诱惑。赐予我在盈利时平仓的谦逊，以及在交易所夺走我灵魂之前离开的恩典。阿门。"
    }, {
      id: 'swing',
      title: "波段交易者祈祷",
      text: "永恒利润圣母啊，请赐予我乘风破浪的耐心，以及知道何时止盈何时持有的智慧。保佑我的图表、斐波那契回撤和RSI设置，让我总能在底部进入，在顶部退出。阿门。"
    }, {
      id: 'hodler',
      title: "持币者祈祷",
      text: "光荣的钻石之手圣母啊，永远不要让我屈服于软弱的纸手。守护我的助记词，坚定我的决心，提醒我总有一天曲线会永远向上。愿我的钱包能够在熊市、黑客攻击和交易所崩溃中幸存，直到月球甚至更远。阿门。"
    }, {
      id: 'chart',
      title: "图表神秘主义者祈祷",
      text: "永恒蜡烛的神谕，永恒利润圣母啊，在我解读神圣指标时引导我的双眼。赐予我在楔形突破前看到它们、在三角形收紧前看到它们、在金叉闪耀前看到它们的天赋。让我远离虚假信号，用神圣的汇合点净化我的交易视野。阿门。"
    }]
  },
  hi: {
    heading: ['शाश्वत लाभ की माता', 'की प्रार्थना'],
    prayers: [{
      id: 'scalper',
      title: "स्कैल्पर की प्रार्थना",
      text: "हे शाश्वत लाभ की माता, मेरी बिजली जैसी उंगलियों और कम विलंबता वाले रिफ्लेक्स को आशीर्वाद दें। मुझे गलत ऑर्डर से बचाएं और मुझे अपनी आत्मा खोए बिना सूक्ष्म गतिविधियों का पीछा करने की सहनशक्ति प्रदान करें। हर स्कैल्प हरा हो और हर निकास पूरी तरह से समयबद्ध हो। आमीन।"
    }, {
      id: 'leverage',
      title: "लीवरेज प्रार्थना",
      text: "हे मार्जिन की धन्य कुंवारी, मुझे 100x लीवरेज के दुष्ट प्रलोभन से बचाएं। मेरे ट्रेडों को अचानक लिक्विडेशन से बचाएं और मुझे 'बस थोड़ा और' जोड़ने के प्रलोभन से मुक्त करें। मुझे लाभ में बंद करने की विनम्रता और एक्सचेंज मेरी आत्मा का दावा करने से पहले दूर चले जाने की कृपा प्रदान करें। आमीन।"
    }, {
      id: 'swing',
      title: "स्विंग ट्रेडर की प्रार्थना",
      text: "हे शाश्वत लाभ की माता, मुझे अस्थिरता की लहरों की सवारी करने का धैर्य और कब लाभ लेना है और कब चलने देना है यह जानने की बुद्धि प्रदान करें। मेरे चार्ट, मेरे फिबोनाची रिट्रेसमेंट और मेरी RSI सेटिंग्स को आशीर्वाद दें, ताकि मैं हमेशा नीचे प्रवेश करूं और शीर्ष पर निकलूं। आमीन।"
    }, {
      id: 'hodler',
      title: "होडलर की प्रार्थना",
      text: "हे हीरे के हाथों की महिमामयी माता, मुझे कभी भी कमजोर कागज के हाथों के आगे झुकने न दें। मेरे सीड फ्रेज़ की रक्षा करें, मेरे संकल्प को मजबूत करें और मुझे याद दिलाएं कि एक दिन लाइन हमेशा के लिए ऊपर जाएगी। मेरा वॉलेट भालू बाजारों, हैक और एक्सचेंज के पतन से बचे, चांद तक और उससे आगे। आमीन।"
    }, {
      id: 'chart',
      title: "चार्ट रहस्यवादी की प्रार्थना",
      text: "हे शाश्वत मोमबत्तियों के दैवज्ञ, शाश्वत लाभ की माता, पवित्र संकेतकों को पढ़ते समय मेरी आंखों का मार्गदर्शन करें। मुझे वेज के टूटने से पहले, त्रिकोण के कसने से पहले और गोल्डन क्रॉस के चमकने से पहले देखने का वरदान दें। मुझे झूठे संकेतों से मुक्त करें और पवित्र संगम के साथ मेरे ट्रेडिंग दृश्य को पवित्र करें। आमीन।"
    }]
  },
  it: {
    heading: ['Preghiera a Nostra Signora', 'del Profitto Perpetuo'],
    prayers: [{
      id: 'scalper',
      title: "Preghiera dello Scalper",
      text: "Oh Signora del Profitto Perpetuo, benedici le mie dita fulminee e i miei riflessi a bassa latenza. Proteggimi dagli ordini mal digitati e concedimi la resistenza per inseguire i micro-movimenti senza perdere la mia anima. Che ogni scalp sia verde e ogni uscita perfettamente cronometrata. Amen."
    }, {
      id: 'leverage',
      title: "Preghiera della Leva",
      text: "Oh Benedetta Vergine del Margine, proteggimi dal malvagio richiamo della leva 100x. Custodisci i miei trade dalla liquidazione improvvisa e liberami dalla tentazione di aggiungere 'solo un po' di più'. Concedimi l'umiltà di chiudere in profitto e la grazia di allontanarmi prima che l'exchange reclami la mia anima. Amen."
    }, {
      id: 'swing',
      title: "Preghiera dello Swing Trader",
      text: "Oh Signora del Profitto Perpetuo, concedimi la pazienza di cavalcare le onde della volatilità e la saggezza di sapere quando prendere profitto e quando lasciarlo correre. Benedici i miei grafici, i miei ritracciamenti di Fibonacci e le mie impostazioni RSI, affinché io possa sempre entrare in basso e uscire in alto. Amen."
    }, {
      id: 'hodler',
      title: "Preghiera dell'Hodler",
      text: "Oh Gloriosa Madre delle Mani di Diamante, non lasciarmi mai soccombere alle deboli mani di carta. Custodisci la mia seed phrase, rafforza la mia determinazione e ricordami che un giorno la linea salirà per sempre. Che il mio portafoglio sopravviva ai mercati orso, agli hack e ai crolli degli exchange, fino alla luna e oltre. Amen."
    }, {
      id: 'chart',
      title: "Preghiera del Mistico dei Grafici",
      text: "Oh Oracolo delle Candele Eterne, Nostra Signora del Profitto Perpetuo, guida i miei occhi mentre leggo gli indicatori sacri. Concedimi il dono di vedere i cunei prima che si rompano, i triangoli prima che si stringano e le croci dorate prima che brillino. Liberami dai falsi segnali e santifica la mia visione di trading con la sacra confluenza. Amen."
    }]
  }
};


const getUserLanguage = () => {
  if (typeof window === 'undefined') {
    return 'en';
  }
  const lang = navigator.language || navigator.userLanguage || 'en';
  const shortLang = lang.substring(0, 2).toLowerCase();
  return ['es', 'pt', 'zh', 'hi', 'fr', 'it'].includes(shortLang) ? shortLang : 'en';
};


const LightCandleModal = ({ isOpen, onClose, onLightCandle }) => {
  const { user } = useUser();
  const { walletAddress, tokenBalance, activeAccount } = useWalletAuth();
  const { mutate: sendTransaction } = useSendTransaction();
  
  const [offeringType, setOfferingType] = useState('petition');
  const [message, setMessage] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showNoBuyPrompt, setShowNoBuyPrompt] = useState(false);
  const [modalHidden, setModalHidden] = useState(false); // Hide modal content during transaction
  const [selectedPrayer, setSelectedPrayer] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
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
      setTokenAmount('');
      setIsSubmitting(false);
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
      // Generate a random 3D position for the candle
      // This matches the position generation in CandleShrine
      const candlePosition = {
        x: (Math.random() - 0.5) * 30,
        y: (Math.random() - 0.5) * 20,
        z: (Math.random() - 0.5) * 15
      };
      
      // Prepare offering data
      const baseOffering = {
        name: user?.username || user?.firstName || 'Anonymous',
        type: offeringType,
        message: message.trim() || '',
        tokensBurned: parseInt(tokenAmount) || 0,
        userId: user?.id,
        walletAddress: walletAddress,
        userImageUrl: user?.imageUrl || null,
        prayerFor: prayerFor,
        recipientName: prayerFor === 'self' ? (user?.username || user?.firstName || 'Anonymous') : (recipientName || 'Someone'),
        position: candlePosition, // Store the 3D position
        createdAt: serverTimestamp(),
        timestamp: new Date().toISOString()
      };
      

      // First trigger the NewCandleEffect and Prayer Received animation
      // WITHOUT saving to Firebase yet
      const newOffering = {...baseOffering};
      
      console.log('🎬 Triggering candle animation and Prayer Received');
      // Trigger the effect immediately (this will show "Prayer Received")
      await onLightCandle(newOffering);
      
      console.log('⏱️ Waiting for Prayer Received animation to complete');
      // Wait for the "Prayer Received" animation to show (1.5 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // NOW save to Firestore after the animation
      // First, check for existing active offering for this wallet
      const EXPIRATION_HOURS = 80;
      
      let docRef = null;
      try {
        // First, verify Firebase is properly initialized
        if (!db || typeof db.collection !== 'function') {
          throw new Error('Firebase Firestore is not properly initialized. Please check your environment variables.');
        }
        
        // Test Firestore connectivity
        console.log('🔥 Firebase DB status:', {
          db: !!db,
          hasCollection: typeof db.collection === 'function',
          hasAddDoc: typeof addDoc === 'function'
        });
        
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
        console.error('❌ CRITICAL: Error saving to Firestore offerings collection:', firestoreError);
        console.error('❌ Firebase DB instance:', db ? 'initialized' : 'NOT INITIALIZED');
        console.error('❌ Error details:', {
          name: firestoreError?.name,
          code: firestoreError?.code,
          message: firestoreError?.message,
          stack: firestoreError?.stack
        });
        // Log the offering data that failed to save
        console.error('❌ Failed offering data:', baseOffering);
        
        // Show user-friendly error
        alert('Failed to save your candle to the shrine. Please try again or contact support if the issue persists.');
        
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

  // Get prayer templates based on selected language
  const prayerTemplates = PRAYERS_BY_LANGUAGE[selectedLanguage]?.prayers || PRAYERS_BY_LANGUAGE.en.prayers;

  // This is now only used for the form onSubmit - actual transaction is handled by TransactionButton
  const handleSubmit = async (e) => {
    e.preventDefault();
    // The TransactionButton will handle everything
  };


  const offeringTypes = {
    petition: { 
      color: '#ffaa00', 
      label: 'PETITION',
      description: 'Ask for guidance or help'
    },
    confession: { 
      color: '#aa66ff', 
      label: 'CONFESSION',
      description: 'Unburden your heart'
    },
    appreciation: { 
      color: '#00ff66', 
      label: 'THANKS',
      description: 'Express gratitude for good fortune'
    }
  };

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
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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
          padding: 1.5rem;
          width: 90%;
          max-width: 480px;
          max-height: 90vh;
          overflow: hidden;
          position: relative;
          animation: fadeIn 0.4s ease-out;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(139, 92, 246, 0.3);
        }
        
        /* Height-based media queries */
        @media (max-height: 700px) {
          .modal-content {
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
          font-size: 1.2rem;
          font-weight: 600;
          color: #fff;
          text-align: center;
          margin-bottom: 0.75rem;
          font-family: 'Orbitron', monospace;
        }

        .offering-types {
          display: flex;
          gap: 0.3rem;
          margin-bottom: 0.75rem;
          justify-content: center;
        }

        .offering-type-button {
          flex: 1;
          padding: 0.4rem 0.25rem;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
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
          font-size: 1rem;
          display: block;
          margin-bottom: 0.2rem;
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
          margin-bottom: 0.75rem;
        }

        .form-label {
          display: block;
          color: #00f5d4;
          margin-bottom: 0.3rem;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 500;
        }

        .message-textarea {
          width: 100%;
          height: 80px;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
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
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #fff;
          font-size: 0.85rem;
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



        .submit-button {
          width: 100%;
          padding: 0.7rem;
          background: #fff;
          border: none;
          border-radius: 50px;
          color: #000;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
          margin-top: 0.5rem;
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

      {/* Separate overlay for transaction progress with Blue Guidance Box */}
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
              padding: '2rem',
              textAlign: 'center',
              color: '#fff',
              boxShadow: '0 20px 60px rgba(139, 92, 246, 0.5)',
              zIndex: 10000,
              minWidth: '320px',
              animation: 'fadeInNoMove 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Blue Guidance Box for Transaction Confirming */}
            <div style={{
              background: 'rgba(0, 123, 255, 0.95)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              boxShadow: '0 4px 20px rgba(0, 123, 255, 0.3)'
            }}>
              <div style={{
                fontSize: '1.5rem',
                marginBottom: '0.5rem',
                animation: 'spin 2s linear infinite'
              }}>
                ⏳
              </div>
              <div style={{
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: '600',
                marginBottom: '0.25rem'
              }}>
                Transaction submitted!
              </div>
              <div style={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '0.75rem'
              }}>
                Waiting for blockchain confirmation...
              </div>
            </div>
            
            {/* Animated Flame Icon */}
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem',
              filter: 'drop-shadow(0 0 30px rgba(255, 170, 0, 0.8)) drop-shadow(0 0 60px rgba(255, 100, 0, 0.4))',
              animation: 'pulse 2s ease-in-out infinite',
              display: 'inline-block'
            }}>
              🔥
            </div>
            
            {/* Processing Message */}
            <h3 style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: '1.2rem',
              fontWeight: '600',
              color: '#fff',
              marginBottom: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Lighting Your Candle
            </h3>
            
            <p style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '0.9rem',
              marginBottom: '1rem'
            }}>
              Burning {tokenAmount || '0'} RL80 token{parseInt(tokenAmount) !== 1 ? 's' : ''}...
            </p>
            
            <p style={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '0.75rem',
              fontStyle: 'italic'
            }}>
              This usually takes 10-30 seconds
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
            
            {/* Compact Info Section - Always visible */}
            <div style={{
              background: 'rgba(139, 92, 246, 0.05)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '8px',
              padding: '0.5rem',
              marginBottom: '0.5rem',
              fontSize: '0.6rem',
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: '1.3',
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              <span>💎 1 token min</span>
              <span>⏱️ 80hr expiry</span>
              <span>🕯️ 1 per wallet</span>
            </div>
            
            <form onSubmit={handleSubmit} style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              flex: 1
            }}>
            
            {/* Offering Type Selection */}
            <label className="form-label" style={{ textAlign: 'center', marginBottom: '0.3rem' }}>
              Prayer Protocol:
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
                    setSelectedPrayer(''); // Clear selected template when type changes
                  }}
                >
                  <span className="type-icon">{config.icon}</span>
                  <span className="type-label">{config.label}</span>
                  <div className="type-description">{config.description}</div>
                </button>
              ))}
            </div>

            {/* Prayer Recipient Toggle */}
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.4rem', gap: '0.5rem' }}>
                <label className="form-label" style={{ margin: 0, fontSize: '0.65rem' }}>
                  For:
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
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
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)' }}>Me</span>
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
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)' }}>Someone Else</span>
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
                  padding: '0.4rem',
                  background: prayerFor === 'self' ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.75rem',
                  opacity: prayerFor === 'self' ? 0.7 : 1,
                  cursor: prayerFor === 'self' ? 'not-allowed' : 'text',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Message Input */}
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label className="form-label" htmlFor="message">
                Your Message (Optional)
              </label>
              <textarea
                id="message"
                className="message-textarea"
                placeholder={
                  offeringType === 'petition' 
                    ? "Write your prayer or select a template below"
                    : offeringType === 'confession'
                    ? "Share what's on your heart..."
                    : "Express your gratitude..."
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={300}
              />
              <div style={{ textAlign: 'right', fontSize: '0.6rem', color: '#666', marginTop: '0.1rem' }}>
                {message.length}/300
              </div>
              
              {/* Prayer Templates Section - Only for Petitions */}
              {offeringType === 'petition' && (
                <>
                  {/* Language Selector */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                    <select 
                      value={selectedLanguage}
                      onChange={(e) => {
                        setSelectedLanguage(e.target.value);
                        setSelectedPrayer(''); // Clear selected prayer when language changes
                        setMessage(''); // Clear message to let user pick a new prayer
                      }}
                      style={{
                        flex: '0 0 auto',
                        padding: '0.4rem',
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '8px',
                        color: '#8b5cf6',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="pt">Português</option>
                      <option value="fr">Français</option>
                      <option value="zh">中文</option>
                      <option value="hi">हिंदी</option>
                      <option value="it">Italiano</option>
                    </select>
                    
                    {/* Prayer Template Selector */}
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
                        flex: 1,
                        padding: '0.4rem',
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '8px',
                        color: '#8b5cf6',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">Select a prayer template...</option>
                      {prayerTemplates.map(prayer => (
                        <option key={prayer.id} value={prayer.id}>
                          {prayer.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>


            {/* Token Amount */}
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
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
            
            {/* Submit Button - Light Candle with token burn */}
            <button
              onClick={async () => {
                const amount = parseInt(tokenAmount) || 0;
                const currentBalance = parseInt(tokenBalance) || 0;
                
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
              disabled={isSubmitting || !tokenAmount || parseInt(tokenAmount) < 1}
              className="submit-button"
              style={{
                marginTop: '0.5rem'
              }}
            >
              {isSubmitting ? 'Processing...' : 'Light Candle'}
            </button>
            </form>
            
          </div>
        ) : null}
      </div>

      {/* Wallet Loading Indicator with Yellow Guidance Box */}
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
            padding: '2rem',
            textAlign: 'center',
            color: '#fff',
            boxShadow: '0 20px 60px rgba(139, 92, 246, 0.4)',
            maxWidth: '380px',
            width: '90%',
            position: 'relative'
          }}>
            {/* Yellow Guidance Box */}
            <div style={{
              background: 'rgba(255, 193, 7, 0.95)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              boxShadow: '0 4px 20px rgba(255, 193, 7, 0.3)'
            }}>
              <div style={{
                fontSize: '1.5rem',
                marginBottom: '0.5rem'
              }}>
                ✍️
              </div>
              <div style={{
                color: '#000',
                fontSize: '0.95rem',
                fontWeight: '600'
              }}>
                Please sign the transaction in your wallet
              </div>
            </div>
            
            {/* Flame Icon */}
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem',
              filter: 'drop-shadow(0 0 20px rgba(255, 170, 0, 0.8))',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}>
              🕯️
            </div>
            
            {/* Title */}
            <h3 style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: '1.1rem',
              fontWeight: '600',
              color: '#fff',
              marginBottom: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Light a Candle
            </h3>
            
            {/* Amount Info */}
            <p style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '0.85rem',
              marginBottom: '1rem'
            }}>
              Amount: <strong>{tokenAmount} RL80</strong>
            </p>
            
            {/* Status */}
            <p style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.75rem',
              fontStyle: 'italic'
            }}>
              Waiting for wallet confirmation...
            </p>
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
            
            {/* Yellow Info Box */}
            <div style={{
              background: 'rgba(255, 193, 7, 0.15)',
              border: '1px solid rgba(255, 193, 7, 0.4)',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '2rem'
            }}>
              <p style={{
                color: '#fff',
                fontSize: '1rem',
                marginBottom: '0.5rem',
                lineHeight: '1.6'
              }}>
                You're about to burn <strong style={{ fontSize: '1.2rem', color: '#ffc107' }}>{pendingBurnAmount}</strong> RL80 token{pendingBurnAmount !== 1 ? 's' : ''}
              </p>
              <p style={{
                color: 'rgba(255, 193, 7, 0.9)',
                fontSize: '0.85rem',
                margin: 0,
                fontWeight: '500'
              }}>
                ⚠️ This action is permanent and cannot be undone
              </p>
            </div>
            
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
                          // Hide wallet loading immediately after signing
                          setShowWalletLoading(false);
                          // NOW show the progress indicator for blockchain confirmation
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
                          
                          // Clear all loading states
                          setTransactionStatus('');
                          setShowWalletLoading(false);
                          setIsBurnInProgress(false);
                          setForceHidden(false);
                          setModalHidden(false);
                          
                          // Check if user rejected the transaction
                          if (!error?.message?.includes('User rejected') && 
                              !error?.message?.includes('User denied') &&
                              !error?.message?.includes('rejected') &&
                              error?.code !== 4001) {
                            alert('Failed to burn tokens: ' + (error?.message || 'Unknown error'));
                          }
                          
                          setIsSubmitting(false);
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