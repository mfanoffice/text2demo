/**
 * 演示动画工作台 · 客户端入口（已构建好的单文件模块）
 *
 * 业务面板复用工作台原有的整套界面：面板里是一个同源 iframe，指向本插件服务端
 * 接口 /api/deck-workbench/app。这样既不改动原有界面，又让它拿到同源环境
 * （localStorage 可用、出网请求可以走本机转发绕开跨域）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-deck-workbench',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const APP = '/api/deck-workbench/app'
    const STYLE_ID = 'dsh-deck-workbench-style'
    const CSS = [
      '.dshDeckWb{display:flex;flex:1 1 auto;flex-direction:column;width:100%;height:100%;min-height:280px;min-width:0;box-sizing:border-box}',
      '.dshDeckWb>iframe{flex:1 1 auto;width:100%;height:100%;min-height:0;border:0;background:#f2f2f7;display:block}'
    ].join('')

    function BusinessPanel(props) {
      const entry = props.entry
      const title = (entry && entry.title) || '演示动画工作台'
      React.useEffect(() => {
        if (document.getElementById(STYLE_ID)) return
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = CSS
        document.head.appendChild(style)
      }, [])
      return h('div', { className: 'dshDeckWb' },
        h('iframe', { src: APP, title, allow: 'clipboard-write' })
      )
    }

    function apply(ctx) {
      ctx.effect(() => ctx.desktopWorkbenches.register({
        title: '演示动画工作台',
        repository: 'https://github.com/dsh-local/dsh-deck-workbench',
        description: '把一段口播文案变成可翻页、可逐步入场的演示动画，并生成视频标题、标签与三比例封面。',
        panelTitle: '演示动画工作台',
        category: '视频创作',
        // 宿主用它决定面板内边距与高度链：embedded=true 时 .dshWbBusiness 变成
        // padding:0 + flex 列，业务组件因此能拿到 flex:1/min-height:0 撑满面板；
        // 不设它，面板是可滚动块级容器，全高的业务界面（iframe）会塌成 0 高度。
        embedded: true,
        layout: { businessSide: 'right', businessWidth: 0.7 }
      }, BusinessPanel), 'deck-workbench: register')
    }

    return { apply, inject: ['desktopWorkbenches'] }
  }
})
