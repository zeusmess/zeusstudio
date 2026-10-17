import { useApp } from '../app/appStore'
import { Screen, ScreenHeader } from '../components/Screen'

export default function LevelSelectScreen() {
  const go = useApp((s) => s.go)
  return (
    <Screen>
      <ScreenHeader title="LevelSelectScreen" onBack={() => go('MENU')} />
    </Screen>
  )
}
