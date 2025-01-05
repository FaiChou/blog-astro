---
title: "Server Setup"
publishDate: "2024-12-21"
description: "server setup"
tags: ["linux", "devops"]
---

## 1. 修改主机名

`hostnamectl set-hostname 新的主机名`

vi /etc/hosts # 将 127.0.1.1 旧主机名 改为 127.0.1.1 新主机名

## 2. 更改镜像源

```bash
# /etc/apt/sources.list

deb http://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm main contrib non-free
deb-src http://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm main contrib non-free

deb http://security.debian.org/debian-security bookworm-security main contrib non-free
deb-src http://security.debian.org/debian-security bookworm-security main contrib non-free

deb http://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-updates main contrib non-free non-free-firmware
deb-src http://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-updates main contrib non-free non-free-firmware
```

然后执行 `apt update` 和 `apt upgrade`。

## 3. 配置 ssh

添加 ssh public keys 到 /root/.ssh/authorized_keys


```bash
# /etc/ssh/sshd_config
PubkeyAuthentication yes
PermitRootLogin prohibit-password
```

重启 `systemctl restart sshd`

## 4. 配置 zsh & oh-my-zsh

```bash
apt update
apt install -y zsh
apt install -y curl
apt install -y git
apt install -y vim
chsh -s $(which zsh)
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
git clone https://github.com/zsh-users/zsh-autosuggestions ~/.oh-my-zsh/custom/plugins/zsh-autosuggestions
```

## 5. 配置 .zshrc

```bash
# .zshrc
# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:$HOME/.local/bin:/usr/local/bin:$PATH

export ZSH="$HOME/.oh-my-zsh"
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
ZSH_THEME="aussiegeek"
plugins=(git z zsh-autosuggestions)
source $ZSH/oh-my-zsh.sh

export LANG=en_US.UTF-8
export LANGUAGE="en_US"
export LC_ALL=en_US.UTF-8
export LS_OPTIONS='--color=auto'
# Preferred editor for local and remote sessions
# if [[ -n $SSH_CONNECTION ]]; then
#   export EDITOR='vim'
# else
#   export EDITOR='nvim'
# fi
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

安装 tmux: `apt install -y tmux`

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

## 8. 安装常用工具

```shell
#check_tools.sh
#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

tools=(
  bash coreutils findutils tar gzip bzip2 xz-utils
  iproute2 net-tools curl wget openssh-client traceroute
  apt dpkg gnupg2
  mount util-linux parted dosfstools e2fsprogs
  rsyslog journalctl dmesg lsof strace
  zip unzip p7zip-full
  nano vim less more
  cron at ntpdate
  passwd adduser sudo
)

echo -e "Checking installed tools...\n"
for tool in "${tools[@]}"; do
  if command -v "$tool" >/dev/null 2>&1; then
    echo -e "${GREEN}$tool: Installed${NC}"
  else
    echo -e "${RED}$tool: Not Installed${NC}"
  fi
done
```

执行上面的命令，查看哪些未安装，然后补充安装一下。

## 9. 推荐几个好用工具

```bash
apt install -y btop
apt install -y vnstat
apt install -y duf
```

以及 nezha agent, [yazi](https://yazi-rs.github.io/), [tailscale](https://tailscale.com/kb/1174/install-debian-bookworm)。

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
