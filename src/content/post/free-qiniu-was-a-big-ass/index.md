---
title: "七牛免费之坑"
description: "七牛免费之坑"
publishDate: "2018-10-09"
tags: ["life"]
---

昨天刚更新完博客, 今天就遇到了「免费测试域名」被回收♻️.

虽然前几天看到过 [/t/494056](https://www.v2ex.com/t/494056) 他们讨论[七牛测试域名使用规范](https://developer.qiniu.com/fusion/kb/1319/test-domain-access-restriction-rules), 但是当时没影响到自己就没有深究, 加之前几天收到测试域名被回收的邮件警告, 发现自己域名没有被回收, 没以为是和我相关的事, 怀着侥幸心理以为自己的域名没有被回收, 结果今天真不能用了才去看邮件, 之前是**还剩7个自然日会被系统自动回收**, 今天是**已被系统自动回收**, WTF?

### 被回收的域名肯定是找不回来了

随机的测试域名被非法使用，出现监管问题，所以七牛要回收之前一直公开的测试域名.

大多数用户应该不会以为这是个测试的域名, 应该还会有商业的使用(猜测), 所以七牛这波操作真的挺让用户心灰的, 因为有很多用户不了解这个原因.


### 解决方案

##### 绑定自己的域名

七牛比较dt的地方是必须绑定备案过的域名. 购买域名简单, 备案可复杂了.

##### 迁移出七牛

图床选七牛其实挺不明智的, 那么域名丢失了, 资源却没丢, 那只能绑定自己的域名来找回资源吗?
答案是: **不需要**. 可以新建一个 `bucket`, 通过 `qshell` 将资源转移到新 `bucket`.(这个方法是七牛客服告诉我的)


### 使用 [qshell](https://github.com/qiniu/qshell) 转移bucket文件到另一bucket

1. 下载 [qshell](http://devtools.qiniu.com/qshell-v2.2.0.zip)
2. 解压, 将 `qshell-darwin-x64` 放到 `/usr/local/bin` 或 `~/bin` 下
3. 更名 `qshell-darwin-x64` 为 `qshell`
4. 添加账号: `qshell account ak sk`
5. 导出 A bucket 文件信息: `qshell listbucket A A.list.txt`
6. 格式化文件信息: `awk '{print $1}' A.list.txt > list.txt`
7. 转移到 B bucket: `qshell batchcopy A B list.txt`

A.list.txt

<img src="https://ws4.sinaimg.cn/large/006tNbRwly1fw2avx0dapj313812k7wh.jpg" width="500"/>

list.txt

<img src="https://ws4.sinaimg.cn/large/006tNbRwly1fw2awuwmvuj30ku0jgdm7.jpg" width="500"/>

### 博客文章图片域名替换

博客的七牛资源比较好找, 都是在 `_posts` 路径下的 `markdown` 文件里, 所以只需要一行代码:

```bash
$ gsed -i "s/o7bkcj7d7/p9qv3iwy5/g" *.md
```

可是也会有很多不是博客上使用的七牛链接, 那应该怎么处理呢? 

没办法, 只能手动迁移, 迁移重要的, 放弃不重要的.

- 简书文章
- `github` 上比较重要的项目的 `README.md`

除了上述代码方法迁移图床, 群主Jason开发过一个不错的工具: [iPic Mover：一键搬家 Markdown 图片至新图床](https://www.waerfa.com/ipic-mover-review), 推荐使用.


### 后续

应该不会购买域名+备案给七牛用, 所以还会继续调研到底选用百度/腾讯/阿里还是gitlab等.

深刻领会了: **免费的永远是最贵的**.

##### 下载七牛bucket所有资源:

```bash
$ qshell qdownload 10 qdisk_down.conf
```

qdisk_down.conf:

```bash
{
    "dest_dir"   :   "/Users/FaiChou/Downloads/backup",
    "bucket"     :   "***",
    "cdn_domain" :   "",
    "referer"    :   "http://faichou.com",
    "log_file"   :   "download.log",
    "log_level"  :   "info",
    "log_rotate" :   1,
    "log_stdout" :   false
}
```

download.log:

<img src="https://raw.githubusercontent.com/FaiChou/faichou.github.io/master/img/1541830539915.png" width="550" />



