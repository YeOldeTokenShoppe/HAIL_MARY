#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const USED_FILES = new Set([
  // Icons and Favicons
  'favicon.svg',
  'apple-icon.png',
  'icon.png',
  'favicon.ico',
  
  // Images (General)
  'defaultAvatar.png',
  'senora.png',
  'PinkCloudA.png',
  'nosferatu.png',
  'queenOfHearts1.jpg',
  'virginRecords.jpg',
  'scrollImage.png',
  'cloud.png',
  'octagon.png',
  
  // Images (UI/CSS)
  'divider1.svg',
  'divider2.svg',
  'divider3.svg',
  'doorFrame.png',
  'Door.png',
  'coinFront.png',
  'coinBack1.png',
  
  // Images (Thumbnails/Navigation)
  'I80.png',
  'darkSky.png',
  
  // Background Images/Textures
  'cyberpunk.webp',
  'synthwave.webp',
  'gothicTokyo.webp',
  'neoTokyo.webp',
  'aurora.webp',
  'templeScene.webp',
  'gradient-sunset.webp',
  'chart.webp',
  'pokemon2.webp',
  'gradient-dreams.webp',
  
  // Template Images
  'images/face2.png',
  'images/FeetHands.png',
  
  // Candle Preview Images
  'tinyVotive.webp',
  'tinyJapCan.webp',
  'votiveCandlePreview.webp',
  'japaneseCandlePreview.webp',
  
  // 3D Models (currently used)
  'models/alligatorStroll3.glb',
  'models/singleCandleAnimatedFlame.glb',
  'models/XCandleAnimatedFlame2.glb',
  'models/RL80_4anims.glb',
  'models/MOBILE.glb',
  'models/pyramid.glb',
  'models/saint_robot.glb',
  'models/ourlady_rider7.glb',
  'models/angel2.glb',
  'models/devil2.glb',
  'models/drone.glb',
  'models/drone_mobile.glb',
  'models/marketFight.glb',
  'models/whale.glb',
  'models/arrow.glb',
  'models/angelOfCurrencies.glb',
  'models/fountain2.glb',
  
  // 3D Models (referenced but might be missing - keep for reference)
  'models/tinyVotiveBox.glb',
  'models/tinyJapCanBox.glb',
  'models/tinyVotiveOnly.glb',
  'models/tinyJapCanOnly.glb',
  'models/angel_emoji.glb',
  'models/money_emoji.glb',
  'models/crying_emoji.glb',
  'models/devil_emoji.glb',
  'models/saint_robot2.glb',
  'models/palm2.glb',
  'models/sign2.glb',
  'models/synthSunset.glb',
  'models/lambo5k3.glb',
  
  // Videos
  'videos/23.mp4',
  'videos/neon80s.mp4',
  
  // CSS Files
  'main.css',
  'moonRoom.css',
  'scratch.css',
  
  // HTML Files
  'scroll.html',
  'scroll2.html',
  'scroll3.html',
  'mini-scene.html',
  'css3d-scene.html',
  'dunktank.html',
  'leva-test.html',
  
  // JS Files
  'scroll.js',
  
  // Special images that might be used
  'vsClown.jpg',
  'gothicFrenchComic.webp',
  'stgr80.png',
  'stgr81.png',
  'Green1.webp',
  'Purple1.webp',
  'candles.png',
  'EquirectangularSky.jpg',
  'saintbot.png',
  'sacred.png',
]);

// Directories to preserve entirely
const PRESERVE_DIRS = new Set([
  'candles', // User uploads
  'sounds',  // Referenced dynamically
  'images',  // Template directory
  'videos',  // Video files
]);

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

function analyzePublicDirectory() {
  const publicDir = path.join(process.cwd(), 'public');
  
  if (!fs.existsSync(publicDir)) {
    console.log('❌ Public directory not found!');
    return;
  }

  const allFiles = getAllFiles(publicDir);
  const unusedFiles = [];
  const usedFiles = [];
  const preservedFiles = [];

  allFiles.forEach(filePath => {
    const relativePath = path.relative(publicDir, filePath);
    const normalizedPath = relativePath.replace(/\\/g, '/');
    
    // Check if file is in a preserved directory
    const topLevelDir = normalizedPath.split('/')[0];
    if (PRESERVE_DIRS.has(topLevelDir)) {
      preservedFiles.push(normalizedPath);
    } else if (USED_FILES.has(normalizedPath)) {
      usedFiles.push(normalizedPath);
    } else {
      unusedFiles.push(normalizedPath);
    }
  });

  console.log('📊 Public Directory Analysis');
  console.log('============================');
  console.log(`✅ Used files: ${usedFiles.length}`);
  console.log(`🔒 Preserved (in protected dirs): ${preservedFiles.length}`);
  console.log(`❌ Unused files: ${unusedFiles.length}`);
  console.log(`📁 Total files: ${allFiles.length}`);
  console.log('');

  if (unusedFiles.length > 0) {
    console.log('🗑️  Unused files that can be removed:');
    console.log('=====================================');
    unusedFiles.forEach(file => {
      const fullPath = path.join(publicDir, file);
      const stats = fs.statSync(fullPath);
      const size = (stats.size / 1024).toFixed(2);
      console.log(`  - ${file} (${size} KB)`);
    });
    
    // Calculate total size
    const totalSize = unusedFiles.reduce((acc, file) => {
      const fullPath = path.join(publicDir, file);
      return acc + fs.statSync(fullPath).size;
    }, 0);
    
    console.log('');
    console.log(`📏 Total space to be freed: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.log('✨ No unused files found! Your public directory is clean.');
  }

  return { unusedFiles, usedFiles, preservedFiles };
}

function removeUnusedFiles(unusedFiles) {
  const publicDir = path.join(process.cwd(), 'public');
  let removedCount = 0;
  let errorCount = 0;

  unusedFiles.forEach(file => {
    const fullPath = path.join(publicDir, file);
    try {
      fs.unlinkSync(fullPath);
      console.log(`✅ Removed: ${file}`);
      removedCount++;
    } catch (error) {
      console.error(`❌ Error removing ${file}: ${error.message}`);
      errorCount++;
    }
  });

  console.log('');
  console.log(`🎉 Cleanup complete! Removed ${removedCount} files.`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} files could not be removed.`);
  }
}

// Main execution
const args = process.argv.slice(2);
const shouldRemove = args.includes('--remove') || args.includes('-r');
const shouldHelp = args.includes('--help') || args.includes('-h');

if (shouldHelp) {
  console.log('Usage: node cleanup-public.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --remove, -r    Actually remove unused files (dry run by default)');
  console.log('  --help, -h      Show this help message');
  process.exit(0);
}

console.log('🔍 Analyzing public directory...');
console.log('');

const result = analyzePublicDirectory();

if (result && result.unusedFiles.length > 0) {
  if (shouldRemove) {
    console.log('');
    console.log('⚠️  REMOVING FILES...');
    console.log('');
    removeUnusedFiles(result.unusedFiles);
  } else {
    console.log('');
    console.log('💡 To remove these files, run:');
    console.log('   node scripts/cleanup-public.js --remove');
    console.log('');
    console.log('📝 Or review the list above and remove manually.');
  }
}