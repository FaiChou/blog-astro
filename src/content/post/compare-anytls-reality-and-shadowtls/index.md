---
title: "Compare AnyTLS, Reality and ShadowTLS"
publishDate: "2025-07-10"
description: "Compare AnyTLS, Reality and ShadowTLS"
tags: ["linux", "devops", "c", "golang", "rust"]
---

发现这些协议很有趣，在与 GFW 斗争的时候，把自己的招式都摆出来，毕竟是开源的，GFW 也知道你用什么招式，你在明处，GFW 在暗处，所以就需要详细的了解 tls 的 RFC 以及浏览器等各种实现细节，将代理数据以及验证方式藏匿于数据包中。

下面我探究了四款常用协议，有的是在 tls 握手之后进行通信，靠 tls 的加密进行传输，有的是完全重写了 tls 握手，伪装成 tls。当然也有一些协议比如 mtproto 和 snell，大概都是这样的实现方式，这里我就不做过多对比了。

需要理解这些项目的实现，需要你有以下基础知识：

1. tcp/ip  的分层结构
2. tls 的数据结构，握手过程
3. 密钥交换机制（如DHE或ECDHE）
4. tls1.3 Forward Secrecy 向前保密性，即使服务器私钥泄露也无法解析请求

这些协议的重点内容是服务器的实现，所以下面是以服务器端视角出发。

## Trojan & Trojan-killer

Trojan 是典型的用 TLS 加密，请求到达后，客户端先和服务器进行 tls 握手，握手成功后，客户端会发送一个带密码的请求 `SHA224(password)+CRLF+Request+CRLF`，服务器收到后解析并验证，验证失败则 fallback，验证成功后，那么就解析中间的 Request 进行双向传输。

这就有一个很典型的 TLS over TLS(ToT) 问题，因为要访问的目标服务器也是一个 https 网站，那么还会与其进行 tls 握手，毕竟是直接套 TLS 传输，虽然有一层 TLS 加密，但还是有一定的特征，能被精准识别别。

Trojan-Killer 就是一个识别 Trojan ToT 特征的工具，它先判断是否是 `CONNECT` 请求，如果是，那么可能是 https 连接，然后通过判断第一个数据包是否包含 CCS `ChangeCipherSpec : var CCS = []byte{20, 3, 3, 0, 1, 1}`，如果包含，那么就代表是 https 连接，于是再进行中间数据包的特征识别：

```go
if upCount >= 650 && upCount <= 750 &&
    ((downCount >= 170 && downCount <= 180) || (downCount >= 3000 && downCount <= 7500)) {
    fmt.Printf("%v is Trojan\n", req.URL.Host)
}
```

这个识别逻辑能精准探测 Trojan ToT 的特征。

## AnyTLS-go

Anytls 和 Trojan 很像，也是先进行 tls 握手，握手成功后读取第一个数据包，如果第一个数据包能解出来密码，那可以判断是自己人，否则走 fallback 逻辑（断开连接）。这里可以提一下，是由 tls1.3 的会话密钥来防止重放攻击的，每次握手的会话密钥都是不一样。判断出是自己人之后，于是就拨号（dns解析等）对目标服务器发起请求，通过 `bufio.CopyConn(ctx, conn, c)` 建立双向通信，stream.go 中实现了 `net.Conn`，数据包会通过 `newFrame(cmdPSH, s.id)` 发送到 session，session 中有复杂的逻辑来做处理自定义的数据帧(frame)，重点是**动态的 padding 填充**，用来消除 Trojan 那种 ToT 特征。

优点是 Anytls 实现了动态 padding 填充，但缺点还是要提一下，在 go 语言这个 demo 版本下有以下几个缺点：

1. sni 填写 bing，但是握手时候使用自己生成的随机证书，gfw 一探便知
2. 对于密码错误的情况，fallback 逻辑是直接断开连接，这也不是正常 http 服务器的行为

对于第一个缺点，可以使用 mihomo/singbox 的实现，通过自己生成的证书，我看很多人直接使用 openssl 签一个 bing 的证书，那这和使用随机证书没啥区别，gfw 一探便知。
有一个相对合理一点的是搭配自己的域名解析，解析到这台服务器，然后使用 acme 等工具给这个域名定期续期证书。但 gfw 看你频繁访问小站，也是比较可疑，而且看了下 mihomo 的实现，fallback 逻辑也没有做一个 http 服务器来返回正常的响应。

## Reality

Reality 完成了对 tls 的伪装，服务器生成的公私钥，将公钥配置到客户端。客户端在第一个 client hello 包的时候就已经能够生成会话密钥了。传统的 tls1.3 中，需要等 server hello 才能拿到服务器公钥。也就是说，客户端先于服务器拿到会话密钥。客户端用会话密钥将一些数据（客户端版本，时间戳，shortId）加密，藏到了 tls1.3 的 sessionId 中。有时间戳这种东西，进而可以避免一般的重放攻击。服务器收到第一个 client hello 包后，拿到客户端公钥，计算出会话密钥，如果能成功解码出 sessionId 验证了版本，时间戳以及 shortId 后，那就代表是自己人，否则直接 fallback 进行 tcp 的转发，转发到 sni 目标服务器返回真实的服务器证书来进行握手。

