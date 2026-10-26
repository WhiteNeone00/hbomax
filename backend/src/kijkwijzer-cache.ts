type KijkwijzerRecord = {
  rating: string
  descriptors: string[]
  source: string
}

export const verifiedKijkwijzerRecords: Record<number, KijkwijzerRecord> = {
  96677: {
    rating: '12',
    descriptors: ['Geweld', 'Angst', 'Grof taalgebruik', 'Discriminatie'],
    source: 'https://www.kijkwijzer.nl/series/lupin-part-2/',
  },
  136315: {
    rating: '6',
    descriptors: ['Geweld', 'Angst', 'Grof taalgebruik'],
    source: 'https://www.kijkwijzer.nl/series/the-bear-season-1/',
  },
  549: {
    rating: '6',
    descriptors: ['Geweld', 'Angst'],
    source: 'https://www.kijkwijzer.nl/series/law-order/',
  },
  247718: {
    rating: '16',
    descriptors: ['Geweld', 'Grof taalgebruik', 'Drugs'],
    source: 'https://www.kijkwijzer.nl/series/mobland-s1/',
  },
  1384216: {
    rating: '16',
    descriptors: ['Geweld', 'Grof taalgebruik'],
    source: 'https://www.kijkwijzer.nl/films/the-dog-stars/',
  },
  337700: {
    rating: '12',
    descriptors: ['Angst', 'Grof taalgebruik'],
    source: 'https://www.kijkwijzer.nl/series/the-serial-killer-connection-season-1/',
  },
  287947: {
    rating: '12',
    descriptors: ['Geweld', 'Angst', 'Grof taalgebruik'],
    source: 'https://www.kijkwijzer.nl/films/shazam/',
  },
}