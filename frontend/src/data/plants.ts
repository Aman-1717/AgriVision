export type PlantProfile = {
  commonName: string
  scientificName: string
  category: string
  water: string
  light: string
  soilPh: string
  notes: string[]
  pests: string[]
}

export const plantProfiles: PlantProfile[] = [
  {
    commonName: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    category: 'Fruit vegetable',
    water: 'Even moisture; avoid boom-bust irrigation to reduce cracking and blossom-end rot risk.',
    light: 'Full sun; 6–8+ hours direct for best yield in temperate climates.',
    soilPh: 'Roughly 6.0–6.8 for many cultivars — match to your soil test.',
    notes: [
      'Stake or trellis early to keep fruit off the ground.',
      'Lower leaf sanitation helps break early blight inoculum chains.',
    ],
    pests: ['Whitefly', 'Leaf miners', 'Spider mites (hot dry spells)'],
  },
  {
    commonName: 'Bread wheat',
    scientificName: 'Triticum aestivum',
    category: 'Cereal grain',
    water: 'Match to growth stage — critical at tillering, flowering, and grain fill.',
    light: 'Full sun; dense canopy drives yield but also humidity in the row.',
    soilPh: 'Often 6.0–7.0 band; liming program depends on subsoil acidity too.',
    notes: [
      'Scout lower canopy for rusts and septoria where dew periods are long.',
      'N timing interacts strongly with variety lodging resistance.',
    ],
    pests: ['Aphids', 'Armyworm (episodic)', 'Stored-grain beetles post-harvest'],
  },
  {
    commonName: 'Maize (corn)',
    scientificName: 'Zea mays',
    category: 'Cereal grain / silage',
    water: 'Highest demand around tassel/silking — uniform emergence sets ceiling yield.',
    light: 'Full sun; narrow rows change microclimate — adjust scouting cadence.',
    soilPh: 'Commonly 6.0–6.8; Zn responds on cool, wet sands in some regions.',
    notes: [
      'Even planting depth beats “perfect” population with uneven emergence.',
      'Fall armyworm thresholds vary — record growth stage when scouting.',
    ],
    pests: ['Stem borers', 'Fall armyworm', 'Rodent damage near field edges'],
  },
  {
    commonName: 'Potato',
    scientificName: 'Solanum tuberosum',
    category: 'Tuber crop',
    water: 'Steady soil moisture through tuber initiation; waterlogging invites rot.',
    light: 'Full sun; hilling protects tubers from greening.',
    soilPh: 'Often acid side; scab risk interacts with pH and variety — verify locally.',
    notes: [
      'Crop rotation length matters for soil-borne pathogens.',
      'Kill timing before harvest balances skin set and market window.',
    ],
    pests: ['Colorado potato beetle', 'Aphids (virus vectors)', 'Wireworm in some soils'],
  },
  {
    commonName: 'Chili pepper',
    scientificName: 'Capsicum annuum',
    category: 'Spice / vegetable',
    water: 'Avoid heavy dry-wet swings during fruit set; drip gives the finest control.',
    light: 'Full sun; partial shade only where heat stress aborts flowers.',
    soilPh: 'Near-neutral to slightly acid is typical; salinity hurts at germination.',
    notes: [
      'Fruit load lags heat units — track flowering flush after temperature dips.',
      'Mechanical damage at harvest opens secondary rots rapidly.',
    ],
    pests: ['Thrips', 'Mites', 'Fruit borers (region-specific)'],
  },
]
