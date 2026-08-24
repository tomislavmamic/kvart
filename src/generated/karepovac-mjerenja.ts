// Generirano iz satnih tablica postaja Karepovac 1 i Karepovac 2.
// Pokretanje: npm run izvedi-mjerenja — ne uređivati ručno.

export const MJERENJA = {
  "izvorVjetra": "ldsp",
  "postaje": [
    {
      "oznaka": "k1",
      "naziv": "Karepovac 1",
      "opis": "udolina jugoistočno od plohe, suprotna strana od kvarta",
      "lat": 43.516650515206784,
      "lon": 16.51691228544307,
      "visina": 39.6,
      "od": "2024-08-31T22:00Z",
      "do": "2026-08-21T19:00Z",
      "glavna": "H2S",
      "tvari": [
        {
          "naziv": "H2S",
          "sati": 16076,
          "medijan": 0.924,
          "p98": 3.898,
          "najvise": 44.106
        },
        {
          "naziv": "NH3",
          "sati": 17172,
          "medijan": 6.627,
          "p98": 28.907,
          "najvise": 117.962
        },
        {
          "naziv": "NO2",
          "sati": 16994,
          "medijan": 6.36,
          "p98": 18.619,
          "najvise": 51.282
        },
        {
          "naziv": "SO2",
          "sati": 16940,
          "medijan": 3.796,
          "p98": 10.71,
          "najvise": 191.221
        }
      ],
      "dnevniHod": [
        1.22,
        1.232,
        1.207,
        1.275,
        1.196,
        1.17,
        1.126,
        1.089,
        1.058,
        1.048,
        1.008,
        0.952,
        0.918,
        0.912,
        0.98,
        0.935,
        0.987,
        1.024,
        1.071,
        1.197,
        1.225,
        1.255,
        1.282,
        1.233
      ],
      "ruza": {
        "srednje": [
          1.149,
          1.084,
          1.165,
          1.158,
          1.088,
          0.946,
          0.901,
          0.892,
          1.002,
          0.997,
          0.964,
          1.286,
          1.105,
          1.257,
          1.288,
          1.11
        ],
        "sati": [
          2564,
          1109,
          931,
          596,
          1192,
          1494,
          414,
          202,
          267,
          284,
          1352,
          489,
          271,
          352,
          1046,
          1315
        ]
      }
    },
    {
      "oznaka": "k2",
      "naziv": "Karepovac 2",
      "opis": "udolina jugoistočno od plohe, suprotna strana od kvarta",
      "lat": 43.516650515206784,
      "lon": 16.51691228544307,
      "visina": 39.6,
      "od": "2024-04-08T22:00Z",
      "do": "2026-08-21T19:00Z",
      "glavna": "metil+etilmerkaptan",
      "tvari": [
        {
          "naziv": "Ozon (O3)",
          "sati": 18415,
          "medijan": 62.71,
          "p98": 122.09,
          "najvise": 212.2
        },
        {
          "naziv": "Ugljikov monoksid (CO)",
          "sati": 17747,
          "medijan": 0.153,
          "p98": 0.311,
          "najvise": 1.658
        },
        {
          "naziv": "Benzen",
          "sati": 18450,
          "medijan": 0.05,
          "p98": 1.3,
          "najvise": 72.573
        },
        {
          "naziv": "Toluen",
          "sati": 18450,
          "medijan": 0.05,
          "p98": 6.453,
          "najvise": 261.316
        },
        {
          "naziv": "Etilbenzen",
          "sati": 18287,
          "medijan": 0.05,
          "p98": 0.934,
          "najvise": 6.467
        },
        {
          "naziv": "o-ksilen",
          "sati": 18450,
          "medijan": 0.05,
          "p98": 0.844,
          "najvise": 26.343
        },
        {
          "naziv": "mp-ksilen",
          "sati": 18450,
          "medijan": 0.05,
          "p98": 0.454,
          "najvise": 108.19
        },
        {
          "naziv": "metilmerkaptan",
          "sati": 15872,
          "medijan": 0.05,
          "p98": 7.68,
          "najvise": 275.58
        },
        {
          "naziv": "etilmerkaptan",
          "sati": 15671,
          "medijan": 0.206,
          "p98": 6.494,
          "najvise": 22.877
        },
        {
          "naziv": "metil+etilmerkaptan",
          "sati": 15562,
          "medijan": 1.212,
          "p98": 11.348,
          "najvise": 277.502
        }
      ],
      "dnevniHod": [
        1.832,
        1.771,
        1.738,
        1.681,
        2.114,
        1.825,
        1.71,
        1.694,
        1.94,
        2.303,
        2.363,
        2.489,
        2.428,
        2.208,
        2.341,
        2.365,
        2.485,
        2.199,
        2.108,
        2.191,
        2.184,
        2.185,
        2.03,
        2.003
      ],
      "ruza": {
        "srednje": [
          2.09,
          1.949,
          2.019,
          2.114,
          2.177,
          2.174,
          1.934,
          1.872,
          2.66,
          2.586,
          2.748,
          2.737,
          2.307,
          1.956,
          1.936,
          2.09
        ],
        "sati": [
          2337,
          958,
          827,
          503,
          1063,
          1309,
          346,
          167,
          231,
          242,
          1007,
          369,
          220,
          285,
          922,
          1226
        ]
      }
    }
  ],
  "godisnjaSlika": {
    "godina": 2025,
    "sati": 8758,
    "najviseSatno": 12.17,
    "iznad": [
      {
        "razina": 0.2,
        "najviseSati": 3521
      },
      {
        "razina": 0.7,
        "najviseSati": 842
      },
      {
        "razina": 2.0,
        "najviseSati": 122
      }
    ],
    "uPerjaniciMedijan": 976,
    "uPerjaniciNajvise": 7541
  }
} as const;
