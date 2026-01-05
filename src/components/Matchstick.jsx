import React, { useState } from 'react'
import styles from './Matchstick.module.css'

const Matchstick = ({ onLight, isLit: externalIsLit }) => {
  const [internalIsLit, setInternalIsLit] = useState(false)
  
  // Use external state if provided, otherwise use internal state
  const isLit = externalIsLit !== undefined ? externalIsLit : internalIsLit

  const handleToggle = () => {
    if (externalIsLit === undefined) {
      setInternalIsLit(!internalIsLit)
    }
    if (onLight && !isLit) {
      onLight()
    }
  }

  return (
    <div className={styles.wrapper} onClick={handleToggle} style={{cursor: 'pointer'}}>
      <div className={styles.container}>
        <input
          type="checkbox"
          name="switch"
          id="switch"
          className={styles.switch}
          checked={isLit}
          onChange={handleToggle}
        />
        <div className={styles.woodWrapper}>
          <div className={styles.wood}>
            <p>b</p>
          </div>
          <div className={styles.tip}></div>
        </div>
   

        <div className={styles.glowingArea}></div>
        <div className={styles.mainGlow}></div>
        <div className={styles.flameContainer}>
          <div className={`${styles.red} ${styles.flame}`}></div>
          <div className={`${styles.orange} ${styles.flame}`}></div>
          <div className={`${styles.yellow} ${styles.flame}`}></div>
          <div className={`${styles.white} ${styles.flame}`}></div>
          <div className={`${styles.blue} ${styles.circle}`}></div>
          <div className={`${styles.black} ${styles.circle}`}></div>
        </div>
      </div>
    </div>
  )
}

export default Matchstick