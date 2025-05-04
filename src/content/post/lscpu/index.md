---
title: "lscpu"
publishDate: "2025-05-04"
description: "lscpu"
tags: ["linux", "devops"]
---

lscpu 是 Linux 系统中用于查看 CPU 信息的命令。它提供了详细的 CPU 架构、型号、核心数、线程数、缓存大小等信息。

```bash
# Intel(R) Xeon(R) CPU E5-2660 v2 @ 2.20GHz 40 Physical Core
root@debian:~# lscpu
Architecture:             x86_64
  CPU op-mode(s):         32-bit, 64-bit
  Address sizes:          46 bits physical, 48 bits virtual
  Byte Order:             Little Endian
CPU(s):                   40
  On-line CPU(s) list:    0-39
Vendor ID:                GenuineIntel
  BIOS Vendor ID:         Intel
  Model name:             Intel(R) Xeon(R) CPU E5-2660 v2 @ 2.20GHz
    BIOS Model name:       Intel(R) Xeon(R) CPU E5-2660 v2 @ 2.20GHz        CPU @ 2.2GHz
    BIOS CPU family:      179
    CPU family:           6
    Model:                62
    Thread(s) per core:   2
    Core(s) per socket:   10
    Socket(s):            2
    Stepping:             4
    CPU(s) scaling MHz:   86%
    CPU max MHz:          3000.0000
    CPU min MHz:          1200.0000
    BogoMIPS:             4389.44

Virtualization features:
  Virtualization:         VT-x
Caches (sum of all):
  L1d:                    640 KiB (20 instances)
  L1i:                    640 KiB (20 instances)
  L2:                     5 MiB (20 instances)
  L3:                     50 MiB (2 instances)
NUMA:
  NUMA node(s):           2
  NUMA node0 CPU(s):      0-9,20-29
  NUMA node1 CPU(s):      10-19,30-39

root@debian:~# lscpu -e
CPU NODE SOCKET CORE L1d:L1i:L2:L3 ONLINE    MAXMHZ    MINMHZ       MHZ
  0    0      0    0 0:0:0:0          yes 3000.0000 1200.0000 2593.7639
  1    0      0    1 1:1:1:0          yes 3000.0000 1200.0000 2593.7620
  2    0      0    2 2:2:2:0          yes 3000.0000 1200.0000 2593.7620
  3    0      0    3 3:3:3:0          yes 3000.0000 1200.0000 2593.7781
  4    0      0    4 4:4:4:0          yes 3000.0000 1200.0000 2593.7571
  5    0      0    5 8:8:8:0          yes 3000.0000 1200.0000 2593.7690
  6    0      0    6 9:9:9:0          yes 3000.0000 1200.0000 2593.7629
  7    0      0    7 10:10:10:0       yes 3000.0000 1200.0000 2593.7690
  8    0      0    8 11:11:11:0       yes 3000.0000 1200.0000 2593.7620
  9    0      0    9 12:12:12:0       yes 3000.0000 1200.0000 2593.7600
 10    1      1   10 16:16:16:1       yes 3000.0000 1200.0000 2593.7629
 11    1      1   11 17:17:17:1       yes 3000.0000 1200.0000 2593.7661
 12    1      1   12 18:18:18:1       yes 3000.0000 1200.0000 2593.7639
 13    1      1   13 19:19:19:1       yes 3000.0000 1200.0000 2593.7729
 14    1      1   14 20:20:20:1       yes 3000.0000 1200.0000 2593.7681
 15    1      1   15 24:24:24:1       yes 3000.0000 1200.0000 2593.7620
 16    1      1   16 25:25:25:1       yes 3000.0000 1200.0000 2593.7661
 17    1      1   17 26:26:26:1       yes 3000.0000 1200.0000 2593.7671
 18    1      1   18 27:27:27:1       yes 3000.0000 1200.0000 2593.7600
 19    1      1   19 28:28:28:1       yes 3000.0000 1200.0000 2593.7590
 20    0      0    0 0:0:0:0          yes 3000.0000 1200.0000 2593.7649
 21    0      0    1 1:1:1:0          yes 3000.0000 1200.0000 2593.7600
 22    0      0    2 2:2:2:0          yes 3000.0000 1200.0000 2593.7639
 23    0      0    3 3:3:3:0          yes 3000.0000 1200.0000 2593.7749
 24    0      0    4 4:4:4:0          yes 3000.0000 1200.0000 2593.7639
 25    0      0    5 8:8:8:0          yes 3000.0000 1200.0000 2593.7629
 26    0      0    6 9:9:9:0          yes 3000.0000 1200.0000 2593.7649
 27    0      0    7 10:10:10:0       yes 3000.0000 1200.0000 2593.7639
 28    0      0    8 11:11:11:0       yes 3000.0000 1200.0000 2593.7649
 29    0      0    9 12:12:12:0       yes 3000.0000 1200.0000 2593.7629
 30    1      1   10 16:16:16:1       yes 3000.0000 1200.0000 2593.7590
 31    1      1   11 17:17:17:1       yes 3000.0000 1200.0000 2593.7649
 32    1      1   12 18:18:18:1       yes 3000.0000 1200.0000 2593.7610
 33    1      1   13 19:19:19:1       yes 3000.0000 1200.0000 2593.7629
 34    1      1   14 20:20:20:1       yes 3000.0000 1200.0000 2593.7749
 35    1      1   15 24:24:24:1       yes 3000.0000 1200.0000 2593.7639
 36    1      1   16 25:25:25:1       yes 3000.0000 1200.0000 2593.7649
 37    1      1   17 26:26:26:1       yes 3000.0000 1200.0000 2593.7639
 38    1      1   18 27:27:27:1       yes 3000.0000 1200.0000 2593.7649
 39    1      1   19 28:28:28:1       yes 3000.0000 1200.0000 2593.7639
```

