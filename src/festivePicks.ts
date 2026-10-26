// Hand-picked titles for each festive look (shown when you tap the festive card on Home).
// TV ids are TVmaze, movie ids are TMDB, like everywhere else. Generated once from TMDB + TVmaze; edit freely.
import type { FestiveId } from './festive'
import type { Title } from './types'

export interface FestivePick extends Title {
  /** Portuguese title (movies from TMDB; shows keep their usual name unless Brazil knows them by another) */
  titlePt: string
}

const PICKS: Record<Exclude<FestiveId, 'namorados'>, FestivePick[]> = {
  halloween: [
    { kind: 'movie', extId: 10439, title: 'Hocus Pocus', titlePt: 'Abracadabra', year: '1993', poster: 'https://image.tmdb.org/t/p/w342/by4D4Q9NlUjFSEUA1yrxq6ksXmk.jpg', genres: ['Fantasy', 'Comedy', 'Family'], runtime: 96, network: null },
    { kind: 'movie', extId: 917496, title: 'Beetlejuice Beetlejuice', titlePt: 'Os Fantasmas Ainda se Divertem: Beetlejuice Beetlejuice', year: '2024', poster: 'https://image.tmdb.org/t/p/w342/kKgQzkUCnQmeTPkyIwHly2t6ZFI.jpg', genres: ['Comedy', 'Fantasy'], runtime: 105, network: null },
    { kind: 'movie', extId: 14836, title: 'Coraline', titlePt: 'Coraline e o Mundo Secreto', year: '2009', poster: 'https://image.tmdb.org/t/p/w342/4jeFXQYytChdZYE9JYO7Un87IlW.jpg', genres: ['Animation', 'Family', 'Fantasy', 'Horror'], runtime: 100, network: null },
    { kind: 'movie', extId: 138843, title: 'The Conjuring', titlePt: 'Invocação do Mal', year: '2013', poster: 'https://image.tmdb.org/t/p/w342/wVYREutTvI2tmxr6ujrHT704wGF.jpg', genres: ['Horror', 'Thriller'], runtime: 112, network: null },
    { kind: 'movie', extId: 419430, title: 'Get Out', titlePt: 'Corra!', year: '2017', poster: 'https://image.tmdb.org/t/p/w342/tFXcEccSQMf3lfhfXKSU9iRBpa3.jpg', genres: ['Mystery', 'Thriller', 'Horror'], runtime: 104, network: null },
    { kind: 'movie', extId: 447332, title: 'A Quiet Place', titlePt: 'Um Lugar Silencioso', year: '2018', poster: 'https://image.tmdb.org/t/p/w342/nAU74GmpUk7t5iklEp3bufwDq4n.jpg', genres: ['Horror', 'Drama', 'Science-Fiction'], runtime: 91, network: null },
    { kind: 'movie', extId: 1008042, title: 'Talk to Me', titlePt: 'Fale Comigo', year: '2023', poster: 'https://image.tmdb.org/t/p/w342/kdPMUMJzyYAc4roD52qavX0nLIC.jpg', genres: ['Horror'], runtime: 95, network: null },
    { kind: 'tv', extId: 53647, title: 'Wednesday', titlePt: 'Wandinha', year: '2022', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/586/1466410.jpg', genres: ['Comedy', 'Mystery', 'Supernatural'], runtime: 54, network: 'Netflix' },
    { kind: 'tv', extId: 2993, title: 'Stranger Things', titlePt: 'Stranger Things', year: '2016', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/595/1489169.jpg', genres: ['Drama', 'Horror', 'Science-Fiction'], runtime: 65, network: 'Netflix' },
    { kind: 'tv', extId: 29191, title: 'The Haunting of Hill House', titlePt: 'A Maldição da Residência Hill', year: '2018', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/498/1246083.jpg', genres: ['Drama', 'Horror', 'Mystery'], runtime: 58, network: 'Netflix' },
    { kind: 'tv', extId: 42840, title: 'Midnight Mass', titlePt: 'Missa da Meia-Noite', year: '2021', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/354/885283.jpg', genres: ['Drama', 'Horror', 'Mystery'], runtime: 65, network: 'Netflix' },
  ],
  christmas: [
    { kind: 'movie', extId: 771, title: 'Home Alone', titlePt: 'Esqueceram de Mim', year: '1990', poster: 'https://image.tmdb.org/t/p/w342/onTSipZ8R3bliBdKfPtsDuHTdlL.jpg', genres: ['Comedy', 'Family'], runtime: 103, network: null },
    { kind: 'movie', extId: 508, title: 'Love Actually', titlePt: 'Simplesmente Amor', year: '2003', poster: 'https://image.tmdb.org/t/p/w342/7QPeVsr9rcFU9Gl90yg0gTOTpVv.jpg', genres: ['Comedy', 'Romance', 'Drama'], runtime: 135, network: null },
    { kind: 'movie', extId: 1581, title: 'The Holiday', titlePt: 'O Amor Não Tira Férias', year: '2006', poster: 'https://image.tmdb.org/t/p/w342/h1ITOpvJN3Tw4Sy60w2QTfYMvdd.jpg', genres: ['Comedy', 'Romance'], runtime: 136, network: null },
    { kind: 'movie', extId: 10719, title: 'Elf', titlePt: 'Um Duende em Nova York', year: '2003', poster: 'https://image.tmdb.org/t/p/w342/oOleziEempUPu96jkGs0Pj6tKxj.jpg', genres: ['Comedy', 'Family', 'Fantasy'], runtime: 97, network: null },
    { kind: 'movie', extId: 508965, title: 'Klaus', titlePt: 'Klaus', year: '2019', poster: 'https://image.tmdb.org/t/p/w342/q125RHUDgR4gjwh1QkfYuJLYkL.jpg', genres: ['Animation', 'Family', 'Comedy'], runtime: 97, network: null },
    { kind: 'movie', extId: 360920, title: 'The Grinch', titlePt: 'O Grinch', year: '2018', poster: 'https://image.tmdb.org/t/p/w342/Al7DMUp8bqUN4JwXVNxfJYyv5cH.jpg', genres: ['Animation', 'Comedy', 'Family', 'Fantasy'], runtime: 85, network: null },
    { kind: 'movie', extId: 5255, title: 'The Polar Express', titlePt: 'O Expresso Polar', year: '2004', poster: 'https://image.tmdb.org/t/p/w342/eOoCzH0MqeGr2taUZO4SwG416PF.jpg', genres: ['Adventure', 'Animation', 'Family', 'Fantasy'], runtime: 100, network: null },
    { kind: 'tv', extId: 44490, title: 'Dash & Lily', titlePt: 'Dash & Lily', year: '2020', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/277/692659.jpg', genres: ['Drama', 'Comedy', 'Romance'], runtime: 26, network: 'Netflix' },
    { kind: 'tv', extId: 60526, title: 'The Santa Clauses', titlePt: 'The Santa Clauses', year: '2022', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/477/1194725.jpg', genres: ['Comedy', 'Family', 'Fantasy'], runtime: 31, network: 'Disney+' },
    { kind: 'tv', extId: 43102, title: 'Hawkeye', titlePt: 'Gavião Arqueiro', year: '2021', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/383/959105.jpg', genres: ['Drama', 'Action', 'Adventure'], runtime: 48, network: 'Disney+' },
  ],
  newyear: [
    { kind: 'movie', extId: 639, title: 'When Harry Met Sally...', titlePt: 'Harry & Sally: Feitos um para o Outro', year: '1989', poster: 'https://image.tmdb.org/t/p/w342/rFOiFUhTMtDetqCGClC9PIgnC1P.jpg', genres: ['Comedy', 'Romance', 'Drama'], runtime: 96, network: null },
    { kind: 'movie', extId: 122906, title: 'About Time', titlePt: 'Questão de Tempo', year: '2013', poster: 'https://image.tmdb.org/t/p/w342/ls6zswrOZVhCXQBh96DlbnLBajM.jpg', genres: ['Drama', 'Romance', 'Fantasy'], runtime: 123, network: null },
    { kind: 'movie', extId: 587792, title: 'Palm Springs', titlePt: 'Palm Springs', year: '2020', poster: 'https://image.tmdb.org/t/p/w342/gnAfqiV7yO3Jq9IntTmwkcaICqc.jpg', genres: ['Comedy', 'Romance', 'Science-Fiction'], runtime: 90, network: null },
    { kind: 'movie', extId: 137, title: 'Groundhog Day', titlePt: 'Feitiço do Tempo', year: '1993', poster: 'https://image.tmdb.org/t/p/w342/gCgt1WARPZaXnq523ySQEUKinCs.jpg', genres: ['Romance', 'Fantasy', 'Comedy'], runtime: 101, network: null },
    { kind: 'movie', extId: 62838, title: 'New Year\'s Eve', titlePt: 'Noite de Ano Novo', year: '2011', poster: 'https://image.tmdb.org/t/p/w342/TroWD1BdcLEL7Ycqv4kkCRw7KJ.jpg', genres: ['Comedy', 'Romance'], runtime: 118, network: null },
    { kind: 'movie', extId: 116745, title: 'The Secret Life of Walter Mitty', titlePt: 'A Vida Secreta de Walter Mitty', year: '2013', poster: 'https://image.tmdb.org/t/p/w342/iAo1hlzsPV9XpYcLQp6Ud065tGO.jpg', genres: ['Adventure', 'Comedy', 'Drama', 'Fantasy'], runtime: 114, network: null },
    { kind: 'tv', extId: 39987, title: 'Russian Doll', titlePt: 'Boneca Russa', year: '2019', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/403/1009012.jpg', genres: ['Drama', 'Comedy'], runtime: 28, network: 'Netflix' },
    { kind: 'tv', extId: 44458, title: 'Ted Lasso', titlePt: 'Ted Lasso', year: '2020', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/634/1585930.jpg', genres: ['Drama', 'Comedy', 'Sports'], runtime: 43, network: 'Apple TV' },
    { kind: 'tv', extId: 1775, title: 'Schitt\'s Creek', titlePt: 'Schitt\'s Creek', year: '2015', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/279/697623.jpg', genres: ['Comedy'], runtime: 30, network: 'CBC' },
  ],
  valentines: [
    { kind: 'movie', extId: 11036, title: 'The Notebook', titlePt: 'Diário de uma Paixão', year: '2004', poster: 'https://image.tmdb.org/t/p/w342/rNzQyW4f8B8cQeg7Dgj3n6eT5k9.jpg', genres: ['Romance', 'Drama'], runtime: 123, network: null },
    { kind: 'movie', extId: 4348, title: 'Pride & Prejudice', titlePt: 'Orgulho e Preconceito', year: '2005', poster: 'https://image.tmdb.org/t/p/w342/o8UhmEbWPHmTUxP0lMuCoqNkbB3.jpg', genres: ['Drama', 'Romance'], runtime: 128, network: null },
    { kind: 'movie', extId: 313369, title: 'La La Land', titlePt: 'La La Land: Cantando Estações', year: '2016', poster: 'https://image.tmdb.org/t/p/w342/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', genres: ['Comedy', 'Drama', 'Romance'], runtime: 129, network: null },
    { kind: 'movie', extId: 455207, title: 'Crazy Rich Asians', titlePt: 'Podres de Ricos', year: '2018', poster: 'https://image.tmdb.org/t/p/w342/1XxL4LJ5WHdrcYcihEZUCgNCpAW.jpg', genres: ['Comedy', 'Romance'], runtime: 121, network: null },
    { kind: 'movie', extId: 666277, title: 'Past Lives', titlePt: 'Vidas Passadas', year: '2023', poster: 'https://image.tmdb.org/t/p/w342/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg', genres: ['Drama', 'Romance'], runtime: 106, network: null },
    { kind: 'movie', extId: 509, title: 'Notting Hill', titlePt: 'Um Lugar Chamado Notting Hill', year: '1999', poster: 'https://image.tmdb.org/t/p/w342/hHRIf2XHeQMbyRb3HUx19SF5Ujw.jpg', genres: ['Romance', 'Comedy'], runtime: 124, network: null },
    { kind: 'movie', extId: 76, title: 'Before Sunrise', titlePt: 'Antes do Amanhecer', year: '1995', poster: 'https://image.tmdb.org/t/p/w342/kf1Jb1c2JAOqjuzA3H4oDM263uB.jpg', genres: ['Drama', 'Romance'], runtime: 101, network: null },
    { kind: 'tv', extId: 42966, title: 'Bridgerton', titlePt: 'Bridgerton', year: '2020', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/614/1535959.jpg', genres: ['Drama', 'Romance'], runtime: 63, network: 'Netflix' },
    { kind: 'tv', extId: 42361, title: 'Normal People', titlePt: 'Normal People', year: '2020', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/249/623354.jpg', genres: ['Drama', 'Romance'], runtime: 28, network: 'BBC Three' },
    { kind: 'tv', extId: 53269, title: 'Heartstopper', titlePt: 'Heartstopper', year: '2022', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/632/1580747.jpg', genres: ['Drama', 'Comedy', 'Romance'], runtime: 34, network: 'Netflix' },
  ],
  stpatricks: [
    { kind: 'movie', extId: 674324, title: 'The Banshees of Inisherin', titlePt: 'Os Banshees de Inisherin', year: '2022', poster: 'https://image.tmdb.org/t/p/w342/4yFG6cSPaCaPhyJ1vtGOtMD1lgh.jpg', genres: ['Drama', 'Comedy'], runtime: 114, network: null },
    { kind: 'movie', extId: 6023, title: 'P.S. I Love You', titlePt: 'P.S. Eu Te Amo', year: '2007', poster: 'https://image.tmdb.org/t/p/w342/x6M9nlTpgpI4AOw0tMkOAVbhL5z.jpg', genres: ['Drama', 'Romance'], runtime: 126, network: null },
    { kind: 'movie', extId: 25195, title: 'Leap Year', titlePt: 'Casa Comigo?', year: '2010', poster: 'https://image.tmdb.org/t/p/w342/i86hMi5iEF3WnYLCaGHdT5FPdYg.jpg', genres: ['Romance', 'Comedy'], runtime: 100, network: null },
    { kind: 'movie', extId: 167073, title: 'Brooklyn', titlePt: 'Brooklin: Um Amor Sem Fronteiras', year: '2015', poster: 'https://image.tmdb.org/t/p/w342/cs7W8j5lI7qzRW6tKSj9p1Q0Ze7.jpg', genres: ['Drama', 'History', 'Romance'], runtime: 111, network: null },
    { kind: 'movie', extId: 777270, title: 'Belfast', titlePt: 'Belfast', year: '2021', poster: 'https://image.tmdb.org/t/p/w342/3mInLZyPOVLsZRsBwNHi3UJXXnm.jpg', genres: ['Drama', 'History'], runtime: 98, network: null },
    { kind: 'movie', extId: 369557, title: 'Sing Street', titlePt: 'Sing Street: Música e Sonho', year: '2016', poster: 'https://image.tmdb.org/t/p/w342/sUWpVlrvzU2SJbnVZqIeKulPKwk.jpg', genres: ['Romance', 'Drama', 'Music', 'Comedy'], runtime: 105, network: null },
    { kind: 'tv', extId: 33320, title: 'Derry Girls', titlePt: 'Derry Girls', year: '2018', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/402/1007479.jpg', genres: ['Comedy'], runtime: 31, network: 'Channel 4' },
    { kind: 'tv', extId: 61235, title: 'Bad Sisters', titlePt: 'Bad Sisters', year: '2022', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/540/1351090.jpg', genres: ['Drama', 'Comedy', 'Thriller'], runtime: 51, network: 'Apple TV' },
  ],
  easter: [
    { kind: 'movie', extId: 50359, title: 'Hop', titlePt: 'Hop: Rebelde Sem Páscoa', year: '2011', poster: 'https://image.tmdb.org/t/p/w342/2FrDmwXWjRE1zpNP288YncRt5RF.jpg', genres: ['Animation', 'Comedy', 'Family'], runtime: 95, network: null },
    { kind: 'movie', extId: 381719, title: 'Peter Rabbit', titlePt: 'Pedro Coelho', year: '2018', poster: 'https://image.tmdb.org/t/p/w342/lugOvdaNpbVGQK9TyMRDiUbLtY6.jpg', genres: ['Animation', 'Adventure', 'Family'], runtime: 93, network: null },
    { kind: 'movie', extId: 9837, title: 'The Prince of Egypt', titlePt: 'O Príncipe do Egito', year: '1998', poster: 'https://image.tmdb.org/t/p/w342/2xUjYwL6Ol7TLJPPKs7sYW5PWLX.jpg', genres: ['Adventure', 'Animation', 'Drama', 'Family'], runtime: 99, network: null },
    { kind: 'movie', extId: 7443, title: 'Chicken Run', titlePt: 'A Fuga das Galinhas', year: '2000', poster: 'https://image.tmdb.org/t/p/w342/8XgmIsbpVamdhwcNVsYzohFZTtT.jpg', genres: ['Animation', 'Comedy', 'Family'], runtime: 84, network: null },
    { kind: 'movie', extId: 118, title: 'Charlie and the Chocolate Factory', titlePt: 'A Fantástica Fábrica de Chocolate', year: '2005', poster: 'https://image.tmdb.org/t/p/w342/iKP6wg3c6COUe8gYutoGG7qcPnO.jpg', genres: ['Adventure', 'Comedy', 'Family', 'Fantasy'], runtime: 115, network: null },
    { kind: 'movie', extId: 787699, title: 'Wonka', titlePt: 'Wonka', year: '2023', poster: 'https://image.tmdb.org/t/p/w342/qhb1qOilapbapxWQn9jtRCMwXJF.jpg', genres: ['Comedy', 'Family', 'Fantasy'], runtime: 117, network: null },
    { kind: 'tv', extId: 47119, title: 'The Chosen', titlePt: 'The Chosen', year: '2017', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/646/1615872.jpg', genres: ['Drama', 'History'], runtime: 59, network: 'Prime Video' },
  ],
  carnaval: [
    { kind: 'movie', extId: 46195, title: 'Rio', titlePt: 'Rio', year: '2011', poster: 'https://image.tmdb.org/t/p/w342/4nJxhUknKV8Gqdhov8pU1YWDYfb.jpg', genres: ['Animation', 'Adventure', 'Comedy', 'Family'], runtime: 96, network: null },
    { kind: 'movie', extId: 172385, title: 'Rio 2', titlePt: 'Rio 2', year: '2014', poster: 'https://image.tmdb.org/t/p/w342/gVNTBrjxh2YRmQFjlaqrNbHVvrd.jpg', genres: ['Animation', 'Adventure', 'Comedy', 'Family'], runtime: 101, network: null },
    { kind: 'movie', extId: 40423, title: 'Black Orpheus', titlePt: 'Orfeu Negro', year: '1959', poster: 'https://image.tmdb.org/t/p/w342/fJWzdNRnfjcJuaZiKqaSURFV6Lg.jpg', genres: ['Drama', 'Romance'], runtime: 100, network: null },
    { kind: 'movie', extId: 11631, title: 'Mamma Mia!', titlePt: 'Mamma Mia!', year: '2008', poster: 'https://image.tmdb.org/t/p/w342/xYLiCWmAMHJubx5jNZ7HuXKjAbV.jpg', genres: ['Comedy', 'Romance'], runtime: 108, network: null },
    { kind: 'movie', extId: 316029, title: 'The Greatest Showman', titlePt: 'O Rei do Show', year: '2017', poster: 'https://image.tmdb.org/t/p/w342/b9CeobiihCx1uG1tpw8hXmpi7nm.jpg', genres: ['Drama'], runtime: 105, network: null },
    { kind: 'movie', extId: 568124, title: 'Encanto', titlePt: 'Encanto', year: '2021', poster: 'https://image.tmdb.org/t/p/w342/4j0PNHkMr5ax3IA8tjtxcmPU3QT.jpg', genres: ['Animation', 'Comedy', 'Family', 'Fantasy'], runtime: 102, network: null },
    { kind: 'tv', extId: 53040, title: 'Cidade Invisível', titlePt: 'Cidade Invisível', year: '2021', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/453/1133412.jpg', genres: ['Drama', 'Fantasy', 'Mystery'], runtime: 39, network: 'Netflix' },
  ],
  junina: [
    { kind: 'movie', extId: 40096, title: 'A Dog\'s Will', titlePt: 'O Auto da Compadecida', year: '2000', poster: 'https://image.tmdb.org/t/p/w342/z9Au9XtK0ARzkKGsZCzMkmKgMPf.jpg', genres: ['Comedy', 'Drama', 'Fantasy', 'Romance'], runtime: 104, network: null },
    { kind: 'movie', extId: 52345, title: 'Lisbela and the Prisoner', titlePt: 'Lisbela e o Prisioneiro', year: '2003', poster: 'https://image.tmdb.org/t/p/w342/raCdo5Hjpd3uXbpSd1JZ7tEyE31.jpg', genres: ['Comedy', 'Romance'], runtime: 106, network: null },
    { kind: 'movie', extId: 49367, title: 'Two Sons of Francisco', titlePt: '2 Filhos de Francisco', year: '2005', poster: 'https://image.tmdb.org/t/p/w342/ub8vYfI1zgW4WItWDQ5mT6q5tzQ.jpg', genres: ['Drama', 'History', 'Music'], runtime: 132, network: null },
    { kind: 'movie', extId: 568124, title: 'Encanto', titlePt: 'Encanto', year: '2021', poster: 'https://image.tmdb.org/t/p/w342/4j0PNHkMr5ax3IA8tjtxcmPU3QT.jpg', genres: ['Animation', 'Comedy', 'Family', 'Fantasy'], runtime: 102, network: null },
    { kind: 'movie', extId: 354912, title: 'Coco', titlePt: 'Viva: A Vida é Uma Festa', year: '2017', poster: 'https://image.tmdb.org/t/p/w342/6Ryitt95xrO8KXuqRGm1fUuNwqF.jpg', genres: ['Family', 'Animation', 'Music', 'Adventure'], runtime: 105, network: null },
    { kind: 'movie', extId: 666, title: 'Central Station', titlePt: 'Central do Brasil', year: '1998', poster: 'https://image.tmdb.org/t/p/w342/zJvp7XjQ2LhPbDVYhFXyucs40vR.jpg', genres: ['Drama'], runtime: 111, network: null },
    { kind: 'tv', extId: 63401, title: 'Pantanal', titlePt: 'Pantanal', year: '2022', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/418/1045258.jpg', genres: ['Drama', 'Romance'], runtime: 50, network: 'TV Globo' },
  ],
  mothers: [
    { kind: 'movie', extId: 11631, title: 'Mamma Mia!', titlePt: 'Mamma Mia!', year: '2008', poster: 'https://image.tmdb.org/t/p/w342/xYLiCWmAMHJubx5jNZ7HuXKjAbV.jpg', genres: ['Comedy', 'Romance'], runtime: 108, network: null },
    { kind: 'movie', extId: 391713, title: 'Lady Bird', titlePt: 'Lady Bird - A Hora de Voar', year: '2017', poster: 'https://image.tmdb.org/t/p/w342/gl66K7zRdtNYGrxyS2YDUP5ASZd.jpg', genres: ['Drama', 'Comedy'], runtime: 94, network: null },
    { kind: 'movie', extId: 331482, title: 'Little Women', titlePt: 'Adoráveis Mulheres', year: '2019', poster: 'https://image.tmdb.org/t/p/w342/yn5ihODtZ7ofn8pDYfxCmxh8AXI.jpg', genres: ['Drama', 'Romance'], runtime: 135, network: null },
    { kind: 'movie', extId: 545611, title: 'Everything Everywhere All at Once', titlePt: 'Tudo em Todo o Lugar ao Mesmo Tempo', year: '2022', poster: 'https://image.tmdb.org/t/p/w342/u68AjlvlutfEIcpmbYpKcdi09ut.jpg', genres: ['Action', 'Adventure', 'Science-Fiction'], runtime: 140, network: null },
    { kind: 'movie', extId: 10330, title: 'Freaky Friday', titlePt: 'Sexta-Feira Muito Louca', year: '2003', poster: 'https://image.tmdb.org/t/p/w342/y6kn3tUb4qrNZvV4TDIIjskZ9eV.jpg', genres: ['Comedy', 'Family', 'Fantasy'], runtime: 97, network: null },
    { kind: 'movie', extId: 310569, title: 'The Second Mother', titlePt: 'Que Horas Ela Volta?', year: '2015', poster: 'https://image.tmdb.org/t/p/w342/u1tDQun2iJAzersd94S8P47WEOL.jpg', genres: ['Drama'], runtime: 112, network: null },
    { kind: 'tv', extId: 525, title: 'Gilmore Girls', titlePt: 'Gilmore Girls', year: '2000', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/4/11308.jpg', genres: ['Drama', 'Comedy', 'Romance'], runtime: 60, network: 'The CW' },
    { kind: 'tv', extId: 17128, title: 'This Is Us', titlePt: 'This Is Us', year: '2016', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/401/1003345.jpg', genres: ['Drama', 'Comedy', 'Romance'], runtime: 60, network: 'NBC' },
    { kind: 'tv', extId: 47549, title: 'Ginny & Georgia', titlePt: 'Ginny & Georgia', year: '2021', poster: 'https://static.tvmaze.com/uploads/images/medium_portrait/570/1427139.jpg', genres: ['Drama', 'Comedy', 'Crime'], runtime: 59, network: 'Netflix' },
  ],
}

/** Dia dos Namorados shares the Valentine's picks. */
export function picksFor(id: FestiveId): FestivePick[] {
  return PICKS[id === 'namorados' ? 'valentines' : id]
}
