export type SoilTip = {
  title: string
  texture: string
  summary: string
  bullets: string[]
  tags: string[]
}

export const soilTips: SoilTip[] = [
  {
    title: 'Clay — hold water, watch aeration',
    texture: 'Clay / silty clay',
    summary:
      'Fine particles stack tight: high water holding, slow drainage, and risk of compaction after heavy machinery.',
    bullets: [
      'Aim for organic matter builds (compost, cover crops) to improve crumb structure.',
      'Avoid working soil when plastic — it destroys aggregates.',
      'Sample by depth in low spots where salts or waterlogging show up first.',
    ],
    tags: ['drainage', 'compaction', 'organic matter'],
  },
  {
    title: 'Sandy — fast drink, hungry for nutrients',
    texture: 'Sand / loamy sand',
    summary: 'Large pores drain quickly; nitrogen and potassium can move with irrigation or rain.',
    bullets: [
      'Split fertilizer or use slow-release forms; little-and-often beats single dump.',
      'Mulch and residue help buffer temperature swings at the root zone.',
      'More frequent, lighter irrigation beats rare deep flooding on steep slopes.',
    ],
    tags: ['leaching', 'irrigation', 'fertility'],
  },
  {
    title: 'Loam — the middle path',
    texture: 'Loam',
    summary: 'Balanced sand, silt, and clay is forgiving for many row crops and vegetables.',
    bullets: [
      'Still test pH and EC every few years — “good texture” ≠ automatic fertility.',
      'Rotate hosts to break disease cycles; loam can hide nematode or fungal buildup.',
      'Track bulk density if you run the same wheel tracks every season.',
    ],
    tags: ['sampling', 'rotation', 'pH'],
  },
  {
    title: 'Silty soils — silky crust risk',
    texture: 'Silt / silty loam',
    summary: 'Great mineralogy for crops, but surface crusting after rain can block emergence.',
    bullets: [
      'Keep residue on the surface where erosion rules allow.',
      'Short tillage passes and cover between cash crops reduce surface sealing.',
      'Wind erosion can move fines — berms or shelter strips help on exposed flats.',
    ],
    tags: ['crusting', 'erosion', 'residue'],
  },
  {
    title: 'Peat / high organic — light and acidic',
    texture: 'Peaty / high organic',
    summary: 'Huge water retention and C store; may need lime or K if tests show drift.',
    bullets: [
      'Subsidence is real — manage water table where regulations permit.',
      'Micronutrients (e.g. Mo, B) sometimes tie up differently — lab tests matter.',
      'Watch iron / manganese interactions if drainage is “almost but not quite”.',
    ],
    tags: ['organic', 'pH', 'micronutrients'],
  },
]