```bash
# AMD EPYC 7543P 32-Core Processor 64 Physical Core
$ lscpu
Architecture:             x86_64
  CPU op-mode(s):         32-bit, 64-bit
  Address sizes:          48 bits physical, 48 bits virtual
  Byte Order:             Little Endian
CPU(s):                   64
  On-line CPU(s) list:    0-63
Vendor ID:                AuthenticAMD
  Model name:             AMD EPYC 7543P 32-Core Processor
    CPU family:           25
    Model:                1
    Thread(s) per core:   2
    Core(s) per socket:   32
    Socket(s):            1
    Stepping:             1
    BogoMIPS:             5589.48

Virtualization features:
  Virtualization:         AMD-V
Caches (sum of all):
  L1d:                    1 MiB (32 instances)
  L1i:                    1 MiB (32 instances)
  L2:                     16 MiB (32 instances)
  L3:                     256 MiB (8 instances)
NUMA:
  NUMA node(s):           8
  NUMA node0 CPU(s):      0-3,32-35
  NUMA node1 CPU(s):      4-7,36-39
  NUMA node2 CPU(s):      8-11,40-43
  NUMA node3 CPU(s):      12-15,44-47
  NUMA node4 CPU(s):      16-19,48-51
  NUMA node5 CPU(s):      20-23,52-55
  NUMA node6 CPU(s):      24-27,56-59
  NUMA node7 CPU(s):      28-31,60-63
$ lscpu -e
CPU NODE SOCKET CORE L1d:L1i:L2:L3 ONLINE
  0    0      0    0 0:0:0:0          yes
  1    0      0    1 1:1:1:0          yes
  2    0      0    2 2:2:2:0          yes
  3    0      0    3 3:3:3:0          yes
  4    1      0    4 4:4:4:1          yes
  5    1      0    5 5:5:5:1          yes
  6    1      0    6 6:6:6:1          yes
  7    1      0    7 7:7:7:1          yes
  8    2      0    8 8:8:8:2          yes
  9    2      0    9 9:9:9:2          yes
 10    2      0   10 10:10:10:2       yes
 11    2      0   11 11:11:11:2       yes
 12    3      0   12 12:12:12:3       yes
 13    3      0   13 13:13:13:3       yes
 14    3      0   14 14:14:14:3       yes
 15    3      0   15 15:15:15:3       yes
 16    4      0   16 16:16:16:4       yes
 17    4      0   17 17:17:17:4       yes
 18    4      0   18 18:18:18:4       yes
 19    4      0   19 19:19:19:4       yes
 20    5      0   20 20:20:20:5       yes
 21    5      0   21 21:21:21:5       yes
 22    5      0   22 22:22:22:5       yes
 23    5      0   23 23:23:23:5       yes
 24    6      0   24 24:24:24:6       yes
 25    6      0   25 25:25:25:6       yes
 26    6      0   26 26:26:26:6       yes
 27    6      0   27 27:27:27:6       yes
 28    7      0   28 28:28:28:7       yes
 29    7      0   29 29:29:29:7       yes
 30    7      0   30 30:30:30:7       yes
 31    7      0   31 31:31:31:7       yes
 32    0      0    0 0:0:0:0          yes
 33    0      0    1 1:1:1:0          yes
 34    0      0    2 2:2:2:0          yes
 35    0      0    3 3:3:3:0          yes
 36    1      0    4 4:4:4:1          yes
 37    1      0    5 5:5:5:1          yes
 38    1      0    6 6:6:6:1          yes
 39    1      0    7 7:7:7:1          yes
 40    2      0    8 8:8:8:2          yes
 41    2      0    9 9:9:9:2          yes
 42    2      0   10 10:10:10:2       yes
 43    2      0   11 11:11:11:2       yes
 44    3      0   12 12:12:12:3       yes
 45    3      0   13 13:13:13:3       yes
 46    3      0   14 14:14:14:3       yes
 47    3      0   15 15:15:15:3       yes
 48    4      0   16 16:16:16:4       yes
 49    4      0   17 17:17:17:4       yes
 50    4      0   18 18:18:18:4       yes
 51    4      0   19 19:19:19:4       yes
 52    5      0   20 20:20:20:5       yes
 53    5      0   21 21:21:21:5       yes
 54    5      0   22 22:22:22:5       yes
 55    5      0   23 23:23:23:5       yes
 56    6      0   24 24:24:24:6       yes
 57    6      0   25 25:25:25:6       yes
 58    6      0   26 26:26:26:6       yes
 59    6      0   27 27:27:27:6       yes
 60    7      0   28 28:28:28:7       yes
 61    7      0   29 29:29:29:7       yes
 62    7      0   30 30:30:30:7       yes
 63    7      0   31 31:31:31:7       yes
```

