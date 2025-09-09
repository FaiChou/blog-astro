---
title: "Network config in OpenWrt"
publishDate: "2025-02-27"
description: "A deep  explanation of network config in OpenWrt"
tags: ["linux", "network"]
---

下面是 `/etc/config/network` 的配置：

```
# /etc/config/network
config interface 'loopback'
        option ifname 'lo'
        option proto 'static'
        option ipaddr '127.0.0.1'
        option netmask '255.0.0.0'

config interface 'wan'
        option ifname 'eth1'
        option proto 'pppoe'
        option username 'xxx'
        option password 'xxx'
        # 其他 PPPoE 相关参数

config interface 'lan'
        option type 'bridge'
        option ifname 'eth0'  # 如果有多个口，就写成 "eth0 eth2" 或者 "eth0.1" 之类
        option proto 'static'
        option ipaddr '192.168.2.1'
        option netmask '255.255.255.0'
        option gateway '192.168.2.1'
        option dns '192.168.2.1'
```

或者用下面的配置将 eth0 和 eth1 桥接，然后配置静态网络:

```
# config device (物理或虚拟设备)创建了一个桥接设备 br-lan, 将 eth0.1 和 eth1 桥接在一起
config device
    option name 'br-lan'
    option type 'bridge'
    list ports 'eth0'
    list ports 'eth1'

# config interface (逻辑网络接口)定义了逻辑接口 lan, 绑定到 br-lan 上
config interface 'lan'
    option ifname 'br-lan'
    option proto 'static'
    option ipaddr '192.168.1.1'
    option netmask '255.255.255.0'
```

下面是 `/etc/config/dhcp` 的配置：

```
# /etc/config/dhcp
config dhcp 'lan'
    option interface 'lan'
    option start '100'
    option limit '150'
    option leasetime '12h'
```

下面我将从 OpenWrt 配置文件、内核态与用户态之间的程序与流程、数据包在内核和用户态之间的流动、以及 DHCP 在指定 LAN 接口上工作等方面进行说明。

## /etc/config/network 的配置作用

在 OpenWrt 中，`/etc/config/network` 主要由 netifd(network interface daemon) 来解析和管理，负责配置网络接口（包括物理接口、桥接接口、虚拟 PPP 接口等等）。

#### loopback

本地回环 (loopback) 接口，名称是 lo, IP 地址为 127.0.0.1/8。在内核中这个接口对应 lo 设备，和大多数 Linux 系统类似。

#### WAN 接口配置: PPPoE

WAN 接口使用 eth1 作为物理网口，并采用 pppoe 协议。当 OpenWrt 启动时, netifd 会根据此配置去加载 PPPoE 所需的内核模块、启动 pppd 等用户态程序，并在内核创建一个 PPP 网络接口（如 pppoe-wan 或 ppp0 等），由 pppd 来管理 PPPoE 拨号、认证、获取 IP 等。

内核态行为：
- 内核加载 PPPoE 相关模块 (如 pppoe.ko)
- 创建一个 PPP 接口 (例如 ppp0), 并将其与物理接口 eth1 关联
- PPPoE 模块处理 PPPoE 帧的封装和解封装

用户态行为：
- pppd(Point-to-Point Protocol 守护进程)会被启动，负责 PPPoE 拨号
- pppd 使用配置中的 username 和 password 进行认证，与 ISP 协商 IP 地址
- netifd (网络接口守护进程) 负责读取配置并调用 pppd

#### LAN 接口配置：桥接 + 静态 IP

配置 LAN 接口为桥接模式，并分配静态 IP 地址。桥接允许多个物理接口(如 eth0), 组成一个逻辑接口，用于局域网通信。

内核态行为：
- 内核创建一个桥接设备 (例如 br-lan), 并将 eth0 添加到这个桥中
- 为 br-lan 接口分配静态 IP 地址 192.168.2.1, 子网掩码为 255.255.255.0
- 设置默认网关和 DNS 服务器为 192.168.2.1。

用户态行为：
- netifd 读取配置，调用内核接口设置桥接和 IP 地址
- 如果需要手动调整桥接，可以使用 brctl 工具（但在 OpenWRT 中通常由 netifd 自动管理）

## /etc/config/dhcp 的配置作用

OpenWrt 中默认使用 dnsmasq 作为 DHCP 服务器、DNS 缓存转发器。为 lan 接口配置 DHCP 服务器，分配 IP 地址范围从 192.168.2.100 到 192.168.2.249, 租期为 12 小时。

