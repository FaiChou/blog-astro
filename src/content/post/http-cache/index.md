---
title: "HTTP 缓存"
publishDate: "2021-03-02"
description: "HTTP 缓存"
tags: ["http", "dev"]

---

客户端请求服务器, 中间可能经过缓存服务器, 这是 http 协议里的,
规定了双方如何对待缓存. 其中缓存服务器可以是 cdn 也可以是 nginx 层配置,
可以是客户端的内存/硬盘, 还可以是独立的一个服务器,
比如公司给局域网下小伙伴们统一配置了一台缓存服务器, 可以加速局域网下的请求访问.

不管是什么缓存服务器, 都要遵守 http 规则.

其中有两种缓存类型: `cache-control Expires` 和 `Last-Modified Etag`.

客户端第一次请求, 肯定是没有缓存生成的, 如果 cache-control 是 public,
那么缓存服务器就会存储请求, 局域网下所有 ip 对同一 URI 的缓存请求都会直接返回.
当客户端第二次请求, 走了缓存, 还会收到 200 的状态码, 注意不是 304 哦.

当 cache-control 为 private, 则只能同一设备的请求才会被之间返回,
如果局域网下其他人请求, 则还会到达服务器.

当 cache-control 为 no-cache, 或者请求 max-age=0, 是否就不走缓存了? 错,
还会进行缓存, 但缓存服务器会去请求服务器是否缓存过期, 如果没有过期,
则还会走缓存, 304 Not Modified.

当 cache-control 是 no-store, 则不走缓存, 它才是真正的不走缓存.

这里再次说明下, 由于 HTTP 是 C/S 结构, 只能预约一个过期时间,
所以缓存到了过期时间就应该再次验证是否过期, 比如过期后或者客户端发送了一个
`cache-control: max-age=0`, 那么缓存服务器会添加一个 `If-None-Match` 或者
`If-Modified-Since` 字段, 服务器会对这个请求加以验证, 没有过期则返回 304,
说明还没有过期, 过期了的话, 就正常返回 200 即可.


talk is cheap, show me the code:

以下两块代码使用 Node 来展示 Last-Modified 和 Etag 策略:

```javascript
import http from 'http'

let server = http.createServer((req, res) => {
  console.log(req.url, req.headers['if-none-match'])
  if (req.headers['if-none-match']) {
    // check file version
    res.statusCode = 304
    res.end()
  }
  else {
    res.setHeader('Etag', '00000000')
    res.end('harttle.land')
  }
})

server.listen(3333)
```


```javascript
import http from 'http'

let server = http.createServer((req, res) => {
  console.log(req.url, req.headers['if-modified-since'])
  if (req.headers['if-modified-since']) {
    // check timestamp
    res.statusCode = 304
    res.end()
  }
  else {
    res.setHeader('Last-Modified', new Date().toString())
    res.end('harttle.land')
  }
})

server.listen(3333)
```

再用个例子来讲述下, 客户端请求一张图片, 缓存有效期是1天,
那么过了一天后再请求这张图片, 缓存服务器需要检查这张图片是否还能继续可用.
缓存服务器有以上两种策略, 如果图片没变, 还是昨天的图片, 那么缓存服务器发送的
`if-none-match` 字段是一致的, 所以返回 304; 或者 `if-modified-since`
和图片最后修改日期一致, 则没变返回 304.

对于浏览器, 刷新页面(cmd+r)则会重新验证缓存, 验证的话就可能304.

如果强制刷新(shift+cmd+r)则不验证缓存直接和服务器通话.