```bash
# AMD EPYC 9654 96-Core Processor 192 Physical Core
$ lscpu
Architecture:             x86_64
  CPU op-mode(s):         32-bit, 64-bit
  Address sizes:          52 bits physical, 57 bits virtual
  Byte Order:             Little Endian
CPU(s):                   192
  On-line CPU(s) list:    0-191
Vendor ID:                AuthenticAMD
  BIOS Vendor ID:         Advanced Micro Devices, Inc.
  Model name:             AMD EPYC 9654 96-Core Processor
    BIOS Model name:      AMD EPYC 9654 96-Core Processor                 Unknown CPU @ 2.4GHz
    BIOS CPU family:      107
    CPU family:           25
    Model:                17
    Thread(s) per core:   2
    Core(s) per socket:   96
    Socket(s):            1
    Stepping:             1
    Frequency boost:      enabled
    CPU(s) scaling MHz:   43%
    CPU max MHz:          3707.8120
    CPU min MHz:          1500.0000
    BogoMIPS:             4792.82

Virtualization features:
  Virtualization:         AMD-V
Caches (sum of all):
  L1d:                    3 MiB (96 instances)
  L1i:                    3 MiB (96 instances)
  L2:                     96 MiB (96 instances)
  L3:                     384 MiB (12 instances)
NUMA:
  NUMA node(s):           1
  NUMA node0 CPU(s):      0-191
```

```bash
# Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz 16 Physical Core
$ lscpu
Architecture:             x86_64
  CPU op-mode(s):         32-bit, 64-bit
  Address sizes:          39 bits physical, 48 bits virtual
  Byte Order:             Little Endian
CPU(s):                   16
  On-line CPU(s) list:    0-15
Vendor ID:                GenuineIntel
  BIOS Vendor ID:         Intel(R) Corporation
  Model name:             Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz
    BIOS Model name:      Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz To Be Filled By O.E.M. CPU @ 4.4GHz
    BIOS CPU family:      207
    CPU family:           6
    Model:                158
    Thread(s) per core:   2
    Core(s) per socket:   8
    Socket(s):            1
    Stepping:             13
    CPU(s) scaling MHz:   78%
    CPU max MHz:          5000.0000
    CPU min MHz:          800.0000
    BogoMIPS:             7200.00

Virtualization features:
  Virtualization:         VT-x
Caches (sum of all):
  L1d:                    256 KiB (8 instances)
  L1i:                    256 KiB (8 instances)
  L2:                     2 MiB (8 instances)
  L3:                     16 MiB (1 instance)
NUMA:
  NUMA node(s):           1
  NUMA node0 CPU(s):      0-15
```

