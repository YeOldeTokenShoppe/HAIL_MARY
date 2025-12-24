import React, { useRef, useState, useEffect } from 'react';
import './PokemonHoloCard.css';

const PokemonHoloCard = ({ 
  name = "Charizard",
  hp = 120,
  type = "Fire",
  image,
  backgroundImage = "/aurora.webp",    // Custom background image
  foregroundImage = "/crier.png",  // Custom foreground overlay
  backGemstone = "/coinFront.png",
  attacks = [
    { name: "Fire Blast", damage: 120, cost: "🔥🔥🔥🔥" },
    { name: "Dragon Claw", damage: 80, cost: "🔥🔥💫" }
  ],
  weakness = "Water",
  resistance = "Grass",
  retreatCost = 3,
  rarity = "rare holo",
  artist = "",
  cardNumber = "4/102",
  description = "Spits fire that is hot enough to melt boulders. Known to cause forest fires unintentionally.",
  className = "",
  agent = null  // Added to check if it's an agent card
}) => {
  const cardRef = useRef(null);
  const shineRef = useRef(null);
  const [isTouch, setIsTouch] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    setIsTouch('ontouchstart' in window);
  }, []);

  // Initial animation effect when card loads (especially for agent cards)
  useEffect(() => {
    // Only animate if it's an agent card (has agent prop) and hasn't animated yet
    if (agent && cardRef.current && !hasAnimated) {
      setHasAnimated(true);
      
      // Define animation sequence with different positions
      const animationSequence = [
        { rotateX: -10, rotateY: 15, mx: 70, my: 30, duration: 400 },
        { rotateX: 10, rotateY: -10, mx: 30, my: 70, duration: 400 },
        // { rotateX: -5, rotateY: -15, mx: 20, my: 50, duration: 400 },
        // { rotateX: 5, rotateY: 10, mx: 80, my: 40, duration: 400 },
        { rotateX: 0, rotateY: 0, mx: 50, my: 50, duration: 300 } // Return to center
      ];
      
      let currentStep = 0;
      
      const animateStep = () => {
        if (currentStep < animationSequence.length && cardRef.current) {
          const step = animationSequence[currentStep];
          
          // Apply rotation
          cardRef.current.style.setProperty('--rotate-x', `${step.rotateX}deg`);
          cardRef.current.style.setProperty('--rotate-y', `${step.rotateY}deg`);
          
          // Apply position for shine effect
          cardRef.current.style.setProperty('--mx', `${step.mx}%`);
          cardRef.current.style.setProperty('--my', `${step.my}%`);
          cardRef.current.style.setProperty('--posx', `${step.mx}%`);
          cardRef.current.style.setProperty('--posy', `${step.my}%`);
          
          // Calculate hyp for shine intensity
          const centerX = 50;
          const centerY = 50;
          const distance = Math.sqrt(Math.pow(step.mx - centerX, 2) + Math.pow(step.my - centerY, 2));
          const hyp = distance / Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
          cardRef.current.style.setProperty('--hyp', hyp);
          
          // Also update shine element if it exists
          if (shineRef.current) {
            shineRef.current.style.setProperty('--mx', `${step.mx}%`);
            shineRef.current.style.setProperty('--my', `${step.my}%`);
            shineRef.current.style.setProperty('--posx', `${step.mx}%`);
            shineRef.current.style.setProperty('--posy', `${step.my}%`);
            shineRef.current.style.setProperty('--hyp', hyp);
          }
          
          currentStep++;
          setTimeout(animateStep, step.duration);
        }
      };
      
      // Start animation after a short delay
      setTimeout(animateStep, 200);
    }
  }, [agent, hasAnimated]);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate rotation
    const rotateX = ((y - centerY) / centerY) * -15;
    const rotateY = ((x - centerX) / centerX) * 15;
    
    // Calculate position for shine effect
    const mx = (x / rect.width) * 100;
    const my = (y / rect.height) * 100;
    const posx = (x / rect.width) * 100;
    const posy = (y / rect.height) * 100;
    const hyp = Math.sqrt(Math.pow((x - centerX), 2) + Math.pow((y - centerY), 2)) / Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
    
    // Set CSS variables on card for rotation
    cardRef.current.style.setProperty('--rotate-x', `${rotateX}deg`);
    cardRef.current.style.setProperty('--rotate-y', `${rotateY}deg`);
    
    // Also set position variables on card for backdrop effects
    cardRef.current.style.setProperty('--mx', `${mx}%`);
    cardRef.current.style.setProperty('--my', `${my}%`);
    cardRef.current.style.setProperty('--posx', `${posx}%`);
    cardRef.current.style.setProperty('--posy', `${posy}%`);
    cardRef.current.style.setProperty('--hyp', hyp);
    
    // Set on shine element too if it exists
    if (shineRef.current) {
      shineRef.current.style.setProperty('--mx', `${mx}%`);
      shineRef.current.style.setProperty('--my', `${my}%`);
      shineRef.current.style.setProperty('--posx', `${posx}%`);
      shineRef.current.style.setProperty('--posy', `${posy}%`);
      shineRef.current.style.setProperty('--hyp', hyp);
    }
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    
    cardRef.current.style.setProperty('--rotate-x', '0deg');
    cardRef.current.style.setProperty('--rotate-y', '0deg');
    
    if (shineRef.current) {
      shineRef.current.style.setProperty('--mx', '50%');
      shineRef.current.style.setProperty('--my', '50%');
      shineRef.current.style.setProperty('--posx', '50%');
      shineRef.current.style.setProperty('--posy', '50%');
      shineRef.current.style.setProperty('--hyp', '0');
    }
  };

  const handleTouchMove = (e) => {
    if (!cardRef.current) return;
    
    const touch = e.touches[0];
    const rect = cardRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate rotation
    const rotateX = ((y - centerY) / centerY) * -15;
    const rotateY = ((x - centerX) / centerX) * 15;
    
    // Calculate position for shine effect
    const mx = (x / rect.width) * 100;
    const my = (y / rect.height) * 100;
    const posx = (x / rect.width) * 100;
    const posy = (y / rect.height) * 100;
    const hyp = Math.sqrt(Math.pow((x - centerX), 2) + Math.pow((y - centerY), 2)) / Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
    
    // Set CSS variables on card for rotation
    cardRef.current.style.setProperty('--rotate-x', `${rotateX}deg`);
    cardRef.current.style.setProperty('--rotate-y', `${rotateY}deg`);
    
    // Also set position variables on card for backdrop effects
    cardRef.current.style.setProperty('--mx', `${mx}%`);
    cardRef.current.style.setProperty('--my', `${my}%`);
    cardRef.current.style.setProperty('--posx', `${posx}%`);
    cardRef.current.style.setProperty('--posy', `${posy}%`);
    cardRef.current.style.setProperty('--hyp', hyp);
    
    // Set on shine element too if it exists
    if (shineRef.current) {
      shineRef.current.style.setProperty('--mx', `${mx}%`);
      shineRef.current.style.setProperty('--my', `${my}%`);
      shineRef.current.style.setProperty('--posx', `${posx}%`);
      shineRef.current.style.setProperty('--posy', `${posy}%`);
      shineRef.current.style.setProperty('--hyp', hyp);
    }
  };

  const handleTouchEnd = () => {
    if (!cardRef.current) return;
    
    cardRef.current.style.setProperty('--rotate-x', '0deg');
    cardRef.current.style.setProperty('--rotate-y', '0deg');
    
    if (shineRef.current) {
      shineRef.current.style.setProperty('--mx', '50%');
      shineRef.current.style.setProperty('--my', '50%');
      shineRef.current.style.setProperty('--posx', '50%');
      shineRef.current.style.setProperty('--posy', '50%');
      shineRef.current.style.setProperty('--hyp', '0');
    }
  };

  const handleCardClick = (e) => {
    // Don't flip if clicking on buttons or interactive elements
    if (e.target.tagName === 'BUTTON') return;
    setIsFlipped(!isFlipped);
  };

  return (
    <div className={`pokemon-card-container ${className}`}>
      <article 
        className={`card ${isFlipped ? 'flipped' : ''}`}
        data-rarity={rarity}
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
      >
        {/* Card Front */}
        <div className="card__content card__front card__face">
          {/* Header */}
          <div className="card__header">
            <h2 className="card__name">{name}</h2>
            <div className="card__hp">
              {/* <span className="hp-label">HP</span>
              <span className="hp-value">{hp}</span> */}
            </div>
            <div className={`card__type type-${type.toLowerCase()}`}>
              {type}
            </div>
          </div>
          
          {/* Image Container with layered effects */}
          <div className="card__image-container">
            {/* Background with holographic effect applied directly */}
            <div className="card__holo-background">
              <img 
                src={backgroundImage}
                alt="Background"
                className="card__image-background"
              />
              {/* Holographic shine ONLY on background */}
              <div className="card__shine--image" ref={shineRef}></div>
            </div>
            
            {/* Foreground overlay - ABOVE everything including holo */}
            <img 
              src={foregroundImage} 
              alt="Foreground" 
              className="card__image-foreground"
            />
            
            {/* Optional Pokemon image if provided */}
            {image && (
              <img src={image} alt={name} className="card__image" />
            )}
            
            {/* Border/frame */}
            <div className="card__image-border"></div>
          </div>
          
          {/* Description */}
          <div className="card__description">
            {description}
          </div>
          
          {/* Attacks */}
          <div className="card__attacks">
            {attacks.map((attack, index) => (
              <div key={index} className="attack">
                <span className="attack-cost">{attack.cost}</span>
                <span className="attack-name">{attack.name}</span>
                <span className="attack-damage">{attack.damage}</span>
              </div>
            ))}
          </div>
          
          {/* Bottom Info */}
          <div className="card__bottom">
            <div className="card__stats">
              <div className="stat">
                <span className="stat-label">Weakness</span>
                <span className="stat-value">{weakness} ×2</span>
              </div>
              <div className="stat">
                <span className="stat-label">Resistance</span>
                <span className="stat-value">{resistance} -30</span>
              </div>
              <div className="stat">
                <span className="stat-label">Retreat</span>
                <span className="stat-value">{"⭐".repeat(retreatCost)}</span>
              </div>
            </div>
            
            <div className="card__footer">
              {/* <div className="card__artist">Illus. {artist}</div> */}
              <div className="card__number">{cardNumber}</div>
              <div className="card__rarity-icon">★</div>
            </div>
          </div>
        </div>
        
        {/* Full card holographic overlay for rare holo cards */}
        <div className="card__shine" ref={shineRef}></div>
        
        {/* Card Back */}
        <div className="card__content card__back card__face">
          <img
            className="backdrop"
            src="https://assets.codepen.io/605876/techtrades-backdrop.png"
            alt=""
          />
          <div className="card__emboss">
            <svg className="wordmark wordmark--top" viewBox="0 0 500 80">
              <defs>
                <path id="arc-top" d="M 50 65 Q 250 20, 450 65" />
              </defs>
              <text fill="#FFD700" stroke="#B8860B" strokeWidth="3">
                <textPath href="#arc-top" startOffset="50%" textAnchor="middle">
                  PerpDesk
                </textPath>
              </text>
            </svg>
            
            <svg className="wordmark wordmark--bottom" viewBox="0 0 500 80">
              <defs>
                <path id="arc-bottom" d="M 50 65 Q 250 20, 450 65" />
              </defs>
              <text fill="#FFD700" stroke="#B8860B" strokeWidth="3">
                <textPath href="#arc-bottom" startOffset="50%" textAnchor="middle">
                  Perp
                  Desk
                </textPath>
              </text>
            </svg>
            
            <img className="gemstone" src={backGemstone} alt="Gemstone" />
          </div>
          <div className="spotlight"></div>
          
          {/* Flip button indicator */}
          <div className="flip-hint">Click to flip</div>
        </div>
      </article>
    </div>
  );
};

export default PokemonHoloCard;