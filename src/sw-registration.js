import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh()
  {
    if(confirm('มีรุ่นใหม่ กรุณาเปิดโปรแกรมอีกครั้ง'))
      {
        updateSW(true)
      }
  },
  onOfflineReady()
  {
    console.log('App ready to work Offline')
  },
})