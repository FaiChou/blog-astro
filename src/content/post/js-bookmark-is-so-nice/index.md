---
title: "js标签屡试不爽"
publishDate: "2020-10-011"
description: "js标签屡试不爽"
tags: ["javascript", "dev"]

---

Tampermonkey 适合自动执行的脚本, 比如页面加载完成后, 执行一段 js 代码, 功能强大. 但并不是所有场景都适合用油猴脚本, 比如需要手动出发的时机. 当然也可以用油猴脚本写一个按钮 fix 到页面中, 点击按钮再出执行那段核心程序.

但使用 **js标签** 会更加方便, 什么是 **js标签**? 它是一行程序, 由 `javascript:` 开始, 将代码压缩成一行, 放到冒号后面, 保存成书签! 使用时候点击它就可以执行这段代码.

比如以下代码

```javascript
function start() {
  var all = document.querySelectorAll('div.unit-detail-spec-operator');
  all.forEach(each => {
    var imgObjString = each.getAttribute('data-imgs');
    var imgConfigString = each.getAttribute('data-unit-config');
    // in case of null
    if (imgObjString) {
      var imgObj = JSON.parse(imgObjString);
      var imgConfigObj = JSON.parse(imgConfigString);
      var imgLink = imgObj.original;
      var imgName = imgConfigObj.name;
      downloadImage(imgLink, imgName);
    }
  });
}

function downloadImage(link, name) {
  var p = document.createElement('p');
  var t = document.createTextNode(name);
  var a = document.createElement('a');
  a.href = link;
  a.download = name;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.appendChild(t);
  p.appendChild(a);
  document.body.insertBefore(p, document.body.firstElementChild);
}

start();
```

经过 uglify (网上很多工具, 直接搜 uglifyjs online), 前面再添上 `javascript:` 保存成书签内容: 

```
javascript:function start(){document.querySelectorAll("div.unit-detail-spec-operator").forEach(e=>{var t=e.getAttribute("data-imgs"),a=e.getAttribute("data-unit-config");if(t){var r=JSON.parse(t),n=JSON.parse(a);downloadImage(r.original,n.name)}})}function downloadImage(e,t){var a=document.createElement("p"),r=document.createTextNode(t),n=document.createElement("a");n.href=e,n.download=t,n.target="_blank",n.rel="noopener noreferrer",n.appendChild(r),a.appendChild(n),document.body.insertBefore(a,document.body.firstElementChild)}start();
```

这段代码的功能是在 1688 网站上, 将所有的单品图片原图抓下来, 便于下载.

下面是我经常使用的 js书签:

### Shopify 打印时隐藏金额等数据

```
javascript:function hideElementByClassName(e){var a=document.getElementsByClassName(e);Array.from(a).forEach(hideElement)}function hideElement(e){e.classList.add("hide-when-printing")}function removeFirstNodeValueByClassName(e){var a=document.getElementsByClassName(e);Array.from(a).forEach(e=>{e.firstChild.nodeValue=""})}hideElementByClassName("order-details__line-item-total-price"),hideElementByClassName("order-section__timeline"),hideElementByClassName("order-details__summary__paid_by_customer"),hideElementByClassName("order-details-summary-table"),removeFirstNodeValueByClassName("order-details__price-by-quantity show-when-printing");
```

### 给网页内所有元素添加随机颜色外框线

```
javascript:[...document.querySelectorAll('*')].forEach(i => { let rand = (~~(Math.random() * 0xFFFFFF)).toString(16); rand = '#' + ('00000' + rand).slice(-6); i.style.outline = '1px solid ' + rand; });
```

### 解除网页禁止复制的限制

```
javascript:window.oncontextmenu=document.oncontextmenu=document.oncopy=null; [...document.querySelectorAll('body')].forEach(dom => dom.outerHTML = dom.outerHTML); [...document.querySelectorAll('body, body *')].forEach(dom => {['onselect', 'onselectstart', 'onselectend', 'ondragstart', 'ondragend', 'oncontextmenu', 'oncopy'].forEach(ev => dom.removeAttribute(ev)); dom.style['user-select']='auto';});
```

### 密码输入框明文显示

```
javascript:[...document.querySelectorAll('input[type=password]')].forEach(i => i.type = 'text');
```

### 解析当前页面中所有百度网盘链接，并免登录下载

```
javascript:(() => { if(document.querySelector('#bdp_hack')) return; var body = document.body; var regex = /pan\.baidu\.com\/s\/[a-zA-Z0-9_\-]{23}[\s\S]{0,18}?[码|碼][\W]{0,3}[a-z0-9]{4}/g; var arr = (body.innerText.match(regex) || []).concat(body.innerHTML.match(regex) || []).map(i => i.slice(0, 39) + i.slice(-4)); arr = [...new Set(arr)]; if(!arr.length) return alert('当前网页未检测到百度网盘链接'); var $ce = document.createElement.bind(document); var style = $ce('style'); style.innerText = '#bdp_hack { position: fixed; width: 60vw; height: 40vh; top: 0; bottom: 0; left: 0; right: 0; margin: auto auto; background: rgba(255,255,255,0.95); border-radius: 6px; padding: 60px 0 40px; box-shadow: 0 0 10px #ccc; font-size: 16px; overflow-y: auto; } #bdp_hack table { width: 54vw; margin: 0 auto; } #bdp_hack th, #bdp_hack td { text-align: center; height: 2em; } #bdp_hack > div { position: absolute; top: 2px; right: 14px; font-size: 24px; cursor: pointer; }'; var div = $ce('div'); div.innerText = '×'; div.onclick = function(){ var box = document.querySelector('#bdp_hack'); body.removeChild(box); }; var table = $ce('table'); table.border = '1'; var trH = $ce('tr'); var th1 = $ce('th'), th2 = $ce('th'), th3 = $ce('th'); th1.innerText = '百度网盘链接'; trH.appendChild(th1); th2.innerText = '提取码'; trH.appendChild(th2); th3.innerText = '免登录下载'; trH.appendChild(th3); table.appendChild(trH); arr.forEach(str => { var share = str.slice(16, 39); var pwd = str.slice(-4); var url = `http://pan.naifei.cc/?share=${share}&pwd=${pwd}`; var tr = $ce('tr'), td1 = $ce('td'), td2 = $ce('td'), td3 = $ce('td'), a = $ce('a'); td1.innerText = 'https://' + str.slice(0, 39); td2.innerText = pwd; a.innerText = '点此访问'; a.target="_blank"; a.href = url; td3.appendChild(a); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); table.appendChild(tr) }); var con = $ce('div'); con.id = "bdp_hack"; con.appendChild(style); con.appendChild(table); con.appendChild(div); body.append(con) })();
```


只要会写 js, 那么可以通过这方法开发好多功能. 屡试不爽.
