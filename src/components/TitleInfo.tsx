import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { airLabel, familyWatched, householdLabel, showStatusLabel } from '../logic'
import { getMovie, type MovieInfo } from '../movies'
import { bigPoster, getSeasons, getShowInfoCached, type ShowInfo } from '../tvmaze'
import type { Household, Person, Title, Watch } from '../types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { PosterFill } from './Poster'
import { TrailerButton } from './TrailerSheet'

type State =
  | { s: 'loading' }
  | { s: 'error' }
  | { s: 'tv'; info: ShowInfo; seasons: number | null }
  | { s: 'movie'; info: MovieInfo }

interface Props {
  title: Title
  /** Everything the family circle logged: "Fernando & Lara watched it" */
  watches: Watch[]
  households: Household[]
  people: Person[]
  me: Person | undefined
  /** Under the title: who added it, votes */
  byline?: React.ReactNode
}

/** A title's card in a sheet: big poster, facts, trailer, where to watch, synopsis, next episode, and the family's verdict. */
export function TitleInfo({ title, watches, households, people, me, byline }: Props) {
  const [state, setState] = useState<State>({ s: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [more, setMore] = useState(false)

  useEffect(() => {
    let alive = true
    const load =
      title.kind === 'movie'
        ? getMovie(title.extId).then((info): State => ({ s: 'movie', info }))
        : Promise.all([getShowInfoCached(title.extId), getSeasons(title.extId).catch(() => null)]).then(
            ([info, seasons]): State => ({ s: 'tv', info, seasons: seasons ? seasons.filter((x) => x.aired).length || seasons.length : null }),
          )
    load.then((st) => alive && setState(st)).catch(() => alive && setState({ s: 'error' }))
    return () => {
      alive = false
    }
  }, [title.kind, title.extId, attempt])

  const family = familyWatched(watches, title)
  const rating = state.s === 'tv' || state.s === 'movie' ? state.info.rating : null
  const runtime = state.s === 'movie' ? state.info.runtime : state.s === 'tv' ? state.info.runtime : title.runtime
  const synopsis = state.s === 'movie' ? state.info.overview : state.s === 'tv' ? state.info.summary : null

  return (
    <div className="tinfo">
      <div className="tinfo-hero">
        <div className="tinfo-poster">
          <PosterFill src={bigPoster(title.poster)} name={title.title} />
        </div>
        <div className="tinfo-head">
          <p className="label-sm">
            {title.kind === 'movie' ? t('Movie') : t('TV show')}
            {title.year ? ` · ${title.year}` : ''}
          </p>
          <h2 className="sheet-title">{title.title}</h2>
          {title.genres.length > 0 && <p className="tinfo-genres">{title.genres.slice(0, 3).map((g) => t(g)).join(' · ')}</p>}
          {byline}
          <TrailerButton kind={title.kind} extId={title.extId} title={title.title} year={title.year} />
        </div>
      </div>

      {state.s === 'loading' && (
        <div className="tinfo-skel" aria-busy="true" aria-label={t('Loading')}>
          <span style={{ width: '60%' }} />
          <span style={{ width: '100%' }} />
          <span style={{ width: '85%' }} />
        </div>
      )}

      {state.s === 'error' && (
        <div className="tinfo-error" role="status">
          <span>{t("Couldn't load the details. Check your connection.")}</span>
          <button type="button" className="btn sm ghost-dark" onClick={() => (setState({ s: 'loading' }), setAttempt((a) => a + 1))}>
            {t('Try again')}
          </button>
        </div>
      )}

      {(state.s === 'tv' || state.s === 'movie') && (
        <>
          <div className="meta-pills">
            {rating != null && (
              <span>
                <b className="gold">★</b> {rating.toFixed(1)}
              </span>
            )}
            {state.s === 'tv' && state.info.status && <span>{showStatusLabel(state.info.status)}</span>}
            {state.s === 'tv' && state.seasons != null && state.seasons > 0 && (
              <span>{state.seasons === 1 ? t('{n} season', { n: 1 }) : t('{n} seasons', { n: state.seasons })}</span>
            )}
            {runtime != null &&
              (state.s === 'movie' ? <span>{Math.floor(runtime / 60)}h {runtime % 60}m</span> : <span>~{runtime} min</span>)}
          </div>

          {state.s === 'movie' ? (
            <a className="where" href={state.info.link} target="_blank" rel="noopener noreferrer">
              <span className="where-icon" aria-hidden="true">
                <Icon name="play" size={18} stroke={2.2} />
              </span>
              <span className="where-text">
                <small>{t('Where to watch')}</small>
                <b>
                  {state.info.providers.length
                    ? state.info.providers.map((p) => (p.how === 'rent' ? `${p.name} (${t('rent')})` : p.name)).join(' · ')
                    : t('Not streaming near you right now')}
                </b>
              </span>
              <span className="where-go">
                {t('Open')} <Icon name="right" size={14} stroke={2.6} />
              </span>
            </a>
          ) : (
            state.info.home && (
              <a
                className={`where ${state.info.officialSite ? '' : 'static'}`}
                href={state.info.officialSite ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => !state.info.officialSite && e.preventDefault()}
              >
                <span className="where-icon" aria-hidden="true">
                  <Icon name={state.info.home.kind === 'stream' ? 'play' : 'tv'} size={18} stroke={2.2} />
                </span>
                <span className="where-text">
                  <small>{t('Where to watch')}</small>
                  <b>
                    {state.info.home.kind === 'stream' ? t('Streams on {name}', { name: state.info.home.name }) : t('Airs on {name}', { name: state.info.home.name })}
                  </b>
                </span>
                {state.info.officialSite && (
                  <span className="where-go">
                    {t('Open')} <Icon name="right" size={14} stroke={2.6} />
                  </span>
                )}
              </a>
            )
          )}

          {synopsis && (
            <div>
              <p className={`synopsis ${more ? 'open' : ''}`} id="tinfo-synopsis">
                {synopsis}
              </p>
              {synopsis.length > 160 && (
                <button type="button" className="link-btn tinfo-more" aria-expanded={more} aria-controls="tinfo-synopsis" onClick={() => setMore(!more)}>
                  {more ? t('Show less') : t('Read more')}
                </button>
              )}
            </div>
          )}

          {state.s === 'tv' && state.info.nextEpisode && (
            <div className="next-air">
              <span className="next-air-icon">
                <Icon name="calendar" size={20} />
              </span>
              <div>
                <b>{t('Next episode: {date}', { date: airLabel(state.info.nextEpisode.airdate) })}</b>
                <p className="muted">
                  {t('S{season} E{episode}', { season: state.info.nextEpisode.season, episode: state.info.nextEpisode.number })}
                  {state.info.nextEpisode.name ? ` · ${state.info.nextEpisode.name}` : ''}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {family.length > 0 && (
        <section className="tinfo-family" aria-label={t('In the family')}>
          <p className="label-sm">{t('In the family')}</p>
          <ul>
            {family.map((f) => (
              <li key={f.householdId ?? 'none'}>
                <span className="stack" aria-hidden="true">
                  {f.watchedBy.slice(0, 3).map((id) => (
                    <Avatar key={id} people={people} id={id} size={22} />
                  ))}
                </span>
                <span className="tinfo-fam-text">
                  <b>{f.householdId === me?.householdId ? t('You') : householdLabel(households.find((h) => h.id === f.householdId), people)}</b>
                  <span className="muted">
                    {f.status === 'watching'
                      ? title.kind === 'movie'
                        ? t('watching')
                        : t('watching season {n}', { n: f.season })
                      : title.kind === 'movie'
                        ? t('watched it')
                        : t('watched up to season {n}', { n: f.season })}
                  </span>
                </span>
                {f.rating != null ? (
                  <span className="tinfo-score" aria-label={t('rated {score} out of 10', { score: f.rating.toFixed(1) })}>
                    <b className="gold">★</b> {f.rating.toFixed(1)}
                  </span>
                ) : (
                  <span className="muted small">{t('Not rated yet')}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
