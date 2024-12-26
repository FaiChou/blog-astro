---
title: "Image With Touchable Area"
publishDate: "2020-03-24"
---

做前端开发经常会遇到公告图预览图等，需求一般是图片中有几个点击热区，点击热区跳转不同位置。

一般的做法是固定图片宽度，在相应热区位置 `position: absolute` 几块 button, 经过研究，发现一种更直接并且是被推荐的做法: 使用 `area` 标签。

取 https://www.bilibili.com/blackboard/activity-BV-PC.html 这页面上中间一块为例来演示 demo :

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Image With Area Touchable</title>
<style>
  body {
    margin: 0;
    padding: 0;
  }
  #pc-container {
    min-width: 1280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background-color: #67a33f;
  }
  #pc-container img {
    width: 1280px;
  }
</style>
  </head>
  <body>
    <section id="pc-container">
      <img usemap="#bv" src="bv_w1920_h2173.jpg" alt="bv" >
      <map name="bv">
        <area shape="rect" coords="414,500,600,548" href="#av" alt="av">
        <area shape="rect" coords="685,500,870,548" href="#bv" alt="av">
      </map>
    </section>
  </body>
</html>
```

![preview](preview.png)

ps. 使用键盘的 Tab 键，可以 highlight 热点区域。

具体的 area 使用方法可以 [check 这个链接](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/area)。

Demo 中做法固定了图片的宽度和浏览器的 `min-width`, 为提升用户体验，使用 flex 布局把图片居中摆放，并且提取了图片的绿色作为背景颜色。


这种方法一个比较明显的缺点是图片不够灵活，不如使用 `background-image` 方式定义的背景图，但是 `background-image` 没法使用 area 来定义点击热区，两者取其一，可以对比 b 站的实现方法，他们的实现方案采用了 `background-image`。

