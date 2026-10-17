import { useApp } from '../../app/appStore'
import { Button } from '../../components/Button'
import { useI18n } from '../../locales/i18n'

export function MatchResults() {
  const { t } = useI18n()
  const go = useApp((s) => s.go)
  return (
    <div role="dialog" aria-modal="true">
      <Button onClick={() => go('MENU')}>{t('match.mainMenu')}</Button>
    </div>
  )
}
