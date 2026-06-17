#!/usr/bin/env node

/**
 * 生产就绪验证脚本
 * 在部署前运行此脚本以确保项目符合生产级标准
 */

import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const IS_WINDOWS = process.platform === 'win32';

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

async function fileExists(path) {
  try {
    await access(join(ROOT, path));
    return true;
  } catch {
    return false;
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
      shell: true
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
    const { stdout } = await execFileAsync('node', ['scripts/build.mjs'], {
      cwd: ROOT,
      windowsHide: true
    });

    if (stdout.includes('构建完成')) {
      pass('构建成功');

      // 检查输出文件
      const outputs = [
        'post/index.html',
        'sitemap.xml',
        'index.xml',
        'search-index.json'
      ];

      for (const output of outputs) {
        if (await fileExists(output)) {
          pass(`输出文件存在: ${output}`);
        } else {
          fail(`输出文件缺失: ${output}`);
        }
      }
    } else {
      fail('构建失败');
    }
  } catch (error) {
    fail(`构建失败: ${error.message}`);
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

  const htmlFiles = ['index.html'];
  if (await fileExists('post/index.html')) {
    htmlFiles.push('post/index.html');
  }

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

      // 检查 alt 属性
      const imgs = content.match(/<img[^>]*>/g) || [];
      const imgsWithoutAlt = imgs.filter(img => !img.includes('alt='));
      if (imgsWithoutAlt.length > 0) {
        warn(`${file}: ${imgsWithoutAlt.length} 个图片缺少 alt 属性`);
      } else if (imgs.length > 0) {
        pass(`${file}: 所有图片都有 alt 属性`);
      }
    }
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
