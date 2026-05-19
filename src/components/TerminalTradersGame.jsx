"use client";

import React, { useMemo, useState } from "react";
import { ACTION_CARDS, CARD_TYPES, COIN_CARDS, GENESIS_SET, MARKET_CARDS, TRADERS } from "@/game/terminal-traders/cards";
import { TERMINAL_TRADERS_RULES, bankCred, chooseTrader, createGame, endTurn, getWinner, hasPlayableCard, playCard, recoverHand } from "@/game/terminal-traders/engine";

const TRADER_THUMBNAILS = {
  "unihood": { portrait: "/thumbnail_eugene.png", label: "MEME" },
  "det-trinity": { portrait: "/thumbnail_marisol.png", label: "LOGOS" },
  "halo-node": { portrait: "/thumbnail_gr80.png", label: "NODE" },
  "bullhorn-broker": { portrait: "/thumbnail_johnBarron.png", label: "HYPE" },
};

const CARD_ART = {
  "unihood": "/TCG/traderUnicorn.webp",
  "moonpony": "/TCG/coinCard_MoonPony.png",
  "pump-signal": "/TCG/actionCard_PumpSignal.png",
};

export default function TerminalTradersGame({ variant = "page", onExit } = {}) {
  const isSceneMode = variant === "scene";
  const [game, setGame] = useState(null);
  const [previewTraderId, setPreviewTraderId] = useState("unihood");
  const [inspectedCardId, setInspectedCardId] = useState(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const winner = game ? getWinner(game) : null;
  const inspectedCard = game?.hand.find((card) => card.id === inspectedCardId) || null;
  const activeTrader = game ? TRADERS.find((trader) => trader.id === game.players[0].traderId) : null;
  const previewTrader = TRADERS.find((trader) => trader.id === previewTraderId) || activeTrader || TRADERS[0];
  const canPlayAnyCard = game ? hasPlayableCard(game) : false;
  const canBankCred = game?.status === "playing" && game.hand.length > 0 && game.playsRemaining > 0 && !canPlayAnyCard;
  const standings = useMemo(
    () => game ? [...game.players].sort((a, b) => b.portfolio - a.portfolio) : [],
    [game]
  );
  const collectionStats = useMemo(() => ({
    traders: TRADERS.length,
    coins: COIN_CARDS.length,
    actions: ACTION_CARDS.length,
    markets: MARKET_CARDS.length,
    total: GENESIS_SET.length,
  }), []);

  const handlePreviewTrader = (traderId) => {
    setPreviewTraderId(traderId);
  };

  const handleStartWithTrader = (traderId) => {
    setGame((current) => current ? chooseTrader(current, traderId) : createGame({ traderId, seed: Date.now() }));
    setPreviewTraderId(traderId);
  };

  const handlePlayCard = (cardId) => {
    if (!game) return;
    setGame((current) => playCard(current, cardId));
    setInspectedCardId(null);
  };

  const handleEndTurn = () => {
    if (!game) return;
    setGame((current) => endTurn(current));
  };

  const handleRecoverHand = () => {
    if (!game) return;
    setGame((current) => recoverHand(current));
  };

  const handleBankCred = () => {
    if (!game) return;
    setGame((current) => bankCred(current));
  };

  const handleReset = () => {
    const traderId = activeTrader?.id || previewTrader.id;
    setGame(createGame({ traderId, seed: Date.now() }));
    setPreviewTraderId(traderId);
    setInspectedCardId(null);
  };

  const handleInspectMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setTilt({
      mx: x,
      my: y,
      rx: ((y - 50) / 50) * -8,
      ry: ((x - 50) / 50) * 8,
    });
  };

  const closeInspect = () => {
    setInspectedCardId(null);
    setTilt({ rx: 0, ry: 0, mx: 50, my: 50 });
  };

  if (isSceneMode) {
    return (
      <main className="tt-shell tt-shell-scene">
        <style>{STYLES}</style>
        <div className="tt-scene-top">
          <div>
            <p className="tt-kicker">Terminal Traders // Scene Mode</p>
            <h1>Terminal Traders</h1>
          </div>
          {onExit && (
            <button className="tt-exit-button" onClick={onExit}>
              Exit Table
            </button>
          )}
        </div>

        {!game ? (
          <div className="tt-scene-picker">
            <div className="tt-scene-picker-card" style={{ "--accent": previewTrader.color }}>
              <span>Choose Trader</span>
              <h2>{previewTrader.name}</h2>
              <p>{previewTrader.abilityText}</p>
              <blockquote>{previewTrader.quote}</blockquote>
              <div className="tt-scene-traders">
                {TRADERS.map((trader) => {
                  const thumbnail = TRADER_THUMBNAILS[trader.id];
                  const isActive = trader.id === previewTrader.id;
                  return (
                  <button
                    key={trader.id}
                    className={isActive ? "is-active" : ""}
                    style={{ "--accent": trader.color }}
                    onClick={() => handlePreviewTrader(trader.id)}
                    title={`${trader.name} - ${trader.handle}`}
                  >
                    <img src={thumbnail?.portrait} alt={trader.name} />
                    <span>{thumbnail?.label || trader.name}</span>
                    <small>{isActive ? "SELECTED" : "TAP"}</small>
                  </button>
                  );
                })}
              </div>
              <button className="tt-scene-start" onClick={() => handleStartWithTrader(previewTrader.id)}>
                Start as {previewTrader.name}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="tt-scene-scoreboard">
              {game.players.map((player) => (
                <PlayerPanel key={player.id} player={player} isHuman={player.isHuman} compact />
              ))}
            </div>

            {!winner && (
              <>
                <div className="tt-scene-center">
                  <div className="tt-market-card tt-scene-market">
                    <div className="tt-card-type">Market</div>
                    {game.currentMarket ? (
                      <>
                        <h2>{game.currentMarket.name}</h2>
                        <p>{game.currentMarket.effectText}</p>
                        <span>{game.currentMarket.rarity}</span>
                      </>
                    ) : (
                      <>
                        <h2>Opening Bell</h2>
                        <p>The first market card flips when you end your turn.</p>
                        <span>standby</span>
                      </>
                    )}
                  </div>

                  <div className="tt-round-panel tt-scene-round">
                    <p>Round</p>
                    <strong>{Math.min(game.round, TERMINAL_TRADERS_RULES.maxRounds)} / {TERMINAL_TRADERS_RULES.maxRounds}</strong>
                    <p>Plays Left</p>
                    <strong>{game.playsRemaining}</strong>
                    <button className="tt-end-button" onClick={handleEndTurn}>End Turn</button>
                    <button className="tt-reset-button" onClick={handleReset}>New Table</button>
                  </div>
                </div>

                <div className="tt-scene-side">
                  <div className="tt-panel tt-turn-guide">
                    <div className="tt-panel-title">Turn Guide</div>
                    <div className="tt-guide-row">
                      <span>Goal</span>
                      <strong>Reach 100 Portfolio</strong>
                    </div>
                    <div className="tt-guide-row">
                      <span>Next</span>
                      <strong>{canBankCred ? "Bank Cred or end turn" : "Play cards or end turn"}</strong>
                    </div>
                  </div>
                  <div className="tt-panel tt-scene-log">
                    <div className="tt-panel-title">Terminal Log</div>
                    <ol className="tt-log">
                      {game.log.slice(0, 5).map((entry, index) => (
                        <li key={`${entry}-${index}`}>{entry}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </>
            )}

            {winner ? (
              <div className="tt-end-screen tt-scene-end">
                <div>
                  <span>Market Closed</span>
                  <h2>{winner.name} wins the table</h2>
                  <button className="tt-end-button" onClick={handleReset}>New Table</button>
                </div>
                <ol>
                  {standings.map((player, index) => (
                    <li key={player.id}>
                      <strong>{index + 1}. {player.name}</strong>
                      <span>{player.portfolio} Portfolio · {player.cred} Cred</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="tt-hand tt-scene-hand">
              {game.hand.length > 0 ? (
                <>
                  {canBankCred && (
                    <div className="tt-bench-alert">
                      <div>
                        <span>No playable cards</span>
                        <strong>Your hand costs more Cred than you have.</strong>
                      </div>
                      <button onClick={handleBankCred}>Bank 3 Cred</button>
                    </div>
                  )}
                  {game.hand.map((card, index) => (
                    <PlayableCard
                      key={`${card.id}-${index}`}
                      card={card}
                      canPlay={game.status === "playing" && game.playsRemaining > 0 && card.cost <= game.players[0].cred}
                      onInspect={() => setInspectedCardId(card.id)}
                    />
                  ))}
                </>
              ) : (
                <div className="tt-empty-hand">
                  <span>Hand Empty</span>
                  <strong>Emergency refill available</strong>
                  <p>Draw 3 cards and keep at least 1 play for this turn.</p>
                  <button onClick={handleRecoverHand} disabled={game.status !== "playing"}>Refill Hand</button>
                </div>
              )}
              </div>
            )}
            {inspectedCard && (
              <CardInspectOverlay
                card={inspectedCard}
                canPlay={game.status === "playing" && game.playsRemaining > 0 && inspectedCard.cost <= game.players[0].cred}
                onPlay={() => handlePlayCard(inspectedCard.id)}
                onClose={closeInspect}
                onMove={handleInspectMove}
                tilt={tilt}
              />
            )}
          </>
        )}
      </main>
    );
  }

  return (
    <main className={`tt-shell ${isSceneMode ? "tt-shell-scene" : ""}`}>
      <style>{STYLES}</style>
      <div className="tt-grid" aria-hidden />

      <section className="tt-topbar">
        <div>
          <p className="tt-kicker">Terminal Traders // Genesis Set</p>
          <h1>{isSceneMode ? "Terminal Traders" : "Neon Desk Battle"}</h1>
        </div>
        {onExit && (
          <button className="tt-exit-button" onClick={onExit}>
            Exit Table
          </button>
        )}
        <div className="tt-stats" aria-label="Genesis set card counts">
          <Stat label="Cards" value={collectionStats.total} />
          <Stat label="Coins" value={collectionStats.coins} />
          <Stat label="Actions" value={collectionStats.actions} />
          <Stat label="Markets" value={collectionStats.markets} />
        </div>
      </section>

      <section className="tt-layout">
        <aside className="tt-left">
          <div className="tt-panel tt-roster">
            <div className="tt-panel-title">Choose Trader</div>
            <div className="tt-trader-list">
              {TRADERS.map((trader) => (
                <button
                  key={trader.id}
                  className={`tt-trader-pick ${trader.id === previewTrader.id ? "is-active" : ""} ${activeTrader && trader.id === activeTrader.id ? "is-current" : ""}`}
                  style={{ "--accent": trader.color }}
                  onClick={() => handlePreviewTrader(trader.id)}
                >
                  <span className="tt-trader-name">{trader.name}</span>
                  <span className="tt-trader-handle">{trader.handle}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="tt-panel tt-ability" style={{ "--accent": previewTrader.color }}>
            <div className="tt-panel-title">{previewTrader.abilityName}</div>
            <p>{previewTrader.abilityText}</p>
            <blockquote>{previewTrader.quote}</blockquote>
            {!game || previewTrader.id !== activeTrader?.id ? (
              <button className="tt-start-trader" onClick={() => handleStartWithTrader(previewTrader.id)}>
                Start as {previewTrader.name}
              </button>
            ) : (
              <div className="tt-current-trader">Current trader</div>
            )}
          </div>

          <div className="tt-panel tt-rules">
            <div className="tt-panel-title">Quick Rules</div>
            <ol>
              <li>Pick a trader. You start with 5 cards, Cred, and a special ability.</li>
              <li>Cred pays for cards. Portfolio wins the game.</li>
              <li>On your turn, play up to 2 cards from your hand.</li>
              <li>Coin cards cost Cred and add Portfolio value.</li>
              <li>Action cards create pumps, hacks, shields, or extra Cred.</li>
              <li>End your turn. The other traders act, then a Market card flips.</li>
              <li>First trader to 100 Portfolio wins. If nobody gets there, highest Portfolio after 10 rounds wins.</li>
            </ol>
          </div>
        </aside>

        {game ? (
        <section className="tt-table">
          <div className="tt-scoreboard">
            {game.players.map((player) => (
              <PlayerPanel key={player.id} player={player} isHuman={player.isHuman} />
            ))}
          </div>

          <div className="tt-market-row">
            <div className="tt-market-card">
              <div className="tt-card-type">Market</div>
              {game.currentMarket ? (
                <>
                  <h2>{game.currentMarket.name}</h2>
                  <p>{game.currentMarket.effectText}</p>
                  <span>{game.currentMarket.rarity}</span>
                </>
              ) : (
                <>
                  <h2>Opening Bell</h2>
                  <p>The first market card flips when you end your turn.</p>
                  <span>standby</span>
                </>
              )}
            </div>

            <div className="tt-round-panel">
              <p>Round</p>
              <strong>{Math.min(game.round, TERMINAL_TRADERS_RULES.maxRounds)} / {TERMINAL_TRADERS_RULES.maxRounds}</strong>
              <p>Plays Left</p>
              <strong>{game.playsRemaining}</strong>
              {winner ? (
                <div className="tt-winner">{winner.name} wins</div>
              ) : (
                <button className="tt-end-button" onClick={handleEndTurn}>End Turn</button>
              )}
              <button className="tt-reset-button" onClick={handleReset}>New Table</button>
            </div>
          </div>

          {winner && (
            <div className="tt-end-screen">
              <div>
                <span>Market Closed</span>
                <h2>{winner.name} wins the table</h2>
              </div>
              <ol>
                {standings.map((player, index) => (
                  <li key={player.id}>
                    <strong>{index + 1}. {player.name}</strong>
                    <span>{player.portfolio} Portfolio · {player.cred} Cred</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="tt-hand">
            {game.hand.length > 0 ? (
              <>
                {canBankCred && (
                  <div className="tt-bench-alert">
                    <div>
                      <span>No playable cards</span>
                      <strong>Your hand costs more Cred than you have.</strong>
                    </div>
                    <button onClick={handleBankCred}>Bank 3 Cred</button>
                  </div>
                )}
                {game.hand.map((card, index) => (
                  <PlayableCard
                    key={`${card.id}-${index}`}
                    card={card}
                    canPlay={game.status === "playing" && game.playsRemaining > 0 && card.cost <= game.players[0].cred}
                    onInspect={() => setInspectedCardId(card.id)}
                  />
                ))}
              </>
            ) : (
              <div className="tt-empty-hand">
                <span>Hand Empty</span>
                <strong>Emergency refill available</strong>
                <p>Draw 3 cards and keep at least 1 play for this turn.</p>
                <button onClick={handleRecoverHand} disabled={game.status !== "playing"}>Refill Hand</button>
              </div>
            )}
          </div>
        </section>
        ) : (
          <section className="tt-lobby">
            <div className="tt-lobby-card" style={{ "--accent": previewTrader.color }}>
              <span>Ready Room</span>
              <h2>Choose your trader before the hand is dealt.</h2>
              <p>
                Browse the four abilities on the left. When you click Start,
                the Genesis deck deals your first 5 cards and the table opens.
              </p>
              <button onClick={() => handleStartWithTrader(previewTrader.id)}>
                Start as {previewTrader.name}
              </button>
            </div>
          </section>
        )}

        <aside className="tt-right">
          {game ? (
          <>
          <div className="tt-panel tt-turn-guide">
            <div className="tt-panel-title">Turn Guide</div>
            <div className="tt-guide-row">
              <span>Goal</span>
              <strong>Reach 100 Portfolio</strong>
            </div>
            <div className="tt-guide-row">
              <span>Spend</span>
              <strong>Cred pays card costs</strong>
            </div>
            <div className="tt-guide-row">
              <span>This Turn</span>
              <strong>{game.playsRemaining} plays left</strong>
            </div>
            <div className="tt-guide-row">
              <span>Next</span>
              <strong>{canBankCred ? "Bank Cred or end turn" : "Play cards or end turn"}</strong>
            </div>
          </div>

          <div className="tt-panel">
            <div className="tt-panel-title">Terminal Log</div>
            <ol className="tt-log">
              {game.log.slice(0, 9).map((entry, index) => (
                <li key={`${entry}-${index}`}>{entry}</li>
              ))}
            </ol>
          </div>
          </>
          ) : (
            <div className="tt-panel tt-turn-guide">
              <div className="tt-panel-title">Before You Play</div>
              <div className="tt-guide-row">
                <span>Step 1</span>
                <strong>Preview each trader ability</strong>
              </div>
              <div className="tt-guide-row">
                <span>Step 2</span>
                <strong>Click Start as your favorite trader</strong>
              </div>
              <div className="tt-guide-row">
                <span>Step 3</span>
                <strong>Your 5-card hand appears after the deal</strong>
              </div>
            </div>
          )}
        </aside>
      </section>
      {inspectedCard && (
        <CardInspectOverlay
          card={inspectedCard}
          canPlay={game.status === "playing" && game.playsRemaining > 0 && inspectedCard.cost <= game.players[0].cred}
          onPlay={() => handlePlayCard(inspectedCard.id)}
          onClose={closeInspect}
          onMove={handleInspectMove}
          tilt={tilt}
        />
      )}
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="tt-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PlayerPanel({ player, isHuman, compact = false }) {
  return (
    <article className={`tt-player ${compact ? "tt-player-compact" : ""}`} style={{ "--accent": player.color }}>
      <div className="tt-player-top">
        <div>
          <h2>{player.name}</h2>
          <p>{player.handle}</p>
        </div>
        {isHuman && <span className="tt-you">You</span>}
      </div>
      <div className="tt-player-meters">
        <Meter label="Portfolio" value={player.portfolio} max={TERMINAL_TRADERS_RULES.winPortfolio} />
        <Meter label="Cred" value={player.cred} max={30} />
      </div>
      <div className="tt-holdings">
        {player.holdings.length > 0 ? (
          player.holdings.slice(-4).map((holding, index) => (
            <span key={`${player.id}-${holding.cardId}-${holding.value}-${index}`}>{holding.name} +{holding.value}</span>
          ))
        ) : (
          <span>No coins held</span>
        )}
      </div>
    </article>
  );
}

function Meter({ label, value, max }) {
  const width = `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
  return (
    <div className="tt-meter">
      <div className="tt-meter-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="tt-meter-track">
        <div className="tt-meter-fill" style={{ width }} />
      </div>
    </div>
  );
}

function PlayableCard({ card, canPlay, onInspect }) {
  const typeLabel = card.type === CARD_TYPES.COIN ? card.ticker : card.tag;
  const cardTypeLabel = card.type === CARD_TYPES.COIN ? "Coin Card" : "Action Card";
  const gainLabel = getGainLabel(card);
  const styleLabel = card.type === CARD_TYPES.COIN ? card.tag : card.tag;
  const artSrc = CARD_ART[card.id];

  return (
    <button
      className={`tt-card tt-card-${card.type} ${artSrc ? "tt-card-art" : ""} ${canPlay ? "" : "is-disabled"}`}
      onClick={onInspect}
      disabled={false}
      title={canPlay ? `Inspect ${card.name}` : `Inspect ${card.name} - not enough Cred or plays`}
    >
      {artSrc ? (
        <>
          <img className="tt-card-art-img" src={artSrc} alt={card.name} />
          <div className="tt-card-art-summary">
            <span>{cardTypeLabel}</span>
            <strong>{card.cost} Cred</strong>
            <strong>{gainLabel}</strong>
          </div>
        </>
      ) : (
        <>
          <span className="tt-card-rarity">{card.rarity}</span>
          <span className="tt-card-kind">{cardTypeLabel}</span>
          <strong>{card.name}</strong>
          <span className="tt-card-type">{typeLabel}</span>
          <p>{card.effectText}</p>
          <div className="tt-card-details">
            <span>Cost</span>
            <strong>{card.cost} Cred</strong>
            <span>Gain</span>
            <strong>{gainLabel}</strong>
            <span>Style</span>
            <strong>{styleLabel}</strong>
          </div>
        </>
      )}
    </button>
  );
}

function CardInspectOverlay({ card, canPlay, onPlay, onClose, onMove, tilt }) {
  const artSrc = CARD_ART[card.id];
  const cardTypeLabel = card.type === CARD_TYPES.COIN ? "Coin Card" : "Action Card";
  const gainLabel = getGainLabel(card);
  const styleLabel = card.type === CARD_TYPES.COIN ? card.tag : card.tag;
  const unavailableReason = canPlay ? "" : `Needs ${card.cost} Cred and an available play.`;

  return (
    <div className="tt-inspect-backdrop" onClick={onClose}>
      <div className="tt-inspect-shell" onClick={(event) => event.stopPropagation()}>
        <button className="tt-inspect-close" onClick={onClose} aria-label="Close card preview">Close</button>
        <div
          className={`tt-inspect-card ${artSrc ? "has-art" : ""}`}
          onMouseMove={onMove}
          onMouseLeave={() => onMove({ currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }) }, clientX: 0.5, clientY: 0.5 })}
          style={{
            "--rx": `${tilt.rx}deg`,
            "--ry": `${tilt.ry}deg`,
            "--mx": `${tilt.mx}%`,
            "--my": `${tilt.my}%`,
          }}
        >
          <div className="tt-inspect-rotator">
            {artSrc ? (
              <img src={artSrc} alt={card.name} />
            ) : (
              <div className="tt-inspect-generated">
                <span>{card.rarity}</span>
                <h2>{card.name}</h2>
                <strong>{cardTypeLabel}</strong>
                <p>{card.effectText}</p>
              </div>
            )}
            <div className="tt-inspect-shine" />
          </div>
        </div>
        <div className="tt-inspect-info">
          <div>
            <span>{cardTypeLabel}</span>
            <h2>{card.name}</h2>
            <p>{card.effectText}</p>
          </div>
          <dl>
            <div>
              <dt>Cost</dt>
              <dd>{card.cost} Cred</dd>
            </div>
            <div>
              <dt>Gain</dt>
              <dd>{gainLabel}</dd>
            </div>
            <div>
              <dt>Style</dt>
              <dd>{styleLabel}</dd>
            </div>
          </dl>
          {!canPlay && <p className="tt-inspect-warning">{unavailableReason}</p>}
          <div className="tt-inspect-actions">
            <button className="tt-inspect-play" onClick={onPlay} disabled={!canPlay}>Play Card</button>
            <button className="tt-inspect-cancel" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getGainLabel(card) {
  if (card.type === CARD_TYPES.COIN) return `+${card.baseValue} Portfolio`;
  const parts = [];
  if (card.effect?.portfolio) parts.push(`${signed(card.effect.portfolio)} Portfolio`);
  if (card.effect?.cred) parts.push(`${signed(card.effect.cred)} Cred`);
  if (card.effect?.shield) parts.push(`+${card.effect.shield} Shield`);
  if (card.effect?.draw) parts.push(`+${card.effect.draw} Card`);
  if (parts.length === 0) return "Special";
  return parts.join(" / ");
}

function signed(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

const STYLES = `
  .tt-shell {
    min-height: 100vh;
    position: relative;
    overflow: hidden;
    padding: 28px;
    background:
      radial-gradient(circle at 12% 16%, rgba(255, 122, 217, 0.18), transparent 28%),
      radial-gradient(circle at 86% 24%, rgba(83, 255, 214, 0.18), transparent 28%),
      linear-gradient(135deg, #040607 0%, #11120d 48%, #06090d 100%);
    color: #effff9;
    font-family: "Trebuchet MS", "Avenir Next", sans-serif;
  }

  .tt-shell-scene {
    min-height: 100%;
    height: 100%;
    overflow: auto;
    padding: 18px;
    background:
      radial-gradient(circle at 12% 16%, rgba(255, 122, 217, 0.12), transparent 28%),
      radial-gradient(circle at 86% 24%, rgba(83, 255, 214, 0.13), transparent 28%),
      linear-gradient(135deg, rgba(4, 6, 7, 0.86), rgba(6, 9, 13, 0.82));
  }

  .tt-grid {
    position: fixed;
    inset: 0;
    opacity: 0.2;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(75, 255, 91, 0.28) 1px, transparent 1px),
      linear-gradient(90deg, rgba(75, 255, 91, 0.28) 1px, transparent 1px);
    background-size: 78px 78px;
    transform: perspective(700px) rotateX(58deg) translateY(-220px) scale(1.8);
    transform-origin: top center;
  }

  .tt-topbar {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 24px;
  }

  .tt-shell-scene .tt-topbar {
    align-items: center;
    margin-bottom: 14px;
  }

  .tt-kicker,
  .tt-panel-title,
  .tt-card-rarity,
  .tt-card-kind,
  .tt-card-type,
  .tt-stat span {
    text-transform: uppercase;
    letter-spacing: 0;
    color: #9cfce9;
    font-size: 12px;
  }

  .tt-shell h1 {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(42px, 6vw, 86px);
    line-height: 0.9;
    color: #fff7ce;
    text-shadow: 0 0 24px rgba(246, 211, 101, 0.35);
  }

  .tt-shell-scene h1 {
    font-size: clamp(30px, 4vw, 52px);
  }

  .tt-exit-button {
    border: 1px solid rgba(255, 122, 217, 0.45);
    border-radius: 8px;
    padding: 11px 14px;
    color: #ffe9f8;
    background: rgba(255, 122, 217, 0.12);
    cursor: pointer;
    font-weight: 900;
    text-transform: uppercase;
    font-size: 12px;
  }

  .tt-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(74px, 1fr));
    gap: 8px;
    min-width: 360px;
  }

  .tt-stat,
  .tt-panel,
  .tt-player,
  .tt-market-card,
  .tt-round-panel,
  .tt-card {
    border: 1px solid rgba(156, 252, 233, 0.22);
    background: rgba(5, 12, 13, 0.78);
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(14px);
  }

  .tt-stat {
    padding: 10px 12px;
    border-radius: 8px;
  }

  .tt-stat strong {
    display: block;
    font-size: 24px;
  }

  .tt-layout {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr) 290px;
    gap: 16px;
  }

  .tt-shell-scene .tt-layout {
    grid-template-columns: 240px minmax(0, 1fr) 270px;
    gap: 12px;
  }

  .tt-shell-scene .tt-panel,
  .tt-shell-scene .tt-player,
  .tt-shell-scene .tt-market-card,
  .tt-shell-scene .tt-round-panel,
  .tt-shell-scene .tt-card,
  .tt-shell-scene .tt-stat {
    background: rgba(5, 12, 13, 0.7);
  }

  .tt-shell-scene .tt-scoreboard {
    grid-template-columns: repeat(4, minmax(132px, 1fr));
  }

  .tt-shell-scene .tt-card {
    min-height: 198px;
  }

  .tt-shell-scene .tt-card strong {
    min-height: 34px;
  }

  .tt-left,
  .tt-right {
    display: grid;
    gap: 16px;
    align-content: start;
  }

  .tt-panel {
    border-radius: 8px;
    padding: 16px;
  }

  .tt-panel p,
  .tt-panel blockquote {
    color: rgba(239, 255, 249, 0.78);
    line-height: 1.45;
  }

  .tt-panel blockquote {
    margin: 16px 0 0;
    padding-left: 12px;
    border-left: 2px solid var(--accent, #53ffd6);
  }

  .tt-rules ol {
    margin: 12px 0 0;
    padding-left: 18px;
    display: grid;
    gap: 8px;
    color: rgba(239, 255, 249, 0.74);
    font-size: 13px;
    line-height: 1.38;
  }

  .tt-rules li::marker {
    color: #53ffd6;
    font-weight: 900;
  }

  .tt-trader-list {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }

  .tt-trader-pick {
    text-align: left;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    color: #effff9;
    border-radius: 8px;
    padding: 12px;
    cursor: pointer;
  }

  .tt-trader-pick.is-active {
    border-color: var(--accent);
    box-shadow: 0 0 26px color-mix(in srgb, var(--accent) 38%, transparent);
  }

  .tt-trader-pick.is-current .tt-trader-name::after {
    content: " current";
    margin-left: 6px;
    color: var(--accent);
    font-size: 10px;
    text-transform: uppercase;
  }

  .tt-trader-name,
  .tt-trader-handle {
    display: block;
  }

  .tt-trader-name {
    font-weight: 800;
  }

  .tt-trader-handle {
    margin-top: 3px;
    color: rgba(239, 255, 249, 0.64);
    font-size: 12px;
  }

  .tt-start-trader {
    width: 100%;
    margin-top: 16px;
    border: 0;
    border-radius: 8px;
    padding: 11px 12px;
    cursor: pointer;
    font-weight: 900;
    color: #06100e;
    background: var(--accent);
  }

  .tt-current-trader {
    margin-top: 16px;
    border: 1px solid color-mix(in srgb, var(--accent) 44%, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--accent);
    text-align: center;
    text-transform: uppercase;
    font-size: 12px;
    font-weight: 900;
  }

  .tt-table {
    display: grid;
    gap: 16px;
    min-width: 0;
  }

  .tt-lobby {
    min-height: 520px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(156, 252, 233, 0.16);
    border-radius: 8px;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
      rgba(5, 12, 13, 0.48);
    backdrop-filter: blur(10px);
  }

  .tt-lobby-card {
    width: min(560px, calc(100% - 36px));
    border: 1px solid color-mix(in srgb, var(--accent) 46%, rgba(255, 255, 255, 0.12));
    border-radius: 8px;
    background: rgba(5, 12, 13, 0.82);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38), 0 0 34px color-mix(in srgb, var(--accent) 22%, transparent);
    padding: 28px;
  }

  .tt-lobby-card span {
    color: var(--accent);
    text-transform: uppercase;
    font-size: 12px;
  }

  .tt-lobby-card h2 {
    margin: 8px 0 12px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 38px;
    line-height: 1;
    color: #fff7ce;
  }

  .tt-lobby-card p {
    margin: 0;
    color: rgba(239, 255, 249, 0.74);
    line-height: 1.45;
  }

  .tt-lobby-card button {
    width: 100%;
    margin-top: 20px;
    border: 0;
    border-radius: 8px;
    padding: 13px 14px;
    cursor: pointer;
    font-weight: 900;
    color: #06100e;
    background: var(--accent);
  }

  .tt-scoreboard {
    display: grid;
    grid-template-columns: repeat(4, minmax(150px, 1fr));
    gap: 10px;
  }

  .tt-player {
    border-radius: 8px;
    padding: 14px;
    border-color: color-mix(in srgb, var(--accent) 48%, rgba(255, 255, 255, 0.12));
  }

  .tt-player-top {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    min-height: 58px;
  }

  .tt-player h2 {
    margin: 0;
    font-size: 18px;
  }

  .tt-player p {
    margin: 4px 0 0;
    color: rgba(239, 255, 249, 0.62);
    font-size: 12px;
  }

  .tt-you,
  .tt-winner {
    align-self: start;
    color: #050707;
    background: var(--accent);
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .tt-player-meters {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }

  .tt-meter-label {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: rgba(239, 255, 249, 0.72);
  }

  .tt-meter-track {
    height: 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.09);
    overflow: hidden;
  }

  .tt-meter-fill {
    height: 100%;
    border-radius: inherit;
    background: var(--accent);
    box-shadow: 0 0 16px var(--accent);
  }

  .tt-holdings {
    min-height: 54px;
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-content: start;
  }

  .tt-holdings span {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    padding: 4px 7px;
    color: rgba(239, 255, 249, 0.72);
    font-size: 11px;
  }

  .tt-market-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 170px;
    gap: 12px;
  }

  .tt-end-screen {
    border: 1px solid rgba(246, 211, 101, 0.36);
    border-radius: 8px;
    background: rgba(246, 211, 101, 0.08);
    padding: 18px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 0.8fr);
    gap: 18px;
  }

  .tt-end-screen span {
    color: #9cfce9;
    text-transform: uppercase;
    font-size: 12px;
  }

  .tt-end-screen h2 {
    margin: 6px 0 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 32px;
    color: #fff7ce;
  }

  .tt-end-screen ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 8px;
  }

  .tt-end-screen li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 8px;
  }

  .tt-end-screen li strong {
    color: #effff9;
  }

  .tt-market-card,
  .tt-round-panel {
    border-radius: 8px;
    padding: 18px;
  }

  .tt-market-card h2 {
    margin: 6px 0 10px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 34px;
    color: #fff7ce;
  }

  .tt-market-card p {
    max-width: 680px;
    color: rgba(239, 255, 249, 0.74);
  }

  .tt-market-card span {
    color: #ff7ad9;
    text-transform: uppercase;
    font-size: 12px;
  }

  .tt-round-panel {
    display: grid;
    gap: 8px;
  }

  .tt-round-panel p {
    margin: 0;
    color: rgba(239, 255, 249, 0.56);
    text-transform: uppercase;
    font-size: 11px;
  }

  .tt-round-panel strong {
    font-size: 26px;
  }

  .tt-end-button,
  .tt-reset-button {
    border: 0;
    border-radius: 8px;
    padding: 11px 12px;
    cursor: pointer;
    font-weight: 900;
    color: #06100e;
    background: #53ffd6;
  }

  .tt-reset-button {
    color: #effff9;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .tt-hand {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }

  .tt-bench-alert {
    grid-column: 1 / -1;
    border: 1px solid rgba(246, 211, 101, 0.34);
    border-radius: 8px;
    background: rgba(246, 211, 101, 0.08);
    padding: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .tt-bench-alert span,
  .tt-bench-alert strong {
    display: block;
  }

  .tt-bench-alert span {
    color: #f6d365;
    text-transform: uppercase;
    font-size: 12px;
  }

  .tt-bench-alert strong {
    margin-top: 3px;
    color: rgba(239, 255, 249, 0.82);
    font-size: 13px;
  }

  .tt-bench-alert button {
    border: 0;
    border-radius: 8px;
    padding: 10px 13px;
    cursor: pointer;
    font-weight: 900;
    color: #161009;
    background: #f6d365;
    white-space: nowrap;
  }

  .tt-card {
    min-height: 222px;
    border-radius: 8px;
    color: #effff9;
    text-align: left;
    padding: 13px;
    cursor: pointer;
    display: grid;
    align-content: start;
    gap: 8px;
    transition: transform 160ms ease, border-color 160ms ease, opacity 160ms ease;
  }

  .tt-card:hover {
    transform: translateY(-5px);
    border-color: #53ffd6;
  }

  .tt-card.is-disabled {
    opacity: 0.68;
    cursor: zoom-in;
  }

  .tt-card strong {
    min-height: 44px;
    font-size: 18px;
    color: #fff7ce;
  }

  .tt-card-kind {
    justify-self: start;
    border: 1px solid rgba(156, 252, 233, 0.34);
    border-radius: 999px;
    padding: 4px 7px;
    color: #effff9;
    background: rgba(156, 252, 233, 0.08);
  }

  .tt-card p {
    margin: 0;
    color: rgba(239, 255, 249, 0.72);
    font-size: 13px;
    line-height: 1.35;
  }

  .tt-card-details {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 5px 10px;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .tt-card-details span {
    color: rgba(239, 255, 249, 0.48);
    text-transform: uppercase;
    font-size: 11px;
  }

  .tt-card-details strong {
    min-height: 0;
    color: #9cfce9;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .tt-card-coin {
    border-color: rgba(246, 211, 101, 0.36);
  }

  .tt-card-action {
    border-color: rgba(255, 122, 217, 0.3);
  }

  .tt-inspect-backdrop {
    position: fixed;
    inset: 0;
    z-index: 5000;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.58);
    backdrop-filter: blur(8px);
    pointer-events: auto;
  }

  .tt-inspect-shell {
    position: relative;
    width: min(980px, calc(100vw - 32px));
    display: grid;
    grid-template-columns: minmax(280px, 430px) minmax(260px, 1fr);
    gap: 22px;
    align-items: center;
  }

  .tt-inspect-close {
    position: absolute;
    top: -42px;
    right: 0;
    border: 1px solid rgba(255, 122, 217, 0.45);
    border-radius: 8px;
    padding: 9px 12px;
    color: #ffe9f8;
    background: rgba(255, 122, 217, 0.12);
    cursor: pointer;
    font-weight: 900;
    text-transform: uppercase;
    font-size: 12px;
  }

  .tt-inspect-card {
    perspective: 900px;
    transform-style: preserve-3d;
  }

  .tt-inspect-rotator {
    position: relative;
    overflow: hidden;
    border-radius: 18px;
    transform: rotateX(var(--rx)) rotateY(var(--ry));
    transform-style: preserve-3d;
    transition: transform 120ms ease-out, box-shadow 180ms ease;
    box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55), 0 0 34px rgba(83, 255, 214, 0.22);
    background: #050707;
  }

  .tt-inspect-card img {
    display: block;
    width: 100%;
    max-height: min(74vh, 620px);
    object-fit: contain;
    border-radius: 18px;
  }

  .tt-inspect-shine {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    mix-blend-mode: screen;
    opacity: 0.62;
    background:
      radial-gradient(circle at var(--mx) var(--my), rgba(255, 255, 255, 0.68), transparent 18%),
      linear-gradient(115deg, transparent 24%, rgba(83, 255, 214, 0.22), rgba(255, 122, 217, 0.24), transparent 58%);
    transform: translateZ(1px);
  }

  .tt-inspect-generated {
    min-height: 560px;
    padding: 26px;
    display: grid;
    align-content: start;
    gap: 14px;
    border: 1px solid rgba(156, 252, 233, 0.32);
    background:
      radial-gradient(circle at 30% 20%, rgba(255, 122, 217, 0.18), transparent 34%),
      linear-gradient(135deg, rgba(5, 12, 13, 0.98), rgba(10, 22, 24, 0.96));
  }

  .tt-inspect-generated span,
  .tt-inspect-info span,
  .tt-inspect-info dt {
    color: #9cfce9;
    text-transform: uppercase;
    font-size: 12px;
  }

  .tt-inspect-generated h2,
  .tt-inspect-info h2 {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    color: #fff7ce;
    font-size: 42px;
    line-height: 1;
  }

  .tt-inspect-info {
    border: 1px solid rgba(156, 252, 233, 0.24);
    border-radius: 8px;
    padding: 20px;
    background: rgba(5, 12, 13, 0.86);
    box-shadow: 0 22px 70px rgba(0, 0, 0, 0.44);
  }

  .tt-inspect-info p {
    color: rgba(239, 255, 249, 0.75);
    line-height: 1.45;
  }

  .tt-inspect-info dl {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 18px 0;
  }

  .tt-inspect-info dl div {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.04);
  }

  .tt-inspect-info dd {
    margin: 6px 0 0;
    color: #effff9;
    font-weight: 900;
  }

  .tt-inspect-warning {
    color: #f6d365 !important;
  }

  .tt-inspect-actions {
    display: flex;
    gap: 10px;
  }

  .tt-inspect-actions button {
    flex: 1;
    border-radius: 8px;
    padding: 13px 14px;
    cursor: pointer;
    font-weight: 900;
  }

  .tt-inspect-play {
    border: 0;
    color: #06100e;
    background: #53ffd6;
  }

  .tt-inspect-play:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .tt-inspect-cancel {
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #effff9;
    background: rgba(255, 255, 255, 0.08);
  }

  .tt-card-art {
    position: relative;
    padding: 0;
    overflow: hidden;
    background: #050707;
    display: block;
  }

  .tt-card-art-img {
    position: absolute;
    inset: 8px;
    width: calc(100% - 16px);
    height: calc(100% - 16px);
    display: block;
    object-fit: contain;
    background: rgba(0, 0, 0, 0.42);
  }

  .tt-card-art-summary {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 3px 8px;
    padding: 7px 8px;
    border: 1px solid rgba(156, 252, 233, 0.24);
    border-radius: 8px;
    background: rgba(2, 5, 8, 0.76);
    backdrop-filter: blur(8px);
  }

  .tt-card-art-summary span {
    grid-column: 1 / -1;
    color: #9cfce9;
    text-transform: uppercase;
    font-size: 10px;
  }

  .tt-card-art-summary strong {
    min-height: 0;
    color: #effff9;
    font-size: 12px;
  }

  .tt-empty-hand {
    min-height: 222px;
    grid-column: 1 / -1;
    border: 1px dashed rgba(156, 252, 233, 0.42);
    border-radius: 8px;
    background: rgba(5, 12, 13, 0.7);
    display: grid;
    place-items: center;
    align-content: center;
    gap: 10px;
    padding: 26px;
    text-align: center;
  }

  .tt-empty-hand span {
    color: #ff7ad9;
    text-transform: uppercase;
    font-size: 12px;
  }

  .tt-empty-hand strong {
    color: #fff7ce;
    font-size: 24px;
  }

  .tt-empty-hand p {
    margin: 0;
    color: rgba(239, 255, 249, 0.68);
  }

  .tt-empty-hand button {
    border: 0;
    border-radius: 8px;
    padding: 11px 16px;
    cursor: pointer;
    font-weight: 900;
    color: #06100e;
    background: #53ffd6;
  }

  .tt-log {
    list-style: none;
    padding: 0;
    margin: 12px 0 0;
    display: grid;
    gap: 9px;
    color: rgba(239, 255, 249, 0.74);
    font-size: 13px;
    line-height: 1.35;
  }

  .tt-log li {
    padding-bottom: 9px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .tt-turn-guide {
    display: grid;
    gap: 10px;
  }

  .tt-guide-row {
    display: grid;
    gap: 3px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 9px;
  }

  .tt-guide-row span {
    color: rgba(239, 255, 249, 0.48);
    text-transform: uppercase;
    font-size: 11px;
  }

  .tt-guide-row strong {
    color: #effff9;
    font-size: 13px;
    line-height: 1.3;
  }

  @media (max-width: 1120px) {
    .tt-layout,
    .tt-shell-scene .tt-layout {
      grid-template-columns: 1fr;
    }

    .tt-left,
    .tt-shell-scene .tt-left {
      grid-template-columns: 1fr 1fr;
    }

    .tt-right {
      order: 3;
    }
  }

  @media (max-width: 760px) {
    .tt-shell {
      padding: 18px;
    }

    .tt-topbar,
    .tt-left,
    .tt-shell-scene .tt-left {
      display: grid;
      grid-template-columns: 1fr;
    }

    .tt-stats,
    .tt-scoreboard,
    .tt-market-row,
    .tt-end-screen {
      grid-template-columns: 1fr;
      min-width: 0;
    }

    .tt-shell h1 {
      font-size: 44px;
    }
  }

  .tt-shell-scene {
    min-height: 100%;
    height: 100%;
    overflow: hidden;
    padding: 0;
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.48)),
      radial-gradient(circle at 50% 48%, rgba(83, 255, 214, 0.08), transparent 34%);
    pointer-events: none;
  }

  .tt-shell-scene .tt-grid {
    display: none;
  }

  .tt-scene-top,
  .tt-scene-scoreboard,
  .tt-scene-center,
  .tt-scene-side,
  .tt-scene-hand,
  .tt-scene-picker,
  .tt-scene-end {
    position: fixed;
    z-index: 2;
    pointer-events: auto;
  }

  .tt-scene-top {
    top: calc(env(safe-area-inset-top, 0px) + 14px);
    left: 18px;
    right: 18px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .tt-scene-top .tt-kicker {
    margin: 0 0 4px;
  }

  .tt-scene-top h1 {
    font-size: clamp(28px, 3.4vw, 48px);
  }

  .tt-scene-top .tt-exit-button {
    flex: 0 0 auto;
  }

  .tt-scene-scoreboard {
    top: calc(env(safe-area-inset-top, 0px) + 72px);
    left: 18px;
    right: 18px;
    display: grid;
    grid-template-columns: repeat(4, minmax(150px, 1fr));
    gap: 10px;
  }

  .tt-player-compact {
    min-height: 0;
    padding: 8px 10px;
  }

  .tt-player-compact .tt-player-top {
    min-height: 28px;
  }

  .tt-player-compact h2 {
    font-size: 14px;
  }

  .tt-player-compact .tt-player-meters {
    gap: 5px;
    margin-top: 8px;
  }

  .tt-player-compact .tt-meter-track {
    height: 6px;
  }

  .tt-player-compact p {
    display: none;
  }

  .tt-player-compact .tt-holdings {
    min-height: 0;
    margin-top: 8px;
    max-height: 25px;
    overflow: hidden;
  }

  .tt-player-compact .tt-holdings span {
    font-size: 10px;
    padding: 3px 6px;
  }

  .tt-scene-center {
    left: 50%;
    bottom: 238px;
    width: min(660px, calc(100vw - 420px));
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: minmax(0, 1fr) 150px;
    gap: 10px;
  }

  .tt-scene-market,
  .tt-scene-round {
    padding: 12px;
    background: rgba(5, 12, 13, 0.72);
  }

  .tt-scene-market h2 {
    font-size: 24px;
    margin: 4px 0 8px;
  }

  .tt-scene-market p {
    margin: 0 0 8px;
    font-size: 12px;
  }

  .tt-scene-round {
    gap: 6px;
  }

  .tt-scene-round strong {
    font-size: 20px;
  }

  .tt-scene-side {
    right: 18px;
    bottom: 238px;
    width: 280px;
    display: grid;
    gap: 10px;
    max-height: calc(100vh - 360px);
    overflow: hidden;
  }

  .tt-scene-side .tt-panel {
    padding: 12px;
  }

  .tt-scene-side .tt-guide-row {
    padding-bottom: 8px;
  }

  .tt-scene-log .tt-log {
    max-height: 132px;
    overflow: hidden;
  }

  .tt-scene-hand {
    left: 18px;
    right: 18px;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
    display: grid;
    grid-template-columns: repeat(5, minmax(132px, 1fr));
    gap: 10px;
    align-items: end;
  }

  .tt-scene-hand .tt-card {
    height: 188px;
    min-height: 0;
    padding: 10px;
    gap: 5px;
    overflow: hidden;
    background: rgba(5, 12, 13, 0.82);
  }

  .tt-scene-hand .tt-card strong {
    min-height: 24px;
    font-size: 14px;
  }

  .tt-scene-hand .tt-card p {
    font-size: 11px;
    line-height: 1.25;
    max-height: 30px;
    overflow: hidden;
  }

  .tt-scene-hand .tt-card-rarity,
  .tt-scene-hand .tt-card-kind,
  .tt-scene-hand .tt-card-type {
    font-size: 10px;
  }

  .tt-scene-hand .tt-card-kind {
    padding: 3px 6px;
  }

  .tt-scene-hand .tt-card-details {
    gap: 3px 8px;
    padding-top: 6px;
  }

  .tt-scene-hand .tt-card-details span,
  .tt-scene-hand .tt-card-details strong {
    font-size: 11px;
  }

  .tt-scene-hand .tt-card-art-img {
    inset: 7px 7px 36px;
    width: calc(100% - 14px);
    height: calc(100% - 43px);
    object-fit: contain;
    padding: 0;
    background: transparent;
  }

  .tt-scene-hand .tt-card-art-summary {
    left: 10px;
    right: 10px;
    bottom: 10px;
    padding: 5px 7px;
    grid-template-columns: 1fr auto;
  }

  .tt-scene-hand .tt-card-art-summary span {
    font-size: 9px;
  }

  .tt-scene-hand .tt-card-art-summary strong {
    font-size: 11px;
  }

  .tt-scene-hand .tt-card-art-summary strong:last-child {
    display: none;
  }

  .tt-scene-picker {
    inset: 0;
    display: grid;
    place-items: center;
    padding: 20px;
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.34));
  }

  .tt-scene-picker-card {
    width: min(620px, calc(100vw - 36px));
    border: 1px solid color-mix(in srgb, var(--accent) 52%, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 22px;
    background: rgba(5, 12, 13, 0.84);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.44), 0 0 34px color-mix(in srgb, var(--accent) 24%, transparent);
  }

  .tt-scene-picker-card span {
    color: var(--accent);
    text-transform: uppercase;
    font-size: 12px;
  }

  .tt-scene-picker-card h2 {
    margin: 6px 0 10px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 42px;
    color: #fff7ce;
  }

  .tt-scene-picker-card p,
  .tt-scene-picker-card blockquote {
    color: rgba(239, 255, 249, 0.78);
    line-height: 1.45;
  }

  .tt-scene-picker-card blockquote {
    margin: 14px 0;
    padding-left: 12px;
    border-left: 2px solid var(--accent);
  }

  .tt-scene-traders {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 16px;
    padding: 7px;
    border: 1px solid rgba(77, 255, 170, 0.16);
    border-radius: 8px;
    background: rgba(2, 5, 8, 0.42);
  }

  .tt-scene-traders button {
    position: relative;
    width: 92px;
    height: 110px;
    padding: 0;
    overflow: hidden;
    border: 2px solid rgba(255, 62, 160, 0.55);
    border-radius: 9px;
    color: #c8ffe0;
    background: rgba(10, 58, 38, 0.18);
    cursor: pointer;
    font-family: "IBM Plex Mono", "SF Mono", Menlo, monospace;
    box-shadow: 0 0 8px rgba(255, 62, 160, 0.28);
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, opacity 160ms ease;
  }

  .tt-scene-traders button:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
    box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 46%, transparent);
  }

  .tt-scene-traders button.is-active {
    border-color: var(--accent);
    color: var(--accent);
    box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 58%, transparent);
  }

  .tt-scene-traders img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .tt-scene-traders button::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 62%;
    background: linear-gradient(180deg, rgba(2, 5, 8, 0) 0%, rgba(2, 5, 8, 0.78) 55%, rgba(2, 5, 8, 0.94) 100%);
  }

  .tt-scene-traders span,
  .tt-scene-traders small {
    position: absolute;
    left: 4px;
    right: 4px;
    z-index: 1;
    text-align: center;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
  }

  .tt-scene-traders span {
    bottom: 21px;
    font-size: 11px;
    letter-spacing: 0.12em;
    font-weight: 800;
  }

  .tt-scene-traders small {
    bottom: 6px;
    color: rgba(200, 255, 224, 0.72);
    font-size: 7px;
    letter-spacing: 0.18em;
    font-weight: 800;
  }

  .tt-scene-traders button.is-active small {
    color: color-mix(in srgb, var(--accent) 84%, white 8%);
  }

  .tt-scene-start {
    border-radius: 8px;
    padding: 10px;
    cursor: pointer;
    font-weight: 900;
  }

  .tt-scene-start {
    width: 100%;
    margin-top: 12px;
    border: 0;
    color: #06100e;
    background: var(--accent);
  }

  .tt-scene-end {
    left: 50%;
    top: 50%;
    width: min(820px, calc(100vw - 40px));
    transform: translate(-50%, -50%);
    background: rgba(5, 12, 13, 0.9);
  }

  .tt-scene-end .tt-end-button {
    margin-top: 18px;
    min-width: 150px;
  }

  @media (max-width: 1100px) {
    .tt-scene-scoreboard {
      grid-template-columns: repeat(2, minmax(150px, 1fr));
    }

    .tt-scene-center {
      left: 18px;
      right: 18px;
      width: auto;
      transform: none;
      bottom: 258px;
    }

    .tt-scene-side {
      display: none;
    }
  }

  @media (max-width: 760px) {
    .tt-scene-scoreboard {
      top: calc(env(safe-area-inset-top, 0px) + 76px);
      grid-template-columns: 1fr 1fr;
    }

    .tt-scene-center {
      grid-template-columns: 1fr;
      bottom: 300px;
    }

    .tt-scene-hand {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      max-height: 282px;
      overflow-y: auto;
    }

    .tt-scene-traders {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 820px) {
    .tt-inspect-shell {
      grid-template-columns: 1fr;
      max-height: calc(100vh - 48px);
      overflow-y: auto;
    }

    .tt-inspect-card img {
      max-height: 58vh;
    }

    .tt-inspect-info dl {
      grid-template-columns: 1fr;
    }
  }
`;
