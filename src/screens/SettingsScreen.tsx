import { useApp } from '../app/appStore'
import { Screen, ScreenHeader } from '../components/Screen'

export default function SettingsScreen() {
  const go = useApp((s) => s.go)
  return (
    <Screen>
      <ScreenHeader title="SettingsScreen" onBack={() => go('MENU')} />
    </Screen>
  )
}