上面展示了 4 款 CPU 的 lscpu 输出，可以看到每款 CPU 的物理核心数和逻辑核心数。

- 第一个 `Intel(R) Xeon(R) CPU E5-2660 v2 @ 2.20GHz 40 Physical Core`，这是一个双路服务器 CPU，每个 CPU 有 10 个核心，支持超线程，每个 CPU 有 20 个线程，所以总共有 40 个线程。
- 第二个 `AMD EPYC 7543P 32-Core Processor 64 Physical Core`，这个 EPYCD 7543P CPU 有 32 个核心，支持超线程，所以总共有 64 个线程。
- 第三个 `AMD EPYC 9654 96-Core Processor 192 Physical Core`，这个 EPYC 9654 CPU 有 96 个核心，支持超线程，所以总共有 192 个线程。
- 第四个 `Intel(R) Core(TM) i9-9900K CPU @ 3.60GHz 16 Physical Core`，这个桌面 CPU，每个 CPU 有 8 个核心，支持超线程，所以总共有 16 个线程。

lscpu 中展示的 Socket(s) 表示 CPU 的插槽数，Core(s) per socket 表示每个插槽上的核心数，Thread(s) per core 表示每个核心上的线程数。如果 Thread(s) per core 为 2，则表示支持并启用超线程。

lscpu -e
CPU NODE SOCKET CORE L1d:L1i:L2:L3

`lscpu -e` 的 CPU 表示逻辑线程编号，NODE 表示 NUMA 节点，SOCKET 表示物理 CPU 插槽（Physical Socket）的编号，CORE 表示 CPU 物理核心的编号，L1d:L1i:L2:L3 指的是 CPU 的缓存层次结构，具体表示每个逻辑线程（CPU）所关联的缓存单元的索引。

> NUMA（Non-Uniform Memory Access，非均匀内存访问）拓扑是一种计算机体系结构设计，主要用于多核处理器和多处理器系统中，以解决内存访问延迟和带宽瓶颈问题。

NUMA 拓扑通常以节点为单位组织，常见的拓扑结构包括：

- 节点（Node）：每个节点包含一组 CPU 核心和本地内存。
- 互连（Interconnect）：节点之间通过高速互连通信，互连的延迟和带宽会影响远程内存访问的性能。
- 距离（Distance）：NUMA 系统中，节点之间的“距离”表示访问延迟，通常以跳数（Hops）或延迟时间来衡量。访问本地内存的距离为 0，访问相邻节点的内存可能为 1 跳，访问更远节点的内存可能是 2 跳或更多。

例如，在一个双插槽服务器中：

- 每个 CPU 插槽是一个 NUMA 节点。
- 每个节点有自己的本地内存（例如 DDR4 内存条）。
- 两个节点通过 QPI 或其他互连相连。
- CPU1 访问自己的本地内存速度快，访问 CPU2 的内存速度慢。

docker 可以使用 `docker run --cpuset-cpus` 指定 CPU 的物理核心，但是分配 CPU 时候要考虑避免跨核心和跨物理cpu，否则会导致性能下降。

比如对于 `Intel(R) Xeon(R) CPU E5-2660 v2 @ 2.20GHz 40 Physical Core` 这个 CPU，想要限制容器使用 6 个线程，可以这样指定：

```
docker run --cpuset-cpus="0-2,20-22"
docker run --cpuset-cpus="3-5,23-25"
docker run --cpuset-cpus="6-8,26-28"
docker run --cpuset-cpus="10-12,30-32"
docker run --cpuset-cpus="13-15,33-35"
docker run --cpuset-cpus="16-18,36-38"
```

0和20，1和21，2和22，3和23，4和24...都是共享同一个缓存，这样的负载均衡，提高资源的利用率。
