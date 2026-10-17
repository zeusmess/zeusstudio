import { useApp } from '../app/appStore'
import { Screen, ScreenHeader } from '../components/Screen'

export default function AchievementsScreen() {
  const go = useApp((s) => s.go)
  return (
    <Screen>
      <ScreenHeader title="AchievementsScreen" onBack={() => go('MENU')} />
    </Screen>
  )
}
