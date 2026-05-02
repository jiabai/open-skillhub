import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import png2icons from 'png2icons';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_PNG = path.join(__dirname, '..', 'resources', 'icons', 'icon.png');
const OUTPUT_ICNS = path.join(__dirname, '..', 'resources', 'icons', 'icon.icns');

async function createIcns() {
  console.log('正在读取 icon.png...');
  const pngBuffer = fs.readFileSync(INPUT_PNG);
  
  console.log('正在生成 icon.icns...');
  const icnsBuffer = png2icons.createICNS(pngBuffer, png2icons.BICUBIC, true);
  
  console.log('正在保存 icon.icns...');
  fs.writeFileSync(OUTPUT_ICNS, icnsBuffer);
  
  console.log('✅ icon.icns 生成成功！');
  console.log(`文件位置: ${OUTPUT_ICNS}`);
}

createIcns().catch(err => {
  console.error('生成 icon.icns 时出错:', err);
  process.exit(1);
});
