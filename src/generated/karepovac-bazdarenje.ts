// Generirano iz mjerenja postaje Karepovac 1 i modela raspršenja.
// Pokretanje: npm run bazdari-izvor — ne uređivati ručno.

export const BAZDARENJE = {
  "od": "2024-09-01",
  "do": "2026-08-17",
  "tvar": "H2S",
  "postaja": "k1",
  "vjetar": "ldsp",
  "pamcenje": true,
  "sati": 11247,
  "spearman": 0.1336,
  "auc": 0.5768,
  "pozadina": 1.236,
  "emisijaUgS": [
    863.7,
    2075.7,
    3210.0
  ],
  "plohaM2": 313750,
  "pragNjuha": [
    0.7,
    7.0
  ],
  "kontrola": {
    "k2 Ozon (O3)": -0.3934,
    "k2 Ugljikov monoksid (CO)": 0.1016,
    "k2 metil+etilmerkaptan": -0.0516,
    "k1 NH3": -0.0061
  },
  "izvedbe": {
    "era5-pamti": {
      "spearman": -0.0102,
      "auc": 0.5502,
      "sati": 12858
    },
    "era5-bez": {
      "spearman": -0.0245,
      "auc": 0.5371,
      "sati": 12858
    },
    "ldsp-pamti": {
      "spearman": 0.1336,
      "auc": 0.5768,
      "sati": 11247
    },
    "ldsp-bez": {
      "spearman": 0.1007,
      "auc": 0.5554,
      "sati": 11247
    },
    "spoj-pamti": {
      "spearman": -0.0693,
      "auc": 0.4875,
      "sati": 12850
    },
    "spoj-bez": {
      "spearman": -0.1063,
      "auc": 0.4491,
      "sati": 12850
    }
  }
} as const;
