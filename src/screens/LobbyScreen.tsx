import { useApp } from '../app/appStore'
import { Screen, ScreenHeader } from '../components/Screen'

export default function LobbyScreen() {
  const go = useApp((s) => s.go)
  return (
    <Screen>
      <ScreenHeader title="LobbyScreen" onBack={() => go('MENU')} />
    </Screen>
  )
}
