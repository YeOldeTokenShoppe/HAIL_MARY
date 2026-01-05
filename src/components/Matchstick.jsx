import React, { useState } from 'react'
import styles from './Matchstick.module.css'

const Matchstick = ({ onLight }) => {
  const [isLit, setIsLit] = useState(false)

  const handleToggle = () => {
    setIsLit(!isLit)
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
        <div className={styles['wood-wrapper']}>
          <div className={styles.wood}>
            <p>b</p>
          </div>
          <div className={styles.tip}></div>
        </div>
   

        <div className={styles['glowing-area']}></div>
        <div className={styles['main-glow']}></div>
        <div className={styles['flame-container']}>
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