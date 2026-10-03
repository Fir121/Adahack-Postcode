import type {
  DemoInfo,
  MapDecoration,
  PostcodeCommunity,
  PostcodeIndicator,
  Task,
} from "@/types/domain";
import { greenLevel } from "@/lib/scoring";

export const demoInfo: DemoInfo = {
  email: "demo@greentogether.test",
  password: "GreenTogether!",
  postcode: "EH3 9GD",
};

const declaration = {
  type: "declaration",
  label: "I’ve completed this action",
  required: true,
} as const;
const photo = {
  type: "image",
  label: "Add a photo of your action",
  required: true,
  maxBytes: 5 * 1024 * 1024,
  acceptedTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;

export const mockTasks: Task[] = [
  {
    id: "walk-journey",
    title: "Take the scenic route",
    description:
      "Swap one short car journey for a walk or a cycle. Heading to the shops, meeting a friend, or doing the school run? Every little journey counts.",
    whyItMatters:
      "Transport is a focus area for your community. Choosing an active journey is a practical way to contribute.",
    targetIndicators: ["transport", "air_quality"],
    category: "Transport",
    estimatedTime: "15–30 min",
    effort: "Easy",
    repeat: "daily",
    proofRequirements: [declaration],
    decorationType: "bike",
  },
  {
    id: "save-energy",
    title: "Give peak hours a break",
    description:
      "Move one flexible household activity, like laundry or charging, away from the evening peak. Only shift what works for your routine.",
    whyItMatters:
      "A small change in when you use energy can help build more thoughtful energy habits.",
    targetIndicators: ["energy"],
    category: "Energy",
    estimatedTime: "5 min",
    effort: "Easy",
    repeat: "daily",
    proofRequirements: [
      declaration,
      {
        type: "text",
        label: "What did you change?",
        required: true,
        minLength: 10,
      },
    ],
    decorationType: "solar-panel",
  },
  {
    id: "plant-pot",
    title: "Make room for something green",
    description:
      "Plant a pollinator-friendly flower in a pot, garden, or space you have permission to use. A small patch is a lovely place to start.",
    whyItMatters:
      "Small green spaces can make your neighbourhood more welcoming to people and pollinators.",
    targetIndicators: ["green_space"],
    category: "Green space",
    estimatedTime: "20 min",
    effort: "A little effort",
    repeat: "once",
    proofRequirements: [photo],
    decorationType: "tree",
  },
  {
    id: "recycle-right",
    title: "Sort it out",
    description:
      "Check your local recycling guidance, then correctly sort today’s packaging. Rinse what needs rinsing and keep unsuitable items out.",
    whyItMatters:
      "Getting recycling right is a simple community habit that reduces contamination.",
    targetIndicators: ["recycling"],
    category: "Recycling",
    estimatedTime: "10 min",
    effort: "Easy",
    repeat: "daily",
    proofRequirements: [declaration],
    decorationType: "plant",
  },
  {
    id: "litter-pick",
    title: "A little pick-me-up",
    description:
      "Spend 15 minutes picking up ordinary litter in a safe public space. Use gloves or a litter picker and leave sharp or hazardous items alone.",
    whyItMatters:
      "A little care makes shared spaces more pleasant for everyone.",
    targetIndicators: ["green_space", "recycling"],
    category: "Green space",
    estimatedTime: "15 min",
    effort: "A little effort",
    repeat: "daily",
    proofRequirements: [
      photo,
      {
        type: "text",
        label: "Where did you lend a hand?",
        required: true,
        minLength: 10,
      },
    ],
    decorationType: "plant",
  },
];

function indicators(scores: number[]): PostcodeIndicator[] {
  const definitions = [
    {
      id: "air_quality",
      label: "Air quality",
      displayValue: "7 µg/m³",
      value: 7,
      unit: "µg/m³",
      description:
        "Illustrative PM2.5 concentration. Real data may come from a nearby monitoring station rather than your exact postcode.",
      trend: {
        direction: "down",
        change: 0.4,
        period: "previous month",
        interpretation: "Lower concentration in this demo dataset",
      },
    },
    {
      id: "energy",
      label: "Energy",
      displayValue: "3,240 kWh / year",
      value: 3240,
      unit: "kWh",
      description:
        "Illustrative annual household electricity consumption. A real source may cover a wider statistical area.",
      trend: {
        direction: "down",
        change: 2,
        period: "previous year",
        interpretation: "2% lower in this demo dataset",
      },
    },
    {
      id: "green_space",
      label: "Green space",
      displayValue: "32% coverage",
      value: 32,
      unit: "%",
      description:
        "Illustrative share of the local area covered by green space. It does not describe individual gardens or tree locations.",
    },
    {
      id: "transport",
      label: "Transport",
      displayValue: "24% active journeys",
      value: 24,
      unit: "%",
      description:
        "Illustrative share of journeys made by walking or cycling. This is an example statistic, not a live travel survey.",
      trend: {
        direction: "up",
        change: 3,
        period: "previous year",
        interpretation: "3 percentage points higher in this demo dataset",
      },
    },
    {
      id: "recycling",
      label: "Recycling",
      displayValue: "46% recycled",
      value: 46,
      unit: "%",
      description:
        "Illustrative household recycling rate. Real coverage is likely to be council-wide rather than a single postcode.",
    },
  ] as const;
  return definitions.map((definition, index) => ({
    ...definition,
    type: definition.id,
    score: scores[index],
    status:
      scores[index] < 40
        ? "poor"
        : scores[index] < 60
          ? "fair"
          : scores[index] < 85
            ? "good"
            : "excellent",
    provenance: "mock",
    source: "Illustrative hackathon dataset — not a published measurement",
    updatedAt: new Date().toISOString(),
    coverage: {
      type: "demo",
      description:
        "Example community values; real data coverage will be supplied by the backend.",
    },
  }));
}

function community(
  id: string,
  postcode: string,
  name: string,
  longitude: number,
  latitude: number,
  score: number,
  scores: number[],
  total: number,
): PostcodeCommunity {
  // These polygons are synthetic demo areas, NOT official unit-postcode boundaries.
  const offsets = [
    [-0.00115, -0.00062],
    [0.00072, -0.00078],
    [0.0013, -0.0002],
    [0.00105, 0.00062],
    [-0.0001, 0.00088],
    [-0.00125, 0.00042],
    [-0.00115, -0.00062],
  ];
  const decorations: MapDecoration[] = [
    {
      id: `${id}-tree-1`,
      type: "tree",
      longitude: longitude - 0.00065,
      latitude: latitude + 0.00025,
      animation: "grow",
      minGreenLevel: 1,
      indicator: "green_space",
    },
    {
      id: `${id}-tree-2`,
      type: "tree",
      longitude: longitude + 0.00062,
      latitude: latitude + 0.00042,
      animation: "grow",
      minGreenLevel: 2,
      indicator: "green_space",
    },
    {
      id: `${id}-house`,
      type: "house",
      longitude: longitude + 0.00056,
      latitude: latitude - 0.00032,
      animation: "appear",
      minGreenLevel: 0,
      indicator: "energy",
    },
    {
      id: `${id}-plant`,
      type: "plant",
      longitude: longitude - 0.00048,
      latitude: latitude - 0.00035,
      animation: "grow",
      minGreenLevel: 2,
      indicator: "green_space",
    },
    {
      id: `${id}-solar`,
      type: "solar-panel",
      longitude: longitude + 0.00075,
      latitude: latitude - 0.0002,
      animation: "appear",
      minGreenLevel: 4,
      indicator: "energy",
    },
    {
      id: `${id}-bike`,
      type: "bike",
      longitude: longitude - 0.0002,
      latitude: latitude + 0.0006,
      animation: "appear",
      minGreenLevel: 3,
      indicator: "transport",
    },
  ];
  return {
    id,
    postcode,
    name,
    city: "Edinburgh",
    centroid: { latitude, longitude },
    geometryProvenance: "demo",
    boundary: {
      type: "Feature",
      properties: { communityId: id, demoGeometry: true },
      geometry: {
        type: "Polygon",
        coordinates: [offsets.map(([x, y]) => [longitude + x, latitude + y])],
      },
    },
    indicators: indicators(scores),
    decorations,
    progress: {
      score,
      level: greenLevel(score),
      monthlyChange: 3,
      totalActions: total,
      activityByIndicator: {
        transport: 84,
        air_quality: 127,
        energy: 47,
        green_space: 31,
        recycling: 42,
      },
      stats: [
        {
          key: "participants",
          label: "Neighbours taking part",
          value: 86,
          icon: "users",
        },
        {
          key: "actions",
          label: "Actions this month",
          value: total,
          icon: "sprout",
          supportingText: "One small action at a time",
        },
      ],
    },
  };
}

// Centroids verified through postcodes.io; every boundary and indicator is illustrative.
export function createMockCommunities(): PostcodeCommunity[] {
  return [
    community(
      "eh3-9gd",
      "EH3 9GD",
      "Your little corner of Edinburgh",
      -3.192934,
      55.943437,
      68,
      [78, 52, 76, 34, 61],
      204,
    ),
    community(
      "eh3-9fg",
      "EH3 9FG",
      "A greener corner of the city",
      -3.197076,
      55.943774,
      82,
      [83, 67, 91, 54, 72],
      286,
    ),
    community(
      "eh8-9lj",
      "EH8 9LJ",
      "Growing together by the Meadows",
      -3.188782,
      55.942749,
      46,
      [62, 36, 71, 43, 53],
      113,
    ),
  ];
}
