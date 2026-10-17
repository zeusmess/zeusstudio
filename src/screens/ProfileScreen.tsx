import { useApp } from '../app/appStore'
import { Screen, ScreenHeader } from '../components/Screen'

export default function ProfileScreen() {
  const go = useApp((s) => s.go)
  return (
    <Screen>
      <ScreenHeader title="ProfileScreen" onBack={() => go('MENU')} />
    </Screen>
  )
}
