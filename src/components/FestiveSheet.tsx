import { t } from '../i18n'
import type { Festive } from '../festive'
import { picksFor } from '../festivePicks'
import { PicksSheet, type SheetProps } from './FestivePicks'

type Props = Omit<SheetProps, 'emoji' | 'eyebrow' | 'title' | 'intro' | 'picks' | 'focus' | 'noteFor'> & { festive: Festive }

// Its own file so the hand-picked titles (a large list) only download when someone opens the festive card
/** Behind the festive card: a hand-picked selection of movies and shows for the day. */
export function FestivePicks({ festive, ...rest }: Props) {
  const name = t(festive.name)
  return (
    <PicksSheet
      {...rest}
      emoji={festive.emoji}
      eyebrow={name}
      title={t('{name} picks', { name })}
      intro={t('We picked a few movies and shows for the occasion. Tap a poster to watch the trailer.')}
      picks={picksFor(festive.id)}
    />
  )
}