用户态行为：
- dnsmasq 守护进程会被启动，作为 DHCP 服务器
- dnsmasq 监听 br-lan 接口上的 DHCP 请求，根据配置分配 IP 地址
- dnsmasq 在 br-lan 接口上监听 67/UDP (DHCP 服务端端口) 和 53/UDP(DNS 端口)

内核态行为：
- 内核本身不直接处理 DHCP 协议，仅负责将 DHCP 数据包从物理接口传递到用户态的 dnsmasq

## 数据包的流动：从物理接口进入到用户态的过程

#### 以 LAN 口上 DHCP 请求包为例

- 物理层：主机 A (比如电脑、手机) 通过网线或 Wi-Fi (若有无线也桥进了 br-lan) 发出一个 DHCP Discover 广播帧 (目的 MAC 通常是 FF:FF:FF:FF:FF:FF)。
- 驱动层: OpenWrt 的网卡驱动 (管理 eth0) 收到该帧，提交给内核网络子系统。
- 桥接层：内核中 br-lan (bridge) 逻辑会检测到这是一帧广播数据 (UDP 67/68 端口)，目标 IP 为 255.255.255.255 或者 0.0.0.0, 反正是 DHCP 的广播方式。这时：
        - 如果它是发往网桥内其他端口，就广播出去；
        - 同时也会判断这个广播是否要交给本机 (br-lan 设备自身 IP)处理。
- 协议栈层：因为这个 DHCP Discover 的目标是 DHCP 服务器端口 67/UDP, 本机正好在 br-lan 上有 IP 并且有一个进程 (dnsmasq) 在该端口监听，内核会将此数据包“上交”给在本机 br-lan 上监听 67 端口的程序。
- 用户态 dnsmasq: dnsmasq 通过 socket 收到这个 DHCP Discover, 进行处理，然后发出 DHCP Offer 再回复给请求方。
- 内核发送: dnsmasq 写 socket -> 内核网络协议栈 -> 判断要发往 br-lan -> 驱动 -> 网卡 -> 返回给主机 A。

#### 以 WAN PPPoE 流程为例

- 当 wan 设置为 PPPoE 后, pppd 与内核 PPPoE 插件协同工作，底层在 eth1 上捕捉 PPPoE 协商的以太帧 (EtherType 为 0x8863/0x8864)。
- 内核中的 PPPoE 驱动接收并解析 PPPoE 以太帧，并将其交给 pppd (用户态)来进行 PPP 层的鉴权、协商 (CHAP/PAP 等)。
- PPP 协商成功后，内核会出现一个 PPP 虚拟网卡 (如 pppoe-wan 或 ppp0)，这个网卡就拥有公网 IP (或运营商分配的 IP)，然后正常走 IP 协议栈对外通信。数据收发时依然是：
        - 用户态程序 (例如 wget) -> 写 socket -> 内核路由查找 -> 走 PPP 虚拟网卡 -> 内核 PPPoE 驱动 -> 实际发往 eth1 -> 运营商。
        - 返回的数据包从 eth1 进来 -> PPPoE 驱动解封装 -> 内核 PPP 网络接口 -> 内核根据目标端口/IP 分发到对应的用户态 socket 或转发到 LAN 等。

## 用户态发送一个数据包是怎么传出去的

以在路由器上执行 ping 8.8.8.8 为例：
1. 用户态：命令 ping 8.8.8.8 程序会创建一个 ICMP socket, 向内核发出数据包。
2. 内核路由：内核检查路由表，发现去往 8.8.8.8 的缺省路由走 pppoe-wan, 将包封装为 PPP/PPPoE, 再经过 eth1 发送到 ISP。
3. 返回响应: ISP 回包进来 -> eth1 接收帧 -> 内核 PPPoE 驱动解封装 -> PPP 网络接口 -> 内核查找 ICMP 协议、匹配 socket -> 用户态 ping 收到。

## DHCP 在 LAN 接口上的运行机制

OpenWrt 的 `/etc/config/dhcp` 文件中 `config dhcp 'lan'` 里指定 `option interface 'lan'`，这实际上会翻译成“在内核中名为 br-lan 的网络接口上启动 DHCP 服务”。启动时, dnsmasq 会以命令行参数或配置文件形式绑定到 br-lan 上，监听 UDP 端口 67(DHCP server)和 53(DNS)。当内核在 br-lan 接收到目的端口为 67 的 DHCP 请求时，就会把这个包递给 dnsmasq 进程进行处理。
