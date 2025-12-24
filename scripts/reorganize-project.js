#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration for the reorganization
const MIGRATIONS = {
  // Remove duplicate root files
  removeRootDuplicates: [
    { from: './globals.css', action: 'delete', reason: 'Duplicate of src/app/globals.css' },
    { from: './layout.js', action: 'delete', reason: 'Duplicate of src/app/layout.js' }
  ],

  // Consolidate utilities into lib
  mergeUtilities: [
    { from: 'src/utils', to: 'src/lib/utils', action: 'move' },
    { from: 'src/utilities', to: 'src/lib/utilities', action: 'move' }
  ],

  // Reorganize components into logical groups
  componentReorganization: {
    '3d': [
      'AngelOfCurrencies.jsx',
      'Aurora.jsx',
      'BreathSmoke.jsx',
      'ConstellationModel.jsx',
      'CyborgTempleScene.jsx',
      'EnhancedVolumetricLight.jsx',
      'FountainEffect.jsx',
      'GodRays.jsx',
      'MainCharacter.jsx',
      'PointCloudScene.jsx',
      'ResponsivePointCloud.jsx',
      'SimpleAvatar.jsx',
      'TempleEnvironment.jsx',
      'ThreeBackground.jsx',
      'VideoScreens.jsx',
      'VirtualCamera.jsx',
      'VolumetricBeam.jsx'
    ],
    'ui': [
      'CyberNav.jsx',
      'CyberNav.js',
      'CyberFloatingBar.jsx',
      'Footer.jsx',
      'NavigationPanel.jsx',
      'TabNavigation.jsx',
      'ToggleMusic.jsx',
      'TouchInterface.jsx',
      'CoinLoader.js',
      'FocusedAgentCard.jsx'
    ],
    'features': [
      'AnnotationMarker.jsx',
      'AnnotationSystem.jsx',
      'AnnunciationIntro.jsx',
      'BuyTokenFAB.jsx',
      'CompactCandleModal.jsx',
      'CyberFAQSection.jsx',
      'CyberStatsSection.jsx',
      'CyberTokenomicsSection.jsx'
    ],
    'canvas': [
      'CleanCanvas.jsx',
      'ReusableCanvas.jsx'
    ]
  },

  // Consolidate trading features
  tradingConsolidation: {
    from: [
      'src/trading',
      'src/hooks/useLighterAPI.js',
      'src/hooks/useLighterTrading.js'
    ],
    to: 'src/features/trading'
  },

  // Reorganize public directory
  publicReorganization: {
    'assets/images': [
      '*.png',
      '*.jpg',
      '*.jpeg',
      '*.webp',
      '*.svg',
      '!favicon.*',
      '!icon.*',
      '!apple-icon.*'
    ],
    'assets/fonts': ['fonts/*'],
    'assets/icons': [
      'favicon.*',
      'icon.*',
      'apple-icon.*'
    ]
  }
};

class ProjectReorganizer {
  constructor(dryRun = true) {
    this.dryRun = dryRun;
    this.operations = [];
    this.errors = [];
  }

  log(message, type = 'info') {
    const prefix = {
      'info': '📋',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'move': '📦',
      'delete': '🗑️',
      'create': '📁'
    }[type] || '📋';
    
    console.log(`${prefix} ${message}`);
  }

  ensureDirectory(dirPath) {
    if (!this.dryRun && !fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      this.log(`Created directory: ${dirPath}`, 'create');
    } else if (this.dryRun) {
      this.operations.push({ type: 'create_dir', path: dirPath });
    }
  }

  moveFile(from, to) {
    if (!fs.existsSync(from)) {
      this.log(`File not found: ${from}`, 'warning');
      return false;
    }

    const toDir = path.dirname(to);
    this.ensureDirectory(toDir);

    if (!this.dryRun) {
      try {
        fs.renameSync(from, to);
        this.log(`Moved: ${from} → ${to}`, 'move');
        this.updateImports(from, to);
      } catch (error) {
        this.errors.push({ from, to, error: error.message });
        this.log(`Failed to move ${from}: ${error.message}`, 'error');
      }
    } else {
      this.operations.push({ type: 'move', from, to });
    }
    return true;
  }

  deleteFile(filePath) {
    if (!fs.existsSync(filePath)) {
      this.log(`File not found: ${filePath}`, 'warning');
      return false;
    }

    if (!this.dryRun) {
      try {
        fs.unlinkSync(filePath);
        this.log(`Deleted: ${filePath}`, 'delete');
      } catch (error) {
        this.errors.push({ file: filePath, error: error.message });
        this.log(`Failed to delete ${filePath}: ${error.message}`, 'error');
      }
    } else {
      this.operations.push({ type: 'delete', path: filePath });
    }
    return true;
  }

