---
title: "Server Setup"
publishDate: "2024-12-21"
description: "server setup"
tags: ["linux", "devops"]
---

## 1. 修改主机名

`hostnamectl set-hostname 新的主机名` 或者直接 `vi /etc/hosts`, 将 127.0.1.1 旧主机名, 改为 127.0.1.1 新主机名，如果完全是自己装的系统，可以在装机步骤就填好了主机名信息，省略次步骤。

```
127.0.0.1	localhost
127.0.1.1 epyc.yourdomain.com epyc
```

## 2. 更改镜像源（国外服务器省略这一步）

```bash
# /etc/apt/sources.list

deb http://mirrors.tuna.tsinghua.edu.cn/debian bookworm main contrib non-free
deb-src http://mirrors.tuna.tsinghua.edu.cn/debian bookworm main contrib non-free

deb http://mirrors.tuna.tsinghua.edu.cn/debian-security bookworm-security main contrib non-free non-free-firmware
deb-src http://mirrors.tuna.tsinghua.edu.cn/debian-security bookworm-security main contrib non-free non-free-firmware

deb http://mirrors.tuna.tsinghua.edu.cn/debian bookworm-updates main contrib non-free
deb-src http://mirrors.tuna.tsinghua.edu.cn/debian bookworm-updates main contrib non-free
```

然后执行 `apt update` 和 `apt upgrade`。

## 3. 配置 ssh

添加 ssh public keys 到 /root/.ssh/authorized_keys


```bash
# /etc/ssh/sshd_config
PubkeyAuthentication yes
PermitRootLogin prohibit-password
```

重启 `systemctl reload sshd`。

## 4. 配置 zsh & oh-my-zsh

```bash
apt update
apt install -y zsh curl git vim fzf tmux
chsh -s $(which zsh)
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
git clone https://github.com/zsh-users/zsh-autosuggestions ~/.oh-my-zsh/custom/plugins/zsh-autosuggestions
```

## 5. 配置 .zshrc

```bash
# .zshrc
# export PATH=$HOME/bin:$HOME/.local/bin:/usr/local/bin:$PATH

export ZSH="$HOME/.oh-my-zsh"
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
ZSH_THEME="aussiegeek"
plugins=(git z zsh-autosuggestions fzf)
source $ZSH/oh-my-zsh.sh

export LANG=en_US.UTF-8
export LANGUAGE="en_US"
export LC_ALL=en_US.UTF-8
export LS_OPTIONS='--color=auto'
alias vi="vim"
```

最后别忘记 `source ~/.zshrc`


## 6. 配置 .vimrc

```bash
# .vimrc
set encoding=utf-8
set fileencoding=utf-8
set termencoding=utf-8
set number
set cursorline
set autoindent
set smartindent
set tabstop=2
set shiftwidth=2
set expandtab
set ignorecase
set smartcase
set hlsearch
set incsearch
syntax on
set background=dark
colorscheme elflord
set timeoutlen=500
set updatetime=300
```

## 7. 配置 .tmux.conf

```bash
# .tmux.conf
unbind C-b
set -g prefix C-a
bind C-a send-prefix

set-option -g status-bg colour9
set-option -g status-fg colour46

bind-key -n M-Up select-pane -U
bind-key -n M-Down select-pane -D
bind-key -n M-Left select-pane -L
bind-key -n M-Right select-pane -R

bind-key -n M-0 select-window -t 0
bind-key -n M-1 select-window -t 0
bind-key -n M-2 select-window -t 1
bind-key -n M-3 select-window -t 2

set -g mouse on
set -g status-left-length 30
set -g status-right-length 30

set -g pane-border-style fg=brightblack
set -g pane-active-border-style fg=brightgreen

bind -r < resize-pane -L 2
bind -r > resize-pane -R 2
bind -r + resize-pane -U 1
bind -r - resize-pane -D 1

bind | split-window -h
bind - split-window -v
unbind '"'
unbind %

setw -g mode-keys vi
bind -T copy-mode-vi v send-keys -X begin-selection
bind -T copy-mode-vi y send-keys -X copy-pipe-and-cancel "xclip -selection clipboard -i"

set -g history-limit 10000
```

然后执行 `tmux source-file .tmux.conf` 加载配置生效。

## 8. 安装常用工具

