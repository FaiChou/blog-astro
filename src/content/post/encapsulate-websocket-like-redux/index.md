---
title: "像 Redux 一样封装一个 websocket"
description: "像 Redux 一样封装一个 websocket"
publishDate: "2020-01-19"
tags: ["dev", "javascript"]
---

```javascript
const WS_URL = 'ws://demo.com/ws'
export class WSConnection {
  constructor(liveId) {
    this.connection = new WebSocket(WS_URL)
    this.connected = false
    this.listeners = []
    this.connection.onopen = () => {
      console.log('[ws] connection established!')
      this.connected = true
      this.connection.send("HEATBEAT")
    }
    this.connection.onmessage = e => {
      // console.log('[ws] receive:', e.data)
      this.listeners.forEach(listener => listener(e))
    }
    this.connection.onerror = e => {
      this.connected = false
      console.log('[ws] error:', e.message)
    }
    this.connection.onclose = e => {
      this.connected = false
      console.log('[ws] close:', e.code, e.reason)
    }
  }
  stop() {
    if (this.connected) {
      this.listeners = []
      this.connection.close()
    }
  }
  send(msg) {
    if (this.connected) {
      this.connection.send(msg)
      console.log('[ws] send message:', msg)
    }
  }
  listen(listener) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }
}
```

将 websocket 封装一下, 比较符合 OO 的哲学, 并且可以达到与业务代码抽离的好处, 在业务代码中使用:

```javascript
class extends React.Component {
  connection = new WSConnection('DEMO_ID')
  componentDidMount() {
    this.connection.listen(this.handleMessage)
  }
  componentWillUnmount() {
    this.connection.stop()
  }
  handleMessage = e => {
    // TODO
  }
  handleSendBarrage = message => {
    // construct a string action
    this.connection.send(barrageAction(message))
  }
}
```

这里对 WSConnection 的封装, 是借鉴 Redux 核心代码:

```javascript
function createStore(reducer) {
  let state = null
  let listeners = []

  const getState = () => state
  const subscribe = listener => {
    listeners.push(listener)
    return () => {
      listeners = listeners.filter(l => l !== listener)
    }
  }
  const dispatch = action => {
    state = reducer(state, action)
    listeners.forEach(listener => listener())
  }
  dispatch(null)
  return {
    getState,
    dispatch,
    subscribe
  }
}
```

这里的 `subscribe` 和 `dispatch` 与封装的 `listen` 和 `send` 是不是很像呢.

