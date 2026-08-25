const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DEFAULT_SRC = 'C:\\Users\\bicho\\.agents\\skills';
const DEFAULT_DST = 'C:\\Users\\bicho\\.trae-cn\\skills';

function parseArgs(args) {
  const opts = {
    src: DEFAULT_SRC,
    dst: DEFAULT_DST,
    only: [],
    exclude: [],
    force: false,
    dryRun: false,
    sync: false,
    list: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--src':   opts.src = next; i++; break;
      case '--dst':   opts.dst = next; i++; break;
      case '--only':  opts.only = next.split(',').map(s => s.trim()); i++; break;
      case '--exclude': opts.exclude = next.split(',').map(s => s.trim()); i++; break;
      case '--force': opts.force = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--sync':  opts.sync = true; break;
      case '--list':  opts.list = true; break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  opts.src = path.resolve(opts.src);
  opts.dst = path.resolve(opts.dst);
  return opts;
}

function printHelp() {
  console.log(`
Skill Junction Creator for Windows

Usage:
  node create-junctions.js [options]

Options:
  --src <path>       Source directory (default: ${DEFAULT_SRC})
  --dst <path>       Destination directory (default: ${DEFAULT_DST})
  --only <names>     Only process specific skills (comma-separated)
  --exclude <names>  Skip specific skills (comma-separated)
  --force            Force overwrite existing junctions/directories
  --dry-run          Preview mode, don't actually create junctions
  --sync             Sync mode: create missing + remove orphan junctions
  --list             List all skills in source directory only
  --help, -h         Show this help

Examples:
  node create-junctions.js
  node create-junctions.js --dry-run
  node create-junctions.js --only ad-creative,code-review
  node create-junctions.js --exclude hallmark --force
  node create-junctions.js --sync
`);
}

function listSkills(srcDir) {
  if (!fs.existsSync(srcDir)) {
    console.error(`Source directory not found: ${srcDir}`);
    process.exit(1);
  }
  return fs.readdirSync(srcDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function isJunction(dirPath) {
  try {
    const result = execSync(
      `fsutil reparsepoint query "${dirPath}"`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    return result.includes('Mount Point');
  } catch {
    return false;
  }
}

function getJunctionTarget(dirPath) {
  try {
    const result = execSync(
      `fsutil reparsepoint query "${dirPath}"`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    const match = result.match(/Substitute Name:\s+(\\\?\?\\.+\S+)/);
    if (match) {
      return match[1].replace(/^\\\?\?\\/, '');
    }
    return null;
  } catch {
    return null;
  }
}

function createJunction(srcPath, dstPath, dryRun) {
  if (dryRun) {
    console.log(`  [DRY-RUN] Would create junction: ${dstPath} -> ${srcPath}`);
    return true;
  }
  try {
    execSync(
      `mklink /J "${dstPath}" "${srcPath}"`,
      { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' }
    );
    console.log(`  [OK] Created junction: ${path.basename(dstPath)}`);
    return true;
  } catch (err) {
    console.error(`  [FAIL] ${err.message.trim()}`);
    return false;
  }
}

function removePath(targetPath, dryRun) {
  if (dryRun) {
    console.log(`  [DRY-RUN] Would remove: ${targetPath}`);
    return true;
  }
  try {
    if (isJunction(targetPath)) {
      execSync(`rmdir "${targetPath}"`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
    } else {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
    console.log(`  [OK] Removed: ${path.basename(targetPath)}`);
    return true;
  } catch (err) {
    console.error(`  [FAIL] Remove failed: ${err.message.trim()}`);
    return false;
  }
}

function shouldProcess(name, opts) {
  if (opts.only.length > 0 && !opts.only.includes(name)) return false;
  if (opts.exclude.length > 0 && opts.exclude.includes(name)) return false;
  return true;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(opts.src)) {
    console.error(`Error: Source directory not found: ${opts.src}`);
    process.exit(1);
  }

  if (!fs.existsSync(opts.dst)) {
    console.log(`Creating destination directory: ${opts.dst}`);
    fs.mkdirSync(opts.dst, { recursive: true });
  }

  const allSkills = listSkills(opts.src);

  if (opts.list) {
    console.log(`\nSkills in ${opts.src} (${allSkills.length} total):\n`);
    allSkills.forEach((name, i) => {
      console.log(`  ${String(i + 1).padStart(3, ' ')}. ${name}`);
    });
    console.log('');
    return;
  }

  const skills = allSkills.filter(n => shouldProcess(n, opts));

  console.log(`\n=== Skill Junction Creator ===`);
  console.log(`Source:      ${opts.src}`);
  console.log(`Destination: ${opts.dst}`);
  console.log(`Mode:        ${opts.dryRun ? 'DRY-RUN' : opts.sync ? 'SYNC' : 'CREATE'}`);
  console.log(`Force:       ${opts.force ? 'YES' : 'NO'}`);
  console.log(`Skills:      ${skills.length} to process`);
  console.log('==============================\n');

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const name of skills) {
    const srcPath = path.join(opts.src, name);
    const dstPath = path.join(opts.dst, name);

    console.log(`Processing: ${name}`);

    if (!fs.existsSync(dstPath)) {
      if (createJunction(srcPath, dstPath, opts.dryRun)) {
        created++;
      } else {
        failed++;
      }
    } else {
      const target = getJunctionTarget(dstPath);

      if (target === null) {
        console.log(`  [SKIP] Path exists but is not a junction (regular directory)`);
        if (opts.force) {
          console.log(`  [FORCE] Removing directory and creating junction...`);
          removePath(dstPath, opts.dryRun);
          if (createJunction(srcPath, dstPath, opts.dryRun)) {
            created++;
          } else {
            failed++;
          }
        } else {
          skipped++;
        }
      } else if (target === srcPath) {
        console.log(`  [SKIP] Junction already exists and points correctly`);
        skipped++;
      } else {
        console.log(`  [SKIP] Junction exists but points elsewhere: ${target}`);
        if (opts.force) {
          console.log(`  [FORCE] Removing and recreating...`);
          removePath(dstPath, opts.dryRun);
          if (createJunction(srcPath, dstPath, opts.dryRun)) {
            created++;
          } else {
            failed++;
          }
        } else {
          skipped++;
        }
      }
    }
  }

  if (opts.sync) {
    console.log(`\n--- Sync: checking for orphan junctions in destination ---`);
    const dstEntries = fs.readdirSync(opts.dst, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const name of dstEntries) {
      const dstPath = path.join(opts.dst, name);
      const srcPath = path.join(opts.src, name);

      if (isJunction(dstPath) && !fs.existsSync(srcPath)) {
        console.log(`Processing orphan: ${name}`);
        console.log(`  [ORPHAN] Source no longer exists at: ${srcPath}`);
        if (removePath(dstPath, opts.dryRun)) {
          skipped++;
        } else {
          failed++;
        }
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Created:  ${created}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Failed:   ${failed}`);
  if (opts.dryRun) console.log(`(DRY-RUN: no actual changes made)`);
  console.log('');
}

main();