#!/usr/bin/env node

/**
 * 生产就绪验证脚本
 * 在部署前运行此脚本以确保项目符合生产级标准
 */

import { readFile, access, readdir, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pageAssetUrls } from '../src/page-assets.mjs';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const IS_WINDOWS = process.platform === 'win32';
const TEST_OUTPUT_MAX_BUFFER = 32 * 1024 * 1024;
const BUILD_CHECK_OUT = 'temp/production-validate';
const BUILD_CHECK_DIR = join(ROOT, BUILD_CHECK_OUT);

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

function pass(message) {
  checks.passed.push(message);
  console.log(`✓ ${message}`);
}

function fail(message) {
  checks.failed.push(message);
  console.error(`✗ ${message}`);
}

function warn(message) {
  checks.warnings.push(message);
  console.warn(`⚠ ${message}`);
}

async function fileExists(path, baseDir = ROOT) {
  try {
    await access(join(baseDir, path));
    return true;
  } catch {
    return false;
  }
}

async function listHtmlFiles(dir = ROOT) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'temp') {
      continue;
    }

    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listHtmlFiles(absolutePath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(relative(ROOT, absolutePath).replace(/\\/g, '/'));
    }
  }
  return files.sort();
}

function getHtmlAttr(tag, attr) {
  const pattern = new RegExp(`\\s${attr}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>` + "`" + `]+)))?`, 'i');
  const match = tag.match(pattern);
  if (!match) {
    return null;
  }
  return match[1] ?? match[2] ?? match[3] ?? '';
}

function hasHtmlAttr(tag, attr) {
  return getHtmlAttr(tag, attr) !== null;
}

