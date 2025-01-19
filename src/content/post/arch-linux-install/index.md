---
title: "Arch Linux Install"
publishDate: "2025-01-19"
description: "Arch Linux 安装步骤"
tags: ["linux", "devops"]
---

在用 u 盘装 Arch Linux 系统时候，进入 u 盘的 live 系统后，需要将固态硬盘分区，首先要确定主板系统是不是支持 uefi, 一般现在主板都支持 uefi 的，很少有支持 legacy BIOS 的，传统 BIOS 仅支持 MBR 的硬盘分区。uefi 则支持 GPT 分区表。

使用 fdisk 分区硬盘时候，先使用 d 删掉已有的分区。删完之后用 g 创建一个 GPT 的分区表(partition table)，然后使用 n 创建分区。
需要创建3个分区：

1. EFI 系统分区，大小 1G
2. 根分区
3. 交换分区（根据内存大小来指定）

先使用 n 创建第一个 efi 分区，编号是 1；再用 n 创建 swap 分区，设置一个大小，编号是 3；再用 n 将剩下的空间分配给 root，编号是2。

然后使用 `mkfs.fat -F32 /dev/sda1` 格式化 EFI 分区，`mkfs.ext4 /dev/sda2` 格式化根分区，`mkswap /dev/sda3` 格式化交换分区，然后使用 `swapon /dev/sda3` 启用。

最后使用 `mount /dev/sda2 /mnt` 将根分区挂载到 /mnt 下，然后使用 `mkdir -p /mnt/boot/efi` 创建 EFI 分区挂载点，并使用 `mount /dev/sda1 /mnt/boot/efi` 挂载 EFI 分区。接下来使用 `pacstrap /mnt base linux linux-firmware` 安装基本系统，然后使用 `genfstab -U /mnt >> /mnt/etc/fstab` 生成文件系统表。最后使用 `arch-chroot /mnt` 进入新系统环境，继续配置时区、语言、网络和引导程序。


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
