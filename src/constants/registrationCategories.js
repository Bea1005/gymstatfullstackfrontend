export const PREFERRED_CATEGORY_OPTIONS = [
  'Singles',
  'Doubles',
  'Mixed Doubles',
  'Any / Flexible',
  'Not Applicable',
];

export const REGISTRATION_CATEGORIES = [
  {
    name: 'Sports Event',
    subcategories: [
      {
        name: 'Ball & Team Sports',
        sports: [
          'Basketball (Men)',
          'Basketball (Women)',
          'Basketball 3x3 (M/W)',
          'Volleyball (Men)',
          'Volleyball (Women)',
          'Beach Volleyball (Men)',
          'Beach Volleyball (Women)',
          'Baseball (Men)',
          'Softball (Women)',
          'Futsal (Women)',
          'Sepak Takraw (Men)',
          'Sepak Takraw (Women)',
        ],
      },
      {
        name: 'Racket & Net Sports',
        sports: [
          'Badminton (Men)',
          'Badminton (Women)',
          'Lawn Tennis (Men)',
          'Lawn Tennis (Women)',
          'Table Tennis (Men)',
          'Table Tennis (Women)',
          'Pickleball (Men/Women)',
        ],
      },
      {
        name: 'Combat Sports & Martial Arts',
        sports: [
          'Arnis (Men)',
          'Arnis (Women)',
          'Tae-Kwon-Do (Men)',
          'Tae-Kwon-Do (Women)',
        ],
      },
      {
        name: 'Individual & Accuracy Sports',
        sports: [
          'Athletics (Men)',
          'Athletics (Women)',
          'Archery (Men)',
          'Archery (Women)',
          'Billiard (Men)',
          'Billiard (Women)',
          'Chess (Men)',
          'Chess (Women)',
        ],
      },
      {
        name: 'Dance Sports',
        sports: [
          'Dance Sports (Latin)',
          'Dance Sports (Standard)',
          'Dance Sports (Third Kind)',
        ],
      },
    ],
  },
  {
    name: 'Visual Arts',
    events: [
      'On-the-Spot Poster Making',
      'Pencil Drawing',
      'Charcoal Rendering',
      'Painting',
      'Photo Contest',
    ],
  },
  {
    name: 'Music',
    events: [
      'Song Writing',
      'Piano',
      'Classic Guitar',
      'Violin',
      'Banduria',
      'Pop Solo',
      'Vocal Solo/Kundiman',
      'Vocal Duet',
      'Quartet',
      'Choral (Standard)',
    ],
  },
  {
    name: 'Dance',
    events: [
      'Folk Dance',
      'Indigenous Dance',
      'Contemporary Dance',
      'Street Dance',
    ],
  },
  {
    name: 'Dramatic Art',
    events: [
      'Short and Sweet Play (Dialogue)',
      'Short and Sweet Play (Musical)',
      'Radio Drama',
      'Pandalawahang Pag-arte (Duo Acting)',
      'Additional Role: Technical – Sound/Music (Handles sound effects and music during the play to help set the mood of the Scenes)',
    ],
  },
  {
    name: 'Literary Art',
    events: [
      'Pagsulat ng Sanaysay',
      'Dagliang Talumpati',
      'Pagkukuwento',
      'Essay Writing',
      'Extemporaneous Speech',
      'Story Telling',
      'Declamation',
      'Deklamasyon',
      'Dramatic Monologue',
      'Dramatic Monologue (Filipino)',
      'Oral Interpretation of Poetry',
    ],
  },
  {
    name: 'Esports',
    events: [
      'Mobile Legends: Bang Bang',
      'Call of Duty: Mobile',
    ],
  },
];

export const REGISTRATION_SPORT_EVENT_OPTIONS = REGISTRATION_CATEGORIES.flatMap(
  ({ events = [], subcategories = [] }) => [
    ...events,
    ...subcategories.flatMap(({ sports }) => sports),
  ],
);
