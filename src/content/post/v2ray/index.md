---
title: "v2ray"
publishDate: "2019-09-19"
description: "v2ray"
tags: ["clash", "mac"]
---

ss再次被攻陷, 这次新建的也会立马被ban, 所以换一种方式, 使用 v2ray.

官网上教程基本够用了: https://www.v2ray.com/chapter_00/install.html

分为客户端和服务端.

## Client

https://github.com/v2ray/homebrew-v2ray

#### 安装

```bash
$ brew tap v2ray/v2ray
$ brew install v2ray-core
```

#### 配置

```bash
$ vim /usr/local/etc/v2ray/config.json
```

```
{
  "log": {
    "loglevel": "warning",
    "access": "~/.v2ray/v2ray-access.log",
    "error": "~/.v2ray/v2ray-error.log"
  },
  "inbounds": [
    {
      "port": 1080,
      "protocol": "socks",
      "sniffing": {
        "enabled": true,
        "destOverride": ["http", "tls"]
      },
      "settings": {
        "auth": "noauth"
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "vmess",
      "settings": {
        "vnext": [
          {
            "address": "xxx", // addr
            "port": 10086,
            "users": [
              {
                "id": "xxxx", // uid
                "alterId": 64
              }
            ]
          }
        ]
      }
    }
  ]
}
```

#### 运行

```bash
$ brew services run v2ray-core
$ brew services start v2ray-core // run v2ray-core and register it to launch at login
```

#### 调试

```bash
$ v2ray -config=/usr/local/etc/v2ray/config.json -test
```


## Server

#### 配置时间

需要配置和客户端一样的时间, 时间不能差一分钟, 时区可以不同

```bash
$ date -R
Thu, 19 Sep 2019 04:53:08 +0000
$ date --set="Thu, 19 Sep 2019 12:53:08"
```

#### root权限

```bash
$ sudo passwd # set password
$ su
```

#### 安装

```bash
$ bash <(curl -L -s https://install.direct/go.sh)
```

#### 编辑配置


```bash
$ vim /etc/v2ray/config.json
```

```
{
  "log": {
    "loglevel": "warning",
    "access": "/var/log/v2ray/access.log",
    "error": "/var/log/v2ray/error.log"
  },
  "inbounds": [
    {
      "port": 10086,
      "protocol": "vmess",   
      "settings": {
        "clients": [
          {
            "id": "xxx",  
            "alterId": 64
          }
        ]
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom",  
      "settings": {}
    }
  ]
}
```

#### 调试

```bash
$ service v2ray start|stop|status|reload|restart|force-reload 
```
