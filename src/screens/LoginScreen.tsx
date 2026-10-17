import { useApp } from '../app/appStore'
import { Screen, ScreenHeader } from '../components/Screen'

export default function LoginScreen() {
  const go = useApp((s) => s.go)
  return (
    <Screen>
      <ScreenHeader title="LoginScreen" onBack={() => go('MENU')} />
    </Screen>
  )
}
