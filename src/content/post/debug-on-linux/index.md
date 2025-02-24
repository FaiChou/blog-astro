---
title: "Debug on Linux"
description: "The steps for debugging an unfamiliar program on Linux"
publishDate: "2025-02-24"
tags: ["linux", "devops"]
---

在 Linux 上可以方便的获取一个程序的信息，比如进程号、监听的端口、进程的执行路径等。你写的程序，运行的时候有一个 pid，可以打开读写一个文件，数据可能保存在内存中，也可能监听了某一个端口，别人可以通过网络协议和这个程序通信。可以通过下面的方法来获取这些信息。

## ps aux | grep name

ps 命令用于显示当前正在运行的进程的相关信息。

```
$ ps aux | grep nezha
root        2290  3.1  0.0 735760 36644 ?        Ssl  Feb22  86:27 /opt/nezha/agent/nezha-agent -c /opt/nezha/agent/config.yml
```

我们主要关注它的 pid 2290 和启动程序 `/opt/nezha/agent/nezha-agent`。代表着这是一个 nezha 探针的 agent 程序。

## lsof -p pid

lsof 命令可以看到它打开了哪些文件，在 Linux 上很多程序都是通过文件来通信的。

```
 $ lsof -p 2290
COMMAND    PID USER   FD      TYPE             DEVICE SIZE/OFF     NODE NAME
nezha-age 2290 root  cwd       DIR              259,4     4096 32243715 /opt/nezha/agent
nezha-age 2290 root  rtd       DIR              259,4     4096        2 /
nezha-age 2290 root  txt       REG              259,4 19030016 32243716 /opt/nezha/agent/nezha-agent
nezha-age 2290 root    0r      CHR                1,3      0t0        4 /dev/null
nezha-age 2290 root    1u     unix 0x000000005848a4b5      0t0   125969 type=STREAM (CONNECTED)
nezha-age 2290 root    2u     unix 0x000000005848a4b5      0t0   125969 type=STREAM (CONNECTED)
nezha-age 2290 root    3u     unix 0x0000000010674ad5      0t0   172045 type=DGRAM (CONNECTED)
nezha-age 2290 root    4u  a_inode               0,14        0     2069 [eventpoll:3,5,7]
nezha-age 2290 root    5r     FIFO               0,13      0t0   172034 pipe
nezha-age 2290 root    6w     FIFO               0,13      0t0   172034 pipe
nezha-age 2290 root    7u     IPv4            1265709      0t0      TCP epyc:40044->10.xxx.xxx.xxx:8008 (ESTABLISHED)
```

解释下 TYPE 列：

- DIR 代表目录：/opt/nezha/agent
- REG 普通文件：/opt/nezha/agent/nezha-agent
- CHR 字符设备：/dev/null
- unix 代表 Unix 域套接字：本地通信
- FIFO 命名管道：进程间通信
- a_inode 代表内核对象：eventpoll
- IPv4 是网络连接：TCP 连接

也就是说，nezha-agent 这个程序是在 `/opt/nezha/agent` 目录下，启动脚本是 `nezha-agent`，它打开了 40044 端口，目前连接到 10.xxx.xxx.xxx:8008 地址。

`/dev/null` 是一个特殊的字符设备文件，代表着黑洞。向 `/dev/null` 写入的任何数据都会被丢弃，从 `/dev/null` 读取数据会立即返回 EOF, 不会有任何数据返回。在 Linux 上一般是把 stdout 和 stderr 重定向到 `/dev/null`，不向终端输出信息。

Linux 上有两种管道通信，一种是匿名管道，另一种是命名管道。管道是用来进程间通信的，**内存中的数据传递**，比如 `ps aux | grep nezha` 就是一个匿名管道，`ps aux` 是父进程，`grep nezha` 是子进程，`ps aux` 将输出内容通过管道发送给了 `grep` 程序。命名管道对于无亲缘关系进程也可以使用，shell 中用的比较少，使用 mkfifo 创建（c语言也是用它）。

