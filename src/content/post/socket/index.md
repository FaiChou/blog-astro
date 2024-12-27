---
title: "Socket编程"
publishDate: "2023-09-15"
description: "Socket编程"
tags: ["dev", "c", "http"]
---

## sockfd = socket(AF_INET, SOCK_STREAM, 0)

- 创建一个 `socket`, 返回一个文件描述符（file descriptor）到 `sockfd`，在 linux/unix 中一切设备和 I/O 操作都是通过文件描述符抽象的。
- `AF_INET` 是 address family internet 一般指的是 ipv4
- `SOCK_STREAM` 是套接字类型参数，表示使用一个面向连接的，通常用于 TCP
- 第三个参数 0 是指协议，这情况是用 TCP


## connect(sockfd, (SA *) &servaddr, sizeof(servaddr))

- 建立与远程服务器连接，tcp 三次握手
- sockfd 是上面的套接字
- servaddr 是服务端地址

## send(sockfd, sendBuffer, strlen(sendBuffer), 0)

发送数据，或者用 write

## recv(sockfd, recvBuffer, sizeof(recvBuffer) - 1, 0)

接收数据，或者用 read


## bind(sockfd, (struct sockaddr *)&servaddr, sizeof(servaddr))

bind 用于绑定套接字到一个本地地址和端口，本地地址可以是所有可用的接口（INADDR_ANY）。
这样有客户端向绑定的地址+端口发送消息时候可以被这个 socket 收到。

在客户端 Socket 中如果不进行 `bind`, 直接调用 `connect`, 则系统会自动分配一个可用的 ip 和端口来匿名绑定。
如果使用 `setsockopt` 设置 `SO_BINDTODEVICE`，则是为 Socket 绑定到一个特定的网络设备（如 eth0, wlan0 等），绕过路由表通常是用这种设置，直接指定数据包通过哪个网络设备进出。
如果使用 `bind` 来绑定 en0 的 ip, 然后进行 `connect` 一个服务器地址，但这个服务器地址经过路由表查询是从 wlan0 口出去，则进行 connect 时候可能会出错。而使用 `SO_BINDTODEVICE` 则强制绑定使用哪个网口。

## listen(sockfd, 5)

listen 用于监听，一般用于 bind 之后，和 accept 之前。
上面例子允许最多有 5 个连接在队列中等待。

## accept(sockfd, (struct sockaddr *)&cliaddr, &cli_len)

`accept` 会阻塞程序，等待客户端请求的到来。当客户端请求到来后，会将客户端的地址信息保存在 `cliaddr` 中，并且 `accept` 返回一个新的 socket file descriptor，这个 `newfd` 用来处理当前请求。

~~通常 `bind+listen+accept` 用于服务端**监听套接字**；而 `listen+accept` 用于**通信套接字**。~~

通常情况下，服务端使用一个“监听套接字”来等待连接请求，然后为每一个接入的客户端创建一个新的“通信套接字”。

“监听套接字”主要用于 `bind()`、`listen()` 和 `accept()`。

“通信套接字”主要用于与特定客户端的数据传输，如使用 `send()` 和 `recv()`。

因此，`bind+listen+accept` 是用于初始化和管理服务端的“监听套接字”的，而新创建出来的套接字（通过 `accept()` 返回）则是“通信套接字”，用于与特定客户端进行数据交换。

当新的请求到来后使用 `while(read(newfd, recvline, MAXLINE-1)>0)` 来读取请求发送来的数据，如果发送完毕，则读取结束后连接关闭(0)，跳出循环。或者遇到错误返回 -1 也会跳出循环。

## 例子

#### 服务端

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <netinet/in.h>

#define MAXLINE 1024

int main() {
    int server_sock, client_sock;
    struct sockaddr_in server_address, client_address;
    socklen_t client_len;
    char recvline[MAXLINE];

    // 创建socket
    server_sock = socket(AF_INET, SOCK_STREAM, 0);

    // 设置server_address
    server_address.sin_family = AF_INET;
    server_address.sin_port = htons(8080);
    server_address.sin_addr.s_addr = INADDR_ANY;

    // bind
    bind(server_sock, (struct sockaddr*)&server_address, sizeof(server_address));

    // listen
    listen(server_sock, 3);

    printf("Listening on port 8080...\n");

    // accept
    client_len = sizeof(client_address);
    client_sock = accept(server_sock, (struct sockaddr*)&client_address, &client_len);

    // recv & send
    while (read(client_sock, recvline, MAXLINE-1) > 0) {
        printf("Received: %s\n", recvline);
        send(client_sock, recvline, strlen(recvline), 0);
    }

    close(client_sock);
    close(server_sock);
    return 0;
}