```shell
#install_tools.sh
#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

tools=(
  coreutils findutils tar gzip bzip2 xz-utils
  iproute2 net-tools openssh-client traceroute
  gnupg2 util-linux parted dosfstools e2fsprogs
  rsyslog strace zip unzip p7zip-full less
  cron at ntpdate sudo dnsutils
  btop vnstat duf
)

echo -e "Ensuring all tools are installed...\n"
echo "Updating package list..."
apt update

echo "Installing tools..."
apt install -y "${tools[@]}"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}All tools have been successfully installed or were already present${NC}"
else
  echo -e "${RED}Some tools failed to install. Please check your package manager${NC}"
fi
```

或者直接使用一行命令安装:

```bash
apt install -y coreutils findutils tar gzip bzip2 xz-utils iproute2 net-tools openssh-client traceroute gnupg2 util-linux parted dosfstools e2fsprogs rsyslog strace zip unzip p7zip-full less cron at ntpdate sudo dnsutils btop vnstat duf
```

执行上面的命令，补充安装一下常用工具。

## 9. 推荐几个好用工具

- [nezha agent](https://nezha.wiki/) 哪吒监控
- [yazi](https://yazi-rs.github.io/) terminal file manager
- [tailscale](https://tailscale.com/kb/1174/install-debian-bookworm) VPN Service

## 10. locale 以及时区问题

使用 `locale` 检查 `LANGUAGE=en_US` `LANG=en_US.UTF-8` 等。

使用 `timedatectl` 检查时区，修改成 `Asia/Shanghai`:

```bash
$ timedatectl
               Local time: Sat 2024-12-28 20:24:18 EST
           Universal time: Sun 2024-12-29 01:24:18 UTC
                 RTC time: Sun 2024-12-29 01:24:17
                Time zone: US/Eastern (EST, -0500)
System clock synchronized: no
              NTP service: n/a
          RTC in local TZ: no

$ timedatectl set-timezone Asia/Shanghai

$ ls -l /etc/localtime
lrwxrwxrwx 1 root root 35 Dec 29 09:24 /etc/localtime -> ../usr/share/zoneinfo/Asia/Shanghai

 $ cat /etc/timezone
US/Eastern
$ vi /etc/timezone # 修改为 Asia/Shanghai
$ dpkg-reconfigure -f noninteractive tzdata

Current default time zone: 'Asia/Shanghai'
Local time is now:      Sun Dec 29 09:26:23 CST 2024.
Universal Time is now:  Sun Dec 29 01:26:23 UTC 2024.
```

安装 ntp 等工具:

```bash
apt install chrony -y
systemctl enable chrony.service
systemctl start chrony.service
systemctl status chrony.service
chronyc tracking
```

然后再用 `timedatectl status` 检查:

```
 $ timedatectl status
               Local time: Wed 2025-01-01 22:01:28 CST
           Universal time: Wed 2025-01-01 14:01:28 UTC
                 RTC time: Wed 2025-01-01 14:01:28
                Time zone: Asia/Shanghai (CST, +0800)
System clock synchronized: yes
              NTP service: active
          RTC in local TZ: no
```

## 11. 可能会出现的 locale 问题

```bash
$ locale
locale: Cannot set LC_CTYPE to default locale: No such file or directory
locale: Cannot set LC_MESSAGES to default locale: No such file or directory
locale: Cannot set LC_ALL to default locale: No such file or directory
LANG=en_US.UTF-8
LANGUAGE=en_US
LC_CTYPE="en_US.UTF-8"
LC_NUMERIC="en_US.UTF-8"
LC_TIME="en_US.UTF-8"
LC_COLLATE="en_US.UTF-8"
LC_MONETARY="en_US.UTF-8"
LC_MESSAGES="en_US.UTF-8"
LC_PAPER="en_US.UTF-8"
LC_NAME="en_US.UTF-8"
LC_ADDRESS="en_US.UTF-8"
LC_TELEPHONE="en_US.UTF-8"
LC_MEASUREMENT="en_US.UTF-8"
LC_IDENTIFICATION="en_US.UTF-8"
LC_ALL=en_US.UTF-8
```

使用 `cat /etc/locale.gen` 检查 locale 配置文件，确保文件中包含以下行，并且没有被注释：

```
en_US.UTF-8 UTF-8
```

如果被注释掉了，则使用编辑器编辑取消它的注释。然后使用命令 `locale-gen` 生成缺失的 locale 数据。运行后，应该会看到类似以下输出：

```
Generating locales (this might take a while)...
  en_US.UTF-8... done
Generation complete.
```

为了确保设置生效，重新运行配置工具 `dpkg-reconfigure locales`，在弹出的界面中，选择 en_US.UTF-8 (用空格键选中)，然后确认。
