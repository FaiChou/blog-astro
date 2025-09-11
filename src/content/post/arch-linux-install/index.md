---
title: "Arch Linux Install"
publishDate: "2025-01-19"
description: "Arch Linux 安装步骤"
tags: ["linux", "devops"]
---

在用 u 盘装 Arch Linux 系统时候，进入 u 盘的 live 系统后，需要将固态硬盘分区，首先要确定主板系统是不是支持 uefi, 一般现在主板都支持 uefi 的，很少有仅支持 legacy BIOS 的，传统 BIOS 仅支持 MBR 的硬盘分区。uefi 则支持 GPT 分区表。

使用 fdisk 分区硬盘时候，先使用 d 删掉已有的分区。删完之后用 g 创建一个 GPT 的分区表(partition table)，然后使用 n 创建分区。
需要创建3个分区：

1. EFI 系统分区，大小 1G
2. 根分区
3. 交换分区（根据内存大小来指定）

先使用 n 创建第一个 efi 分区，编号是 1；再用 n 创建 swap 分区，设置一个大小，编号是 3；再用 n 将剩下的空间分配给 root，编号是2。

然后使用 `mkfs.fat -F32 /dev/sda1` 格式化 EFI 分区，`mkfs.ext4 /dev/sda2` 格式化根分区，`mkswap /dev/sda3` 格式化交换分区，然后使用 `swapon /dev/sda3` 启用。

最后使用 `mount /dev/sda2 /mnt` 将根分区挂载到 /mnt 下，然后使用 `mkdir -p /mnt/boot/efi` 创建 EFI 分区挂载点，并使用 `mount /dev/sda1 /mnt/boot/efi` 挂载 EFI 分区。接下来使用 `pacstrap /mnt base linux linux-firmware` 安装基本系统，然后使用 `genfstab -U /mnt >> /mnt/etc/fstab` 生成文件系统表。最后使用 `arch-chroot /mnt` 进入新系统环境，继续配置时区、语言、网络（dhcpcd）和引导程序。


## 引导程序

使用 `pacman -S grub efibootmgr` 安装引导程序，生成一个 grub 文件夹用来存放引导, `mkdir /boot/grub`, 然后使用 `grub-mkconfig -o /boot/grub/grub.cfg` 生成引导程序配置文件, 最后使用 `grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=GRUB` 安装引导程序。

使用 efibootmgr 可以查看引导程序的配置（在我 debian 中查看的）:

```bash
$ efibootmgr
BootCurrent: 0000
Timeout: 1 seconds
BootOrder: 0000,0006,0002,0003,0004,0005,0001
Boot0000* debian
Boot0001* UEFI: Built-in EFI Shell
Boot0002* (B195/D0/F0) UEFI PXE IPv4 Broadcom NetXtreme Gigabit Ethernet (BCM5720)(MAC:7cc255e613f8)
Boot0003* (B195/D0/F1) UEFI PXE IPv4 Broadcom NetXtreme Gigabit Ethernet (BCM5720)(MAC:7cc255e613f9)
Boot0004* (B195/D0/F0) UEFI PXE IPv6 Broadcom NetXtreme Gigabit Ethernet (BCM5720)(MAC:7cc255e613f8)
Boot0005* (B195/D0/F1) UEFI PXE IPv6 Broadcom NetXtreme Gigabit Ethernet (BCM5720)(MAC:7cc255e613f9)
Boot0006* debian
```