epoll 是 Linux 提供的一种高效 I/O 事件通知机制，适合处理大量并发连接。可以通过下面例子来讲解：

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/epoll.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#define MAX_EVENTS 10

int main() {
    // 1. 创建 epoll 实例
    int epfd = epoll_create1(0);
    if (epfd < 0) {
        perror("epoll_create1 failed");
        return 1;
    }

    // 2. 创建一个监听 socket
    int sockfd = socket(AF_INET, SOCK_STREAM, 0);
    if (sockfd < 0) {
        perror("socket failed");
        return 1;
    }

    struct sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(8888);
    if (bind(sockfd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        perror("bind failed");
        return 1;
    }
    if (listen(sockfd, 5) < 0) {
        perror("listen failed");
        return 1;
    }
    printf("Server listening on port 8888...\n");

    // 3. 将 socket 注册到 epoll 实例
    struct epoll_event ev;
    ev.events = EPOLLIN; // 监听可读事件（新连接到来）
    ev.data.fd = sockfd; // 关联的文件描述符
    if (epoll_ctl(epfd, EPOLL_CTL_ADD, sockfd, &ev) < 0) {
        perror("epoll_ctl failed");
        return 1;
    }

    // 4. 等待事件
    struct epoll_event events[MAX_EVENTS];
    while (1) {
        int nfds = epoll_wait(epfd, events, MAX_EVENTS, -1); // 阻塞等待
        if (nfds < 0) {
            perror("epoll_wait failed");
            return 1;
        }

        for (int i = 0; i < nfds; i++) {
            if (events[i].data.fd == sockfd) {
                // 主 socket 有新连接
                struct sockaddr_in client_addr;
                socklen_t len = sizeof(client_addr);
                int client_fd = accept(sockfd, (struct sockaddr*)&client_addr, &len);
                if (client_fd < 0) {
                    perror("accept failed");
                    continue;
                }
                printf("New connection: %s:%d\n", inet_ntoa(client_addr.sin_addr),
                       ntohs(client_addr.sin_port));
                close(client_fd); // 示例中简单关闭，实际中可继续处理
            }
        }
    }

    // 5. 清理
    close(sockfd);
    close(epfd);
    return 0;
}
```

上面的程序使用 `epoll_create1(0)` 创建一个 epoll 实例，返回文件描述符 epfd。`epoll_ctl` 将监听 socket（sockfd）添加到 epoll 实例中，监听 EPOLLIN 事件（表示有数据可读，例如新连接）。`epoll_wait` 阻塞等待事件发生，返回就绪的文件描述符数量(nfds), `events` 数组存储就绪的事件信息。检查哪个文件描述符触发了事件（这里是新连接），用 accept 处理。

比如监听 10000 个客户端 socket，如果不用 epoll 比如使用多线程管理 socket 或者 select/poll 等，会扫描所有描述符。但 epoll 使用了[红黑树](https://en.wikipedia.org/wiki/Red%E2%80%93black_tree)管理描述符，效率为 O(1)，事件通知为 O(1)，epoll 只返回活跃的连接，大大提高了效律。

具体的 I/O 多路复用可以看[这篇文章](https://www.xiaolincoding.com/os/8_network_system/selete_poll_epoll.html)。


`lsof -i` 用来显示当前系统中所有打开的网络文件（network files），也就是与网络连接相关的文件描述符信息。具体来说，它会列出与网络套接字（socket）相关的进程信息。

```
$ lsof -i :8080
COMMAND  PID  USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
python  1234  user    3u  IPv4  56789      0t0  TCP 192.168.1.10:8080 (LISTEN)
python  1234  user    4u  IPv4  56790      0t0  TCP 192.168.1.10:8080->10.0.0.5:54321 (ESTABLISHED)
python  1234  user    5u  IPv4  56791      0t0  TCP 192.168.1.10:8080->172.16.0.8:65432 (ESTABLISHED)
python  1234  user    6u  IPv4  56792      0t0  TCP 192.168.1.10:8080->8.8.8.8:12345 (ESTABLISHED)
```

上面可以看到 python 程序监听了 8080 端口，此时有 3 个外面的 ip 和这个 8080 端口建立了 TCP 连接。

## ss -tlnp

ss 命令用于查看套接字统计信息的工具，它是 `netstat` 命令的现代替代品。平时使用的时候，一般会搭配 `watch` 来观测实时的连接信息，比如 `watch -n 2 ss -tuln`，这样每 2 秒会刷新一下连接信息, 毕竟有些请求断开就结束了，无法被实时统计到，可以搭配 `watch` 命令来实时查看。

一般的 `-tuln` 代表着 tcp udp listen number, 后面的 number 意思是转换成 ip 地址，而不是 host 名称。如果加上 `p` 参数，则代表展示 process 进程信息。

也可以使用 `ss -s` 显示统计信息:

```
Total: 1992
TCP:   318 (estab 8, closed 3, orphaned 0, timewait 0)

Transport Total     IP        IPv6
RAW	  0         0         0
UDP	  307       304       3
TCP	  315       309       6
INET	  622       613       9
FRAG	  0         0         0
```

`ss -4` 查看 ipv4 的连接信息，`ss -6` 查看 ipv6 的连接信息。

```
 $ ss -4
Netid               State               Recv-Q               Send-Q                              Local Address:Port                                  Peer Address:Port                Process
tcp                 ESTAB               0                    0                                      100.64.0.5:ssh                                     100.64.0.2:65084
tcp                 ESTAB               0                    0                                  192.168.11.117:38372                                 45.xx.xx.13:https
tcp                 ESTAB               0                    0                                      100.64.0.5:ssh                                     100.64.0.2:64925
tcp                 ESTAB               0                    0                                  192.168.11.117:58748                                  104.xx.xx.7:https
tcp                 ESTAB               0                    0                                      100.64.0.5:ssh                                     100.64.0.1:55403
tcp                 ESTAB               0                    0                                  192.168.11.117:53660                                  3.xx.xx.84:https
tcp                 ESTAB               0                    46                                 192.168.11.117:40044                                103.xx.xx.120:8008
tcp                 ESTAB               0                    568                                192.168.11.117:56824                               54.xx.xx.147:https
```

使用 `grep ':8080'` 来显示 HTTP 相关的连接:

```
 $ ss tunap | grep ':8080'
Netid  State      Recv-Q Send-Q  Local Address:Port   Peer Address:Port   Process
tcp    ESTAB      0      0       192.168.1.10:8080   10.0.0.5:54321      users:(("python",pid=1234,fd=3))
tcp    ESTAB      0      0       192.168.1.10:8080   172.16.0.8:65432    users:(("python",pid=1234,fd=4))
```

可以看到此时建立了两个 TCP 连接。

使用 `ss` 命令性能高且信息清晰，因为 `ss` 直接从内核读取数据，速度更快。`lsof -i` 需要扫描所有打开的文件描述符，效率较低。

## grpcurl

如果一个程序使用了 RPC 调用，那么它就不能通过普通的 curl 进行测试连接了，需要使用 [fullstorydev/grpcurl](https://github.com/fullstorydev/grpcurl) 这个工具做测试。

对于调用来讲，需要有完整的 proto 文件才可以和对方通信。这样就可以直接调用程序内部的方法，可以通过 list 来列出所有的方法:

```
 $ grpcurl -plaintext \
        -import-path anxxxl/src/anxxxoto \
        -proto axxxe.proto \
        -proto req_resp_types.proto \
        127.0.0.1:38805 \
        list
```

调用方法:

```
 $ grpcurl -plaintext \
        -import-path anxxxl/src/anxxxoto \
        -proto axxxe.proto \
        -proto req_resp_types.proto \
        127.0.0.1:38251 \
        anxxxxto.XXXX/NetworkInfo
{
  "connectedPeers": [
    "ACQIARIxxxJ43w=",
    "ACQIARIgxxxm80J8vK30="
  ],
  "listeners": [
    "/ip4/127.0.0.1/udp/57204/quic-v1",
    "/ip4/192.168.11.117/udp/57204/quic-v1",
    "/ip4/100.64.0.5/udp/57204/quic-v1",
    "/ip4/172.17.0.1/udp/57204/quic-v1",
    "/ip4/172.18.0.1/udp/57204/quic-v1"
  ]
}
```

## /proc

在 linux 上，`/proc` 是一个很特殊的虚拟文件系统，也被称为进程信息伪文件系统。它会将内存中的进程信息以文件系统的形式映射到这里。`/proc` 的主要作用是提供一个接口，让用户和程序可以访问内核的内部状态、进程信息以及系统运行时的各种数据。`/proc` 就像是 Linux 内核的一面镜子，通过它你可以窥探系统的内部运行状态。

常用的有:

`/proc/cpuinfo`：显示 CPU 的详细信息，比如型号、核心数、主频等。
`/proc/meminfo`：内存使用情况，包括总内存、可用内存、缓冲区等。
`/proc/uptime`：系统运行时间（以秒为单位）和空闲时间。
`/proc/version`：内核版本和编译信息。
`/proc/interrupts`：显示中断信息。
`/proc/devices`：列出系统中注册的设备驱动。
`/proc/mounts`：列出当前挂载的文件系统。
`/proc/sys/` 目录下的文件允许查看和修改内核参数。比如：
`/proc/sys/kernel/hostname`：系统的 hostname。
`/proc/sys/net/ipv4/ip_forward`：控制是否启用 IP 转发（0 表示关闭，1 表示启用）。

修改这些参数可以用 echo 命令，例如：`echo 1 > /proc/sys/net/ipv4/ip_forward`。大部分 `/proc` 文件是只读的，只有少数（如 `/proc/sys/` 下的文件）可以写入，且需要 root 权限。

每个运行的进程在 `/proc` 下都有一个以进程 ID（PID）命名的目录，比如 `/proc/1234`。

`/proc/[pid]/cmdline`：启动该进程的命令行参数。
`/proc/[pid]/status`：进程的状态信息，比如内存使用、用户 ID 等。
`/proc/[pid]/fd/`：进程打开的文件描述符，列出该进程当前使用的文件。
`/proc/[pid]/stat`：包含进程的统计信息，如进程ID、父进程ID、进程状态、优先级等。
`/proc/[pid]/task`：包含进程的线程信息，每个线程都有一个对应的目录。
`/proc/[pid]/environ`：包含进程的环境变量。


```
$ cat /proc/2290/environ
LANG=en_US.UTF-8PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/binINVOCATION_ID=9ad1f903c960730JOURNAL_STREAM=8:125969SYSTEMD_EXEC_PID=2290#
 $ cat /proc/2290/cmdline
/opt/nezha/agent/nezha-agent-c/opt/nezha/agent/config.yml
 $ ls /proc/2290/fd/
0  1  2  3  4  5  6  7  9
$ cat /proc/2290/status
Name:	nezha-agent
Umask:	0022
State:	S (sleeping)
Tgid:	2290
Ngid:	0
Pid:	2290
PPid:	1
$ ls /proc/2290/task
17641  2290  2326  2330    245237  28522  29846  29848  3010  3012  3014  3035  3037  3039  304448  34075  35556  36323  3991  403747  40698  4150  4881  5088  54771  59900  60734  60736  7065  8627
17642  2320  2329  245236  28521   29845  29847  3009   3011  3013  3034  3036  3038  3040  312169  34076  35907  38252  3992  404515  4070   4773  5087  5089  56077  59901  60735  7064   8626  8628
```

对于上面提到的 lsof 和 ps 命令也是通过 `/proc` 获取所需信息的。