  updateImports(oldPath, newPath) {
    // Calculate relative path changes for import updates
    const oldRelative = path.relative('src', oldPath);
    const newRelative = path.relative('src', newPath);
    
    if (!this.dryRun) {
      try {
        // Update imports in all JS/JSX/TS/TSX files
        const findCmd = `find src -type f \\( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \\) -exec grep -l "${oldRelative}" {} \\;`;
        const files = execSync(findCmd, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
        
        files.forEach(file => {
          const content = fs.readFileSync(file, 'utf8');
          const updated = content.replace(
            new RegExp(oldRelative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            newRelative
          );
          if (content !== updated) {
            fs.writeFileSync(file, updated);
            this.log(`Updated imports in: ${file}`, 'success');
          }
        });
      } catch (error) {
        // Silent fail - import updates are best effort
      }
    }
  }

  reorganizeComponents() {
    this.log('Reorganizing components...', 'info');
    
    Object.entries(MIGRATIONS.componentReorganization).forEach(([subdir, files]) => {
      const targetDir = `src/components/${subdir}`;
      this.ensureDirectory(targetDir);
      
      files.forEach(file => {
        const from = `src/components/${file}`;
        const to = `${targetDir}/${file}`;
        this.moveFile(from, to);
      });
    });
  }

  mergeUtilities() {
    this.log('Merging utility directories...', 'info');
    
    // Create lib directory
    this.ensureDirectory('src/lib');
    
    // Move utils
    if (fs.existsSync('src/utils')) {
      const utilFiles = fs.readdirSync('src/utils');
      utilFiles.forEach(file => {
        this.moveFile(`src/utils/${file}`, `src/lib/utils/${file}`);
      });
    }
    
    // Move utilities
    if (fs.existsSync('src/utilities')) {
      const utilityFiles = fs.readdirSync('src/utilities');
      utilityFiles.forEach(file => {
        this.moveFile(`src/utilities/${file}`, `src/lib/${file}`);
      });
    }
  }

  consolidateTrading() {
    this.log('Consolidating trading features...', 'info');
    
    const targetDir = 'src/features/trading';
    this.ensureDirectory('src/features');
    
    // Move entire trading directory
    if (fs.existsSync('src/trading')) {
      this.moveFile('src/trading', targetDir);
    }
    
    // Move trading-related hooks
    const tradingHooks = [
      'src/hooks/useLighterAPI.js',
      'src/hooks/useLighterTrading.js'
    ];
    
    tradingHooks.forEach(hook => {
      if (fs.existsSync(hook)) {
        const fileName = path.basename(hook);
        this.moveFile(hook, `${targetDir}/hooks/${fileName}`);
      }
    });
  }

  reorganizePublic() {
    this.log('Reorganizing public directory...', 'info');
    
    // Create asset directories
    this.ensureDirectory('public/assets');
    this.ensureDirectory('public/assets/images');
    this.ensureDirectory('public/assets/fonts');
    this.ensureDirectory('public/assets/icons');
    
    // Move image files
    const publicFiles = fs.readdirSync('public');
    publicFiles.forEach(file => {
      const filePath = `public/${file}`;
      if (fs.statSync(filePath).isFile()) {
        const ext = path.extname(file).toLowerCase();
        
        // Icons
        if (file.includes('favicon') || file.includes('icon') || file.includes('apple-icon')) {
          this.moveFile(filePath, `public/assets/icons/${file}`);
        }
        // Images
        else if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext)) {
          this.moveFile(filePath, `public/assets/images/${file}`);
        }
      }
    });
    
    // Move fonts directory
    if (fs.existsSync('public/fonts')) {
      const fontFiles = fs.readdirSync('public/fonts');
      fontFiles.forEach(file => {
        this.moveFile(`public/fonts/${file}`, `public/assets/fonts/${file}`);
      });
      // Remove empty fonts directory
      if (!this.dryRun && fs.readdirSync('public/fonts').length === 0) {
        fs.rmdirSync('public/fonts');
      }
    }
  }

  removeRootDuplicates() {
    this.log('Removing root duplicate files...', 'info');
    
    MIGRATIONS.removeRootDuplicates.forEach(({ from, reason }) => {
      if (fs.existsSync(from)) {
        this.log(`${reason}`, 'info');
        this.deleteFile(from);
      }
    });
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 REORGANIZATION REPORT');
    console.log('='.repeat(60));
    
    if (this.dryRun) {
      console.log('\n🔍 DRY RUN MODE - No changes made\n');
      console.log('Planned operations:');
      
      const grouped = this.operations.reduce((acc, op) => {
        acc[op.type] = (acc[op.type] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(grouped).forEach(([type, count]) => {
        const label = {
          'move': '📦 Files to move',
          'delete': '🗑️  Files to delete',
          'create_dir': '📁 Directories to create'
        }[type] || type;
        console.log(`  ${label}: ${count}`);
      });
      
      console.log('\n💡 To apply these changes, run:');
      console.log('   node scripts/reorganize-project.js --execute\n');
    } else {
      console.log('\n✅ Reorganization complete!\n');
      
      if (this.errors.length > 0) {
        console.log(`⚠️  ${this.errors.length} errors occurred:`);
        this.errors.forEach(err => {
          console.log(`   - ${err.file || err.from}: ${err.error}`);
        });
      }
      
      console.log('\n📝 Next steps:');
      console.log('  1. Run: npm run dev');
      console.log('  2. Test your application');
      console.log('  3. Update any hardcoded paths in HTML files');
      console.log('  4. Commit the changes\n');
    }
  }

  run() {
    console.log('🚀 Starting project reorganization...\n');
    
    // Execute reorganization steps
    this.removeRootDuplicates();
    this.mergeUtilities();
    this.reorganizeComponents();
    this.consolidateTrading();
    this.reorganizePublic();
    
    // Generate report
    this.generateReport();
  }
}

// Main execution
const args = process.argv.slice(2);
const shouldExecute = args.includes('--execute') || args.includes('-e');
const shouldHelp = args.includes('--help') || args.includes('-h');

if (shouldHelp) {
  console.log('Usage: node reorganize-project.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --execute, -e   Execute the reorganization (dry run by default)');
  console.log('  --help, -h      Show this help message');
  console.log('');
  console.log('This script will:');
  console.log('  - Remove duplicate root files');
  console.log('  - Merge utils/ and utilities/ into lib/');
  console.log('  - Organize components into logical subdirectories');
  console.log('  - Consolidate trading features');
  console.log('  - Reorganize public directory structure');
  process.exit(0);
}

const reorganizer = new ProjectReorganizer(!shouldExecute);
reorganizer.run();