```

#### 客户端

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <netinet/in.h>

#define MAXLINE 1024

int main() {
    int client_sock;
    struct sockaddr_in server_address;
    char sendline[MAXLINE], recvline[MAXLINE];

    // 创建socket
    client_sock = socket(AF_INET, SOCK_STREAM, 0);

    // 设置server_address
    server_address.sin_family = AF_INET;
    server_address.sin_port = htons(8080);
    server_address.sin_addr.s_addr = inet_addr("127.0.0.1");

    // connect
    connect(client_sock, (struct sockaddr*)&server_address, sizeof(server_address));

    while (1) {
        printf("Enter message: ");
        fgets(sendline, MAXLINE, stdin);

        // send
        send(client_sock, sendline, strlen(sendline), 0);

        // recv
        if (read(client_sock, recvline, MAXLINE-1) > 0) {
            printf("Received from server: %s\n", recvline);
        }
    }

    close(client_sock);
    return 0;
}

```


## 理解 ClashX Pro 开启增强模式后的行为

首先在命令行执行 `netstat -rn` 查看完整的路由表:

```
~ netstat -rn
Routing tables

Internet:
Destination        Gateway            Flags           Netif Expire
default            192.168.31.1       UGScg             en1
default            link#28            UCSIg           utun3
1                  198.18.0.1         UGSc           utun10
2/7                198.18.0.1         UGSc           utun10
4/6                198.18.0.1         UGSc           utun10
8/5                198.18.0.1         UGSc           utun10
16/4               198.18.0.1         UGSc           utun10
32/3               198.18.0.1         UGSc           utun10
64/2               198.18.0.1         UGSc           utun10
100.64/10          link#28            UCS             utun3
100.100.100.100/32 link#28            UCS             utun3
100.124.11.45      100.124.11.45      UH              utun3
127                127.0.0.1          UCS               lo0
127.0.0.0          127.0.0.1          UHW3I             lo0      1
127.0.0.1          127.0.0.1          UH                lo0
128.0/1            198.18.0.1         UGSc           utun10
169.254            link#13            UCS               en1      !
169.254            link#20            UCSI              en7      !
169.254.89.170     de:53:92:5b:4e:c0  UHLSW             en7   1198
169.254.92.128     de:53:92:59:db:6a  UHLSW             lo0
169.254.92.128/32  link#20            UCS               en7      !
192.168.31         link#13            UCS               en1      !
192.168.31.1/32    link#13            UCS               en1      !
192.168.31.1       88:c3:97:c8:2:b6   UHLWIir           en1   1191
192.168.31.24      4:cf:8c:29:a4:97   UHLWI             en1   1188
192.168.31.50      76:29:4:e0:c8:ea   UHLWI             en1   1193
192.168.31.59      c:7a:15:c1:ad:cc   UHLWI             en1      !
192.168.31.73      6:6e:f7:98:f3:4b   UHLWI             en1   1198
192.168.31.80      84:c5:a6:9e:4:3    UHLWIi            en1    677
192.168.31.129     86:11:14:df:18:ce  UHLWI             en1      !
192.168.31.144     56:f9:cf:1e:97:7d  UHLWI             en1    548
192.168.31.166/32  link#13            UCS               en1      !
192.168.31.199     60:dd:8e:69:5c:d0  UHLWI             en1      !
192.168.31.200     4c:1d:96:b7:7f:37  UHLWI             en1    391
192.168.31.222     f8:d0:27:54:e4:84  UHLWI             en1   1198
192.168.31.255     ff:ff:ff:ff:ff:ff  UHLWbI            en1      !
198.18.0.1         198.18.0.1         UH             utun10
224.0.0/4          link#13            UmCS              en1      !
224.0.0/4          link#20            UmCSI             en7      !
224.0.0/4          link#28            UmCSI           utun3
224.0.0.251        1:0:5e:0:0:fb      UHmLWI            en1
224.0.0.251        1:0:5e:0:0:fb      UHmLWI            en7
239.255.255.250    1:0:5e:7f:ff:fa    UHmLWI            en1
255.255.255.255/32 link#13            UCS               en1      !
255.255.255.255/32 link#20            UCSI              en7      !
255.255.255.255/32 link#28            UCSI            utun3
```

其中 `2/7` 表示 `2.0.0.0/7`，地址范围: `2.0.0.0` 到 `2.255.255.255`。

`4/6` 地址范围: `4.0.0.0` 到 `7.255.255.255`。

`8/5` 地址范围: `8.0.0.0` 到 `15.255.255.255`。

`16/4` 地址范围: `16.0.0.0` 到 `31.255.255.255`

`32/3` 地址范围: `32.0.0.0` 到 `63.255.255.255`。

`64/2` 地址范围: `64.0.0.0` 到 `127.255.255.255`。

`128.0/1` 地址范围: `128.0.0.0` 到 `255.255.255.255`。

可以通过路由表可以知道 ip 地址是走哪一个接口跳转哪个网关出去的。

执行 `ifconfig` 可以看到:

```
utun10: flags=8051<UP,POINTOPOINT,RUNNING,MULTICAST> mtu 9000
	inet 198.18.0.1 --> 198.18.0.1 netmask 0xffff0000
```

这个 utun10 就是 ClashX Pro 开启增强模式后添加的虚拟网络接口。

在查看下 DNS 配置:

```
~ scutil --dns
DNS configuration (for scoped queries)

resolver #1
  nameserver[0] : 198.18.0.2
  if_index : 13 (en1)
  flags    : Scoped, Request A records
  reach    : 0x00000002 (Reachable)
```


所以当某个客户端发起请求时候，如果是一个域名，那么需要向 `198.18.0.2:53` 这个 DNS 服务器请求解析获取 ip 地址，经由 en1 这个网口发出（相当于系统 Wi-Fi 里查看 DNS，是针对某一个 Wi-Fi，也就是网口），clash 程序监听着 0.0.0.0:53 本机所有的网口上的 53 端口，这样请求会被 clash 处理。由于增强模式下，clash 是 fake-ip 模式，所以 clash 会立即返回一个 `198.18.x.x` 的地址(可以通过 `ping google.com` 或者 `ping youtube.com` 测试)。

这样获取到一个 `198.18.x.x` 的 ip 地址后，则会向这个地址发起请求，根据路由表则又到达 clash，clash 收到请求后则会处理这个请求，首先拿到它对应的域名是多少，然后再根据规则决定是否真正解析 DNS。

下面这个程序模拟了 clash 开启虚拟网卡以及后续发送请求的过程。

```c
// 创建两个套接字
int utun_sock = socket(AF_INET, SOCK_STREAM, 0);
int eth0_sock = socket(AF_INET, SOCK_STREAM, 0);

// 绑定 utun_sock 到 utun 的 IP 地址
struct sockaddr_in utun_addr;
// 初始化 utun_addr
bind(utun_sock, (struct sockaddr *)&utun_addr, sizeof(utun_addr));

// 绑定 eth0_sock 到 eth0 接口
setsockopt(eth0_sock, SOL_SOCKET, SO_BINDTODEVICE, "eth0", strlen("eth0"));

// 读取数据并转发
char buffer[2048];
while (1) {
    // 从 utun_sock 读取数据
    int n = read(utun_sock, buffer, sizeof(buffer));
    if (n <= 0) {
        // 错误处理
        break;
    }

    // 将数据写入 eth0_sock
    int m = write(eth0_sock, buffer, n);
    if (m <= 0) {
        // 错误处理
        break;
    }
}
```

再补充一下，在 clash 设置中，如果开启了增强模式，则会强制监听 `0.0.0.0:53`，即使不写 `listen: 0.0.0.0:53` 或者改成其他的，都不起作用，使用 dig 命令可以进行测试：

```
dig @192.168.11.109 -p 53 baidu.com
dig @127.0.0.1 -p 53 google.com
dig @198.18.0.1 -p 53 youtube.com
dig @198.18.0.2 -p 53 fb.com
dig @198.18.0.3 -p 53 twitter.com
dig @198.18.0.4 -p 53 facebook.com
dig @198.18.0.5 -p 53 telegram.com
```

可以看结果，前四条（都是本地的网口）地址，返回的 dns 解析结果都是 `198.18.x.x`，这肯定是 fakeip 的结果。

而下面三条则是其余的 ip，可能是 198.18.0.3/4/5 没有找到正确的解析，则使用了其余的 nameserver。

`listen: 0.0.0.0:5431` 不开启增强模式执行:

```
dig @192.168.11.109 -p 5431 twitter.com
dig @127.0.0.1 -p 5431 google.com
dig @198.18.0.1 -p 53 youtube.com
```

则前两条能收到 fakeip 的结果，最后一条没有结果。

如果删掉 `listen:` 这条规则，则经过测试是没有 dns 服务器的。

总结：

`listen: 0.0.0.0:53` 这条在 dns 下面的规则会让 clash 启动一个监听所有网口 53 端口的服务，但是如果开启了 ClashX Pro 的增强模式，这条写不写无所谓，甚至改成其他的端口都不生效，也就是开了增强这条就会失效。如果本机有向任意网口发送 dns 解析请求，则会进行 fakeip 的解析并返回。但如果系统中的 Wi-Fi dns 设置是路由器或者 `8.8.8.8` 则不会走它。因为目标地址并不是本机的网口。

## 为什么是 198.18.0.2

为什么是 `198.18.0.2` 作为 dns，[这个贴子](https://v2ex.com/t/974350)有相关的讨论。

总结下：

1. 不使用 `198.18.0.1` 是出于兼容考虑，如果本机再有 dns 服务器监听了 0.0.0.0 则会冲突
2. `198.18.0.2` 可以通过 `netstat -rna` 查看其 Gateway 是 `198.18.0.1`，[clash meta](https://github.com/MetaCubeX/Clash.Meta/blob/53f9e1ee7104473da2b4ff5da29965563084482d/listener/sing_tun/dns.go#L38)源码中已经可以看到流经 TUN 网口的网络会先判断请求目标地址和端口，如果是 dns 请求，则返回 fakeip
3. 所以虽然 `198.18.0.2` 不是一个网口的地址，但最终都会被 tun 截获
4. `route -n get 198.18.0.2` 可以看到它有两个标示 `HOST` 和 `WASCLONED` 代表着这是一个动态生成的一条路由，缓存用途 
