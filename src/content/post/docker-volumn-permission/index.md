---
title: "Permission issues with Docker volumes"
publishDate: "2025-01-24"
description: "Docker 卷的权限问题"
tags: ["linux", "devops", "docker"]
---

我在 [IntraPaste](https://github.com/FaiChou/IntraPaste) 这项目上花了很长时间来解决 Docker 卷的权限问题，docker 的相关配置如下:

- [docker-compose.yml](https://github.com/FaiChou/IntraPaste/blob/main/docker-compose.yml)
- [entrypoint.sh](https://github.com/FaiChou/IntraPaste/blob/main/entrypoint.sh)
- [Dockerfile](https://github.com/FaiChou/IntraPaste/blob/main/Dockerfile)

这项目使用了 prisma + sqlite 做数据库，由于数据库需要持久化存储，所以需要使用 docker volume 来挂载数据库文件。

但是很奇怪，我本地测试没问题，跑到我的几台 Linux 上都报错。

编译 docker 时候并不会报错，出错都是在运行阶段，也就是 entrypoint.sh 执行的时候。

我调研了一翻，发现我的两台 Linux 上都是直接使用 root 用户来运行 docker 的，而我的本地是使用普通用户来运行 docker 的。

root 用户直接运行这项目，首先 git pull 下来代码时候，所有项目文件的权限都是 root:root 的，包括 prisma 文件夹。

以至于在 entrypoint.sh 中执行 `npx prisma migrate deploy` 时候没有权限。

于是我就受启发先在 start 脚本的时候获取当前的 uid 和 gid:

```bash
export CURRENT_UID=$(id -u)
export CURRENT_GID=$(id -g)
```

然后在 docker-compose.yml 中使用这两个变量来设置服务运行的用户和组:

```yaml
services:
  app:
    user: "${CURRENT_UID:-0}:${CURRENT_GID:-0}"
```

这样在 Linux 上的两台设备就可以正常 docker 运行起来。

但是我的本地又双叒叕出问题了。还是执行 `npx prisma migrate deploy` 时候报错，提示 `/.npm` 文件夹权限问题。

经过一段时间 debug，发现 docker 在 build 阶段是使用 root 用户来执行，但在运行阶段切换成本地执行的 uid 和 gid 后，降权无法访问了。

来来回回感觉有点麻烦，想着能不能不使用 npx 而是直接下载到全局 prisma 二进制来执行这个 migrate。

一切想的太简单了，又报错，提示缺少一些 node_modules/@prisma 文件。

折腾来折腾去，一切原因都是从 [官方这个模板改的原因](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile)。它们就没有考虑过卷的权限问题。

于是再里一遍思路，docker build 时候默认是用 root 权限的，里面创建的文件都是 root 权限，在运行的时候如果再切换别的用户，那就是降权的操作。所以根本不需要增加用户或者 chmod chown 之类的操作。直接用 root 来执行即可。虽然偏离了最小权限的原则，但问题解决了。