当判断出自己人之后，可以直接生成随机证书返回给客户端，和客户端建立起 tls 连接，后面的数据直接封装在 Application Data (tls Record) 中。它没有像 Anytls 一样自定义数据帧，没有消除 ToT 问题。所以需要配合 Vision 流控来消除特征。但 Vision 是固定的 padding，所以还是有一定的特征，不如 Anytls 这种动态 padding 强。

而且使用时间戳的 hmac 验证来防止重放攻击，这本身并不是很靠谱，因为有差异值的出现，gfw 直接在线攻击也是没办法的避免的。

## ShadowTLS

ShadowTLS 和 Reality 类似，也是 tls 的伪装，但 ShadowTLS 的实现极其复杂，模拟了 TLS 的握手流程，作为中间人，在客户端和 SNI 服务器之间进行解析修改并转发。为了更好理解，我们以客户端使用 `ss+shadowtls(v3)` 访问谷歌为例，使用 bing 作为 SNI 服务器。首先要知道有以下几个角色：

1. 客户端
2. ShadowTLS 服务器
3. bing 服务器
4. ss 服务器（可以是本机运行，也可以是远程服务器）
5. google 服务器

首先客户端发起了一个 client hello 包到 ShadowTLS 服务器，服务器读取这个包，解析 SNI，并且验证 sessionId 中的 HMAC，这样可以判断是否为自己人。如果不是自己人，则作为一个 SNI 代理双向复制，完成握手。如果是自己人，那么将 client hello 包转发到 bing 服务器，ShadowTLS 服务器与 bing 服务器握手，bing 服务器返回 server hello, 再被 ShadowTLS 服务器截获，然后 ShadowTLS 服务器提取出 server hello 中的 server random 字段，用作后面的 hmac 参数。再将完整的 server hello 包转发到客户端。此时，ShadowTLS 服务器会开启两个异步任务，一个 `copy_by_frame_until_hmac_matches` 另一个 `copy_by_frame_with_modification`。可客户端收到 server hello 后，会发送 finished 包到 bing 服务器，也要经过 ShadowTLS 的转发，但这个包不会被 `copy_by_frame_until_hmac_matches` 捕获，因为它不包含 hmac 参数。

这样握手就已经建立起来了，然后 bing 服务器会发送第一条 tls Record，这时候，会被 ShadowTLS 服务器截获，流量经过 `copy_by_frame_with_modification` 处理，修改其中的数据，插入 hmac，然后再发送到客户端，客户端收到带 hmac 的 tls 记录之后，解析并验证，验证成功后再将访问谷歌的请求发送给 ShadowTLS, 使用 ss 加密，并且也加上 hmac，作为 Application Data 发送回 ShadowTLS 服务器。服务器收到后，会经过 `copy_by_frame_until_hmac_matches` 处理，收到了带 hmac 的 tls 记录后，判断是客户端发送来的请求，然后解析出 `pure_data`，也就是 ss 加密的数据。

这里为什么在第一次握手时候已经判断了自己人后，还要进行这么复杂的验证流程？看源码能发现有 `hmac_sr_c` `hmac_sr_s` 和 `hmac_sr` 这 3 个 hmac。之所以这么复杂，是为了完全解决重放攻击。即使前面的 client hello被重放，由于每次握手 bing 服务器都会生成随机的值，导致不对应，所以后面的重放无法生效。

然后获取到 ss 加密数据后，会将这数据转发到配置好的 ss 服务器，ss 服务器将内容解析出明文，再转发到 google 服务器，后面就是客户端与 google 服务器建立 tls 连接。

随后的数据包也是被 ShadowTLS 封装在 Application Data 中，并且添加 hmac 验证。每次服务器和客户端收到数据包都要进行 hmac 的验证(`copy_remove_appdata_and_verify`)。

至此，ShadowTLS 的核心实现就完成了。它没有缺点吗？不一定，因为 bing 这些大公司都是有自己的服务器集群的，它们的 ip 比较固定，GFW 发现一个普通的 VPS ip 上有 bing 的 sni 代理，这很明显也是可疑的。另外这么多加密解密验证，性能上也是有一定损耗。

## 参考

- [Trojan](https://github.com/trojan-gfw/trojan)
- [Trojan-killer](https://github.com/XTLS/Trojan-killer)
- [REALITY](https://github.com/XTLS/REALITY)
- [ShadowTLS](https://github.com/ihciah/shadow-tls)
- [MTPROTO](https://github.com/9seconds/mtg)
