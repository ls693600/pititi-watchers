// What changed, in the family's words. Newest first: Home shows the top one once after each update,
// Settings → What's new lists them all. Add an entry with every release the family would notice.

export interface ReleaseNote {
  /** Unique per release (date is enough) */
  id: string
  en: string[]
  pt: string[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    id: '2026-10-28',
    en: [
      'Picks of the week on Home: the most popular movies and series right now, rated 7 or more. Touch to stop it, tap a poster for the trailer.',
      'What you already watched gets a ✓; what\'s on a list gets 🔖.',
    ],
    pt: [
      'Destaques da semana no Início: os filmes e séries mais populares do momento, com nota 7 ou mais. Toque para parar, toque no pôster para ver o trailer.',
      'O que você já viu ganha ✓; o que está numa lista ganha 🔖.',
    ],
  },
  {
    id: '2026-10-27',
    en: [
      'New themed days from Canada and Brazil: Thanksgiving, Canada Day, Dia das Crianças, 7 de Setembro, Father\'s Day and more, each with its own movie and show picks.',
      'Each theme says whose holiday it is: 🇨🇦 or 🇧🇷.',
    ],
    pt: [
      'Novas datas comemorativas do Canadá e do Brasil: Ação de Graças, Dia do Canadá, Dia das Crianças, 7 de Setembro, Dia dos Pais e mais, cada uma com sua seleção de filmes e séries.',
      'Cada tema mostra de qual país é o feriado: 🇨🇦 ou 🇧🇷.',
    ],
  },
  {
    id: '2026-10-26b',
    en: [
      '"Logged twice" no longer shows up when another family logs the same show, so Merge works again.',
      '"Move to (month)" now saves right away. No need to scroll down and tap Save.',
    ],
    pt: [
      'O aviso "registrada duas vezes" não aparece mais quando outra família registra a mesma série, e o Juntar voltou a funcionar.',
      '"Mover para (mês)" agora salva na hora. Não precisa rolar a tela e tocar em Salvar.',
    ],
  },
  {
    id: '2026-10-26',
    en: [
      'Home shows your month as Together, or one person alone: the numbers add up.',
      'A show with several seasons is one poster: tap it to see each season.',
      'You get a "What\'s new" note like this one after every update.',
    ],
    pt: [
      'O Início mostra o mês Juntos ou de cada um sozinho: os números batem.',
      'Uma série com várias temporadas é um pôster só: toque para ver cada temporada.',
      'Depois de cada atualização aparece um aviso de novidades como este.',
    ],
  },
  {
    id: '2026-10-25',
    en: [
      'Ratings go from 1 to 10, like IMDb. Old ratings were doubled (4★ is now 8).',
      'One rating per show, not per season. Change it anytime.',
      'Halloween: tap the banner on Home for our movie and show picks.',
      'Family chat sits on Home, with new messages counted.',
    ],
    pt: [
      'As notas vão de 1 a 10, como no IMDb. As antigas foram dobradas (4★ virou 8).',
      'Uma nota por série, não por temporada. Mude quando quiser.',
      'Halloween: toque no banner do Início para ver nossa seleção de filmes e séries.',
      'O chat da família fica no Início, com as mensagens novas contadas.',
    ],
  },
]