function isSvgImage(src) {
  return /\.svg(?:[?#]|$)/i.test(src) || /^data:image\/svg\+xml/i.test(src);
}

function isHiddenImage(tag) {
  return hasHtmlAttr(tag, 'hidden') || /style=["'][^"']*display\s*:\s*none/i.test(tag);
}

function localAssetPath(ref) {
  if (/^(?:https?:)?\/\//i.test(ref) || ref.startsWith('data:')) {
    return '';
  }
  return ref.replace(/[?#].*$/, '').replace(/^\//, '');
}

function imagePolicyViolations(file, img) {
  const violations = [];
  const src = getHtmlAttr(img, 'src') || '';
  const hidden = isHiddenImage(img);
  const svg = isSvgImage(src);
  const loading = getHtmlAttr(img, 'loading');
  const decoding = getHtmlAttr(img, 'decoding');
  const fetchpriority = getHtmlAttr(img, 'fetchpriority');

  if (!hasHtmlAttr(img, 'alt')) {
    violations.push(`${file}: image missing alt: ${img}`);
  }
  if (!svg && !hidden && (!hasHtmlAttr(img, 'width') || !hasHtmlAttr(img, 'height'))) {
    violations.push(`${file}: image missing width/height: ${img}`);
  }
  if (!hidden && fetchpriority !== 'high' && loading !== 'lazy' && loading !== 'eager') {
    violations.push(`${file}: image missing explicit loading strategy: ${img}`);
  }
  if (!hidden && decoding !== 'async') {
    violations.push(`${file}: image missing decoding="async": ${img}`);
  }
  return violations;
}

async function checkLocalResourceReferences() {
  console.log('\n🧩 检查本地 CSS/JS 资源引用...');

  const htmlFiles = await listHtmlFiles();
  const missing = [];

  for (const file of htmlFiles) {
    const html = await readFile(join(ROOT, file), 'utf8');
    const refs = [
      ...html.matchAll(/href="([^"]+\.(?:css|js)(?:[?#][^"]*)?)"/g),
      ...html.matchAll(/src="([^"]+\.(?:css|js)(?:[?#][^"]*)?)"/g),
    ];

    for (const match of refs) {
      const assetPath = localAssetPath(match[1]);
      if (assetPath && !(await fileExists(assetPath))) {
        missing.push(`${file}: ${match[1]}`);
      }
    }
  }

  const manifestAssets = pageAssetUrls().filter((url) => /\.(?:css|js)(?:[?#]|$)/i.test(url));
  for (const url of manifestAssets) {
    const assetPath = localAssetPath(url);
    if (assetPath && !(await fileExists(assetPath))) {
      missing.push(`PAGE_ASSETS: ${url}`);
    }
  }

  if (missing.length > 0) {
    fail(`本地 CSS/JS 资源缺失:\n${missing.map(item => `  - ${item}`).join('\n')}`);
  } else {
    pass(`本地 CSS/JS 资源完整：${htmlFiles.length} 个页面和 ${manifestAssets.length} 个 manifest 资源已检查`);
  }
}

async function checkRequiredFiles() {
  console.log('\n📁 检查必需文件...');

  const required = [
    'package.json',
    'scripts/build.mjs',
    'src/config.mjs',
    'js/utils.js',
    'js/error-handler.js',
    'css/coder.css',
    'index.html',
    'robots.txt'
  ];

  for (const file of required) {
    if (await fileExists(file)) {
      pass(`必需文件存在: ${file}`);
    } else {
      fail(`缺少必需文件: ${file}`);
    }
  }
}

async function checkDocumentation() {
  console.log('\n📚 检查文档...');

  const docs = [
    'readme.md',
    'CHANGELOG.md',
    'docs/SECURITY.md',
    'docs/PERFORMANCE.md',
    'docs/DEPLOYMENT.md',
    'docs/ARCHITECTURE.md'
  ];

  for (const doc of docs) {
    if (await fileExists(doc)) {
      pass(`文档存在: ${doc}`);
    } else {
      warn(`建议添加文档: ${doc}`);
    }
  }
}

async function checkSecurityMeasures() {
  console.log('\n🔒 检查安全措施...');

  // 检查 XSS 防护
  const utilsContent = await readFile(join(ROOT, 'js/utils.js'), 'utf8');
  if (utilsContent.includes('escapeHtml')) {
    pass('XSS 防护：escapeHtml 函数已实现');
  } else {
    fail('XSS 防护：缺少 escapeHtml 函数');
  }

  // 检查错误处理
  if (await fileExists('js/error-handler.js')) {
    pass('全局错误处理已实现');
  } else {
    fail('缺少全局错误处理');
  }

  // 检查是否有硬编码的密钥
  const feedbackContent = await readFile(join(ROOT, 'js/feedback.js'), 'utf8');
  if (feedbackContent.includes('WEB3FORMS_ACCESS_KEY = ""')) {
    pass('Web3Forms 密钥未硬编码');
  } else {
    warn('检查 Web3Forms 密钥是否应该为空');
  }

  // 检查输入验证
  const buildContent = await readFile(join(ROOT, 'scripts/build.mjs'), 'utf8');
  if (buildContent.includes('validateSlug') && buildContent.includes('validatePost')) {
    pass('输入验证已实现');
  } else {
    fail('缺少输入验证函数');
  }
}

async function runTests() {
  console.log('\n🧪 运行测试套件...');

  try {
    const { stdout } = await execFileAsync('node', ['--test', 'tests/*.test.mjs'], {
      cwd: ROOT,
      windowsHide: true,
      shell: true,
      maxBuffer: TEST_OUTPUT_MAX_BUFFER
    });

    if (stdout.includes('fail 0')) {
      pass('所有测试通过');
    } else {
      fail('部分测试失败');
      console.log(stdout);
    }
  } catch (error) {
    // Node test runner exits with code 1 even on success in some cases
    if (error.stdout && error.stdout.includes('fail 0')) {
      pass('所有测试通过');
    } else {
      fail(`测试执行失败: ${error.message}`);
    }
  }
}

async function checkDependencies() {
  console.log('\n📦 检查依赖...');

  const runAudit = async (registry) => {
    const args = ['audit', '--json'];
    if (registry) {
      args.push(`--registry=${registry}`);
    }

    try {
      const { stdout } = await execFileAsync('npm', args, {
        cwd: ROOT,
        windowsHide: true,
        shell: IS_WINDOWS
      });
      return JSON.parse(stdout);
    } catch (error) {
      if (error.stdout) {
        const audit = JSON.parse(error.stdout);
        if (audit.metadata?.vulnerabilities) {
          return audit;
        }
      }
      throw error;
    }
  };

  const evaluateAudit = (audit) => {
    const vulnerabilities = audit.metadata?.vulnerabilities;

    if (!vulnerabilities) {
      warn('npm audit 未返回漏洞统计信息');
      return;
    }

    const total = vulnerabilities.total ??
      Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      pass('依赖无已知漏洞');
      return;
    }

    const critical = vulnerabilities.critical || 0;
    const high = vulnerabilities.high || 0;
    if (critical > 0 || high > 0) {
      fail(`发现 ${critical} 个严重漏洞和 ${high} 个高危漏洞`);
    } else {
      warn(`发现 ${total} 个低危/中危漏洞`);
    }
  };

  try {
    evaluateAudit(await runAudit());
  } catch (error) {
    const output = [error.stdout, error.stderr, error.message].filter(Boolean).join('\n');
    if (/security\/audits|NOT_IMPLEMENTED/i.test(output)) {
      console.log('默认 npm registry 不支持 audit，切换官方 registry 重试...');
      try {
        evaluateAudit(await runAudit('https://registry.npmjs.org/'));
      } catch {
        warn('npm audit 执行失败（官方 registry 重试也未成功）');
      }
      return;
    }

    warn(`npm audit 执行失败: ${error.message}`);
  }
}

async function checkBuild() {
  console.log('\n🔨 验证构建...');

  try {
    await rm(BUILD_CHECK_DIR, { recursive: true, force: true });

    const { stdout } = await execFileAsync('node', ['scripts/build.mjs', '--out', BUILD_CHECK_OUT], {
      cwd: ROOT,
      windowsHide: true
    });

    if (stdout.includes('构建完成')) {
      pass('构建成功（临时目录）');

      // 检查输出文件
      const outputs = [
        'post/index.html',
        'sitemap.xml',
        'index.xml',
        'search-index.json'
      ];

      for (const output of outputs) {
        if (await fileExists(output, BUILD_CHECK_DIR)) {
          pass(`输出文件存在: ${output}`);
        } else {
          fail(`输出文件缺失: ${output}`);
        }
      }

      await execFileAsync('node', ['scripts/http-smoke.mjs', '--root', BUILD_CHECK_DIR], {
        cwd: ROOT,
        windowsHide: true,
        maxBuffer: TEST_OUTPUT_MAX_BUFFER
      });
      pass('临时构建 HTTP smoke 通过');
    } else {
      fail('构建失败');
    }
  } catch (error) {
    fail(`构建失败: ${error.message}`);
  } finally {
    await rm(BUILD_CHECK_DIR, { recursive: true, force: true });
  }
}

async function checkPerformanceFeatures() {
  console.log('\n⚡ 检查性能优化特性...');

  // 检查防抖/节流
  const utilsContent = await readFile(join(ROOT, 'js/utils.js'), 'utf8');
  if (utilsContent.includes('throttle') && utilsContent.includes('debounce')) {
    pass('防抖和节流函数已实现');
  } else {
    warn('建议实现防抖和节流函数');
  }

  // 检查懒加载
  if (await fileExists('js/search-loader.js')) {
    pass('搜索功能懒加载已实现');
  } else {
    warn('建议实现搜索功能懒加载');
  }

  // 检查事件优化
  const coderContent = await readFile(join(ROOT, 'js/coder.js'), 'utf8');
  if (coderContent.includes('passive: true')) {
    pass('滚动事件使用 passive 监听');
  } else {
    warn('建议为滚动事件添加 passive 标志');
  }
}

async function checkCodeQuality() {
  console.log('\n📝 检查代码质量...');

  // 检查是否有 ESLint 配置
  if (await fileExists('.eslintrc.json')) {
    pass('ESLint 配置存在');
  } else {
    warn('建议添加 ESLint 配置');
  }

  // 检查 console.log（生产环境应避免）
  const jsFiles = ['js/coder.js', 'js/blog.js', 'js/search.js'];
  let hasDebugLogs = false;

  for (const file of jsFiles) {
    if (await fileExists(file)) {
      const content = await readFile(join(ROOT, file), 'utf8');
      const debugLogs = content.match(/console\.(log|debug|info)/g);
      if (debugLogs && debugLogs.length > 0) {
        hasDebugLogs = true;
      }
    }
  }

  if (hasDebugLogs) {
    warn('部分 JS 文件包含调试日志，生产环境建议移除');
  } else {
    pass('无调试日志');
  }
}

async function checkAccessibility() {
  console.log('\n♿ 检查可访问性特性...');

  const htmlFiles = await listHtmlFiles();
  const imageViolations = [];

  for (const file of htmlFiles) {
    if (await fileExists(file)) {
      const content = await readFile(join(ROOT, file), 'utf8');

      // 检查 lang 属性
      if (content.includes('lang="')) {
        pass(`${file}: 设置了 lang 属性`);
      } else {
        warn(`${file}: 缺少 lang 属性`);
      }

      // 检查 ARIA 标签
      if (content.includes('aria-')) {
        pass(`${file}: 使用了 ARIA 属性`);
      } else {
        warn(`${file}: 建议添加 ARIA 属性`);
      }

      // 检查图片可访问性、布局稳定性和加载策略
      const imgs = content.match(/<img[^>]*>/g) || [];
      imgs.forEach(img => imageViolations.push(...imagePolicyViolations(file, img)));
    }
  }

  if (imageViolations.length > 0) {
    fail(`图片属性检查失败:\n${imageViolations.map(item => `  - ${item}`).join('\n')}`);
  } else {
    pass(`HTML 图片属性完整：${htmlFiles.length} 个页面已检查`);
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 验证总结');
  console.log('='.repeat(60));
  console.log(`✓ 通过: ${checks.passed.length}`);
  console.log(`✗ 失败: ${checks.failed.length}`);
  console.log(`⚠ 警告: ${checks.warnings.length}`);
  console.log('='.repeat(60));

  if (checks.failed.length > 0) {
    console.log('\n❌ 失败项:');
    checks.failed.forEach(item => console.log(`  - ${item}`));
  }

  if (checks.warnings.length > 0) {
    console.log('\n⚠️  警告项:');
    checks.warnings.forEach(item => console.log(`  - ${item}`));
  }

  console.log('\n');

  if (checks.failed.length === 0) {
    console.log('🎉 恭喜！项目已达到生产级质量标准。');
    console.log('   可以安全部署到生产环境。');
    return 0;
  } else {
    console.log('⚠️  项目存在需要修复的问题。');
    console.log('   请解决失败项后再部署到生产环境。');
    return 1;
  }
}

async function main() {
  console.log('🚀 开始生产就绪验证...\n');

  await checkRequiredFiles();
  await checkDocumentation();
  await checkSecurityMeasures();
  await runTests();
  await checkDependencies();
  await checkBuild();
  await checkLocalResourceReferences();
  await checkPerformanceFeatures();
  await checkCodeQuality();
  await checkAccessibility();

  const exitCode = printSummary();
  process.exit(exitCode);
}

main().catch(error => {
  console.error('验证脚本执行失败:', error);
  process.exit(1);
});
