新版启动:
npm run build      # 从 src/posts 重新生成所有页面(本次:6 篇)
npm run dev

待办清单:
社交分享,文章底部加"分享到 X / 复制链接 / 微信二维码"，配合已有的 og: 标签。
图片懒加载 + 点击放大（lightbox）——技术文章配图体验。
阅读量 / 点赞统计——静态站可用 Waline、不蒜子(busuu)、或 GoatCounter（隐私友好）。
编辑器增强——加 front-matter 自动生成、本地多草稿管理、图片粘贴上传到图床、导出时自动带 Hugo front-matter。
i18n 中英双语（你简历里有英文项目经历，海外受众可读）。
RSS 全文输出 + 邮件订阅（buttondown/follow.it）。
全站 Fuse.js 搜索



简历修改:
把参与改成主导
增加量化结果
工作经历与项目经历高度重复













npx http-server . -p 3000
or
npx serve . -l 3000
hugo new post/new-post.md
hugo --theme=i18n2 --baseUrl="https://wenliang844.github.io/" -D
在hugo有配置文件的根目录中:
	hugo server
	hugo
cd public
git add .
git commit -m "message"
git push
1. git rm -r --cached .
2. git config core.autocrlf false
3. git add .
4. git commit -m ''
5.  
6. git push
git remote add origin https://github.com/wenliang844/wenliang844.github.io.git
git push -u origin master
git remote -v   查看远程库文件
解决办法如下：
1、先输入$ git remote rm origin(删除关联的origin的远程库)
2、再输入$ git remote add origin git@github.com:(github名)/(git项目名).git 就不会报错了！
3、如果输入$ git remote rm origin 还是报错的话，error: Could not remove config section 'remote.origin'. 我们需要修改gitconfig文件的内容
4、找到你的github的安装路径，我的是C:\Users\ASUS\AppData\Local\GitHub\PortableGit_ca477551eeb4aea0e4ae9fcd3358bd96720bb5c8\etc
5、找到一个名为gitconfig的文件，打开它把里面的[remote "origin"]那一行删掉就好了！


