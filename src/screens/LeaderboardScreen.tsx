import { useApp } from '../app/appStore'
import { Screen, ScreenHeader } from '../components/Screen'

export default function LeaderboardScreen() {
  const go = useApp((s) => s.go)
  return (
    <Screen>
      <ScreenHeader title="LeaderboardScreen" onBack={() => go('MENU')} />
    </Screen>
  )
}
