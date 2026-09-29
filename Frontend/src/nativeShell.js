import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

export const isNativeApp = () => Capacitor.isNativePlatform()

export const initNativeShell = async () => {
  if (!isNativeApp()) {
    return
  }

  try {
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setBackgroundColor({ color: '#6d3557' })
    await StatusBar.setStyle({ style: Style.Dark })
  } catch {
    // StatusBar is unavailable in some WebView previews.
  }

  try {
    await SplashScreen.hide()
  } catch {
    // SplashScreen plugin is a no-op in the browser.
  }

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) {
      window.history.back()
      return
    }
    App.exitApp()
  })
}
