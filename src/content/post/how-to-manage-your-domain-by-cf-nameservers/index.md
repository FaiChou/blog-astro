---
title: "How to manage your domain by changing Cloudflare Nameservers"
publishDate: "2025-08-14"
description: "揭秘 Cloudflare 域名 Nameservers 的修改限制，分析 NS 碰撞接管攻击的原理以及 Cloudflare 的防护机制"
tags: ["cloudflare", "devops"]
---

前段时间在 cloudflare 上购买了一个域名，使用一个 saas 平台建站，但是这个 saas 平台仅支持修改 DNS Nameservers 的形式解析，不支持直接修改 A 记录和 CNAME 的方式解析。

但是找遍了 cloudflare 的后台也没有地方能修改 nameservers 的地方。并且自己的账户套餐是 free plan，没有客服功能，也没有发工单的权限。

在网上找了一个方案，说可以[通过 API 来修改](https://developers.cloudflare.com/api/resources/registrar/subresources/domains/methods/update/)，我试了一下:

```
curl https://api.cloudflare.com/client/v4/accounts/XXX/registrar/domains/XXXX.com \
    -X PUT \
    -H 'Content-Type: application/json' \
    -H "X-Auth-Email: XXX@gmail.com" \
    -H "X-Auth-Key: XXX" \
    -d '{
          "auto_renew": true,
          "name_servers": [
            "betty.ns.cloudflare.com",
            "micah.ns.cloudflare.com"
          ],
          "privacy": true
        }'
{"result":null,"success":false,"errors":[{"code":10000,"message":"Name server update not allowed"}],"messages":["Name server update not allowed"]}
```

这个方式的漏洞也被堵上了。看来没有办法修改 nameservers(后面缩写为 NS) 了。

虽然说在域名购买的 [Domain Registration Agreement](https://www.cloudflare.com/domain-registration-agreement/) 上已经有明确说明:

> 6.1 Nameservers. Registrant agrees to use Cloudflare’s nameservers. REGISTRANT ACKNOWLEDGES AND AGREES THAT IT MAY NOT CHANGE THE NAMESERVERS ON THE REGISTRAR SERVICES, AND THAT IT MUST TRANSFER TO A THIRD-PARTY REGISTRAR IF IT WISHES TO CHANGE NAMESERVERS.

但这个条款估计很少有人会仔细去看，因为谁能想到域名没有办法修改 NS 呢。

于是又想了一下，saas 平台是如何通过 NS 来管理你的域名的？在 saas 平台管理你域名需要你在它后台填写你的域名，然后它会给你两个 NS 地址，然后你去域名注册商那边修改成这两个 NS 地址，saas 就可以帮你解析了。

但这其中你自己考虑一下，会不会有碰撞接管问题呢？

[What's the story behind the names of CloudFlare's name servers?](https://blog.cloudflare.com/whats-the-story-behind-the-names-of-cloudflares-name-servers/), 这篇文章介绍了 cf 使用 51男孩名字和50个女孩名字组成的 NS 地址组，会有 2550 个不同组合。

假如有一个 example.com 的域名在 cf 下的 NS 是 `alice.ns.cloudflare.com` 和 `bob.ns.cloudflare.com`，那么你可以通过注册 2551 个 cf 账号，然后调用相关 API 就可以碰撞到 alice 和 bob 这两个 NS 对:

```
POST /client/v4/zones
{
  "name": "example.com",
  "account": { "id": "自己的account_id" },
  "jump_start": true
}
```

那么你就有权限来管理这个不属于你并且没有主人允许的域名了吗？

不是的。首先调用上面这个接口，cf 会给你返回一个 zone 和一对 NS 地址，这个 zone 是 pending 状态，cf 的后台对 example.com 这个域名，是有对应的 zone 的; 如果用户手动将 NS 改成你返回的 NS 地址，那么就会触发 cf 将 example.com 对应的 zone 转移到你的 zone 上，这样你的 zone 状态就激活了。

如果使用暴力碰撞方式，恰巧碰撞到 example.com 的原始 NS 地址，但由于用户没有手动修改 NS 地址，那么是不会触发 cf 将 example.com 对应的 zone 迁移。

