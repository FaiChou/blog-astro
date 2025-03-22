---
title: 大鹅配置
description: Linux 下 dae 的配置
publishDate: "2025-03-22T11:23:00Z"
---

```
global {
  wan_interface: eno1
  log_level: info
  auto_config_kernel_parameter: true
}

node {
  proxy1: 'http://192.168.11.101:7890'
}
dns {
  upstream {
    googledns: 'tcp://dns.google.com:53'
    alidns: 'udp://dns.alidns.com:53'
  }
  routing {
    request {
      qname(geosite:cn) -> alidns
      fallback: googledns
    }
    response {
        upstream(googledns) -> accept
        fallback: accept
    }
  }
}
group {
  proxy_group {
    policy: fixed(0)
  }
}

routing {
  pname(curl) -> proxy_group
  domain(google.com) -> proxy_group
  fallback: direct
}
```