UEFI 启动会根据 NVRAM 中的启动项来启动，也就是上面看到的 **debian**, 它会去 /boot/efi/EFI/**debian** 目录下找启动文件，在启用安全启动的系统中，UEFI 先加载 `shimx64.efi`，然后 `shimx64.efi` 再加载 `grubx64.efi`。最后 GRUB 会加载 Linux 内核(`vmlinuz`)和初始化内存盘(`initrd`)。

```bash
$ tree -L 2 /boot
/boot
├── config-6.1.0-27-amd64
├── config-6.1.0-28-amd64
├── efi
│   └── EFI
├── grub
│   ├── fonts
│   ├── grub.cfg
│   ├── grubenv
│   ├── locale
│   ├── unicode.pf2
│   └── x86_64-efi
├── initrd.img-6.1.0-27-amd64
├── initrd.img-6.1.0-28-amd64
├── System.map-6.1.0-27-amd64
├── System.map-6.1.0-28-amd64
├── vmlinuz-6.1.0-27-amd64
└── vmlinuz-6.1.0-28-amd64

7 directories, 11 files
```

## 启动过程

#### 1. UEFI 固件阶段

开机时，主板的 UEFI 固件 会去读取 EFI 分区（通常挂载到 `/boot/efi`）。它会查找 默认启动项（存放在 UEFI NVRAM 中），比如 `EFI/debian/grubx64.efi`, 或者回退到通用启动文件 `EFI/BOOT/BOOTX64.EFI`。

```
/boot/efi/EFI/debian/grubx64.efi   ← Debian 安装时写入的 EFI 启动程序
/boot/efi/EFI/BOOT/BOOTX64.EFI     ← 兜底的启动程序
```

这两个其实都是 **GRUB EFI 程序**。

#### 2. GRUB EFI 阶段

当 UEFI 加载 `grubx64.efi` 后，就进入 **GRUB EFI 引导器**。GRUB 会读取它的配置文件，`/boot/efi/EFI/debian/grub.cfg`(一个小跳转配置，通常只写一行，指向真正的配置), 实际主要的配置是 `/boot/grub/grub.cfg`。

```
/boot/grub/grub.cfg    ← 主要的 GRUB 配置
/boot/grub/grubenv     ← 存放 GRUB 变量（比如上次启动项）
/boot/grub/fonts/      ← 字体文件
/boot/grub/locale/     ← 本地化语言文件
```

在 `/boot/grub/grub.cfg` 里，会有类似：

```
menuentry 'Debian GNU/Linux' {
    linux   /vmlinuz-6.12.18-trim root=UUID=xxxx rw
    initrd  /initrd.img-6.12.18-trim
}
```

这就告诉 GRUB：

- 内核是 /boot/vmlinuz-6.12.18-trim
- 使用 /boot/initrd.img-6.12.18-trim 作为 initramfs (initial RAM filesystem 初始内存文件系统)
- 内核启动参数里指定 root 分区（UUID）

#### 3. Linux 内核阶段

GRUB 把内核 (vmlinuz-6.12.18-trim) 和 initramfs (initrd.img-6.12.18-trim) 加载到内存, 再把控制权交给内核。

内核启动过程：

1. 解压内核，初始化硬件驱动（早期阶段用 initramfs 里的模块）
2. initramfs 里会挂载真正的 root 文件系统（比如 /dev/nvme0n1p2）
3. 切换到真正的 rootfs 后，执行 /sbin/init（或者 systemd）

#### 4. 用户空间阶段

systemd 或 sysvinit 开始运行，启动各种服务（网络、登录、图形界面等）。最终进入熟悉的登录界面（TTY 或 GDM/KDM）。

#### 5. 总结

```
/boot/efi/EFI/BOOT/BOOTX64.EFI   ← 回退用的 GRUB EFI
/boot/efi/EFI/debian/grubx64.efi ← Debian 的 GRUB EFI 程序
/boot/efi/EFI/debian/grub.cfg    ← 跳转配置（指向 /boot/grub/grub.cfg）
/boot/grub/grub.cfg              ← 主要的引导菜单配置
/boot/config-6.12.18-trim        ← 内核编译配置（不是引导必须）
/boot/vmlinuz-*                  ← 内核
/boot/initrd.img-*               ← initramfs
```


## refs

- [配置Debian路由器双WAN接入](https://blog.ismisv.com/2022/11/dual-wan-internet-access/